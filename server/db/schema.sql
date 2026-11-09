-- =======================================================
-- Supabase PostgreSQL Schema for Tuition Test Platform
-- Compatible with Modern Publishable (sb_publishable_...)
-- and Secret (sb_secret_...) API Keys + Legacy Keys
-- =======================================================

-- Enable UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Teachers / Profiles Table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automatically sync new/updated Supabase Auth users into public.teachers
CREATE OR REPLACE FUNCTION public.handle_new_teacher_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.teachers (id, email, full_name, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.id::text || '@teacher.local'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'Instructor'), '@', 1)),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.teachers.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_teacher_user();

-- Backfill any existing auth.users into the teachers table
INSERT INTO teachers (id, email, full_name)
SELECT id, COALESCE(email, id::text || '@teacher.local'), COALESCE(raw_user_meta_data->>'full_name', split_part(COALESCE(email, 'Instructor'), '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Exams Table (Metadata & Published Snapshots)
CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject TEXT DEFAULT 'Mathematics',
    grade TEXT DEFAULT 'JEE Advanced',
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'published', 'closed', 'archived')),
    needs_review BOOLEAN DEFAULT FALSE,
    question_count INTEGER DEFAULT 0,
    snapshot_data JSONB, -- Published question snapshot payload + sessionMeta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Individual Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mcq', 'short_answer_numeric', 'match_following')),
    options JSONB, -- Array of MCQ options e.g. ["A", "B", "C", "D"]
    correct_answer INTEGER, -- 0-indexed key for MCQ
    accepted_range JSONB, -- Numeric [min, max] range
    numerical_confirmed BOOLEAN DEFAULT FALSE,
    diagrams JSONB, -- Diagram crop metadata
    diagram_images JSONB, -- Cropped diagram URLs / base64 fallback
    diagrams_confirmed BOOLEAN DEFAULT FALSE,
    needs_review BOOLEAN DEFAULT FALSE,
    review_reasons JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Active Rolling Code Exam Sessions Table
CREATE TABLE IF NOT EXISTS exam_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rolling_code TEXT NOT NULL, -- Active 6-digit rolling code
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure existing exam_sessions.teacher_id FK references auth.users(id) safely
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'exam_sessions_teacher_id_fkey'
          AND table_name = 'exam_sessions'
    ) THEN
        ALTER TABLE exam_sessions DROP CONSTRAINT exam_sessions_teacher_id_fkey;
        ALTER TABLE exam_sessions
            ADD CONSTRAINT exam_sessions_teacher_id_fkey
            FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 5. Students Table (Admission Number + DOB Authentication)
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admission_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure existing students.teacher_id FK references auth.users(id) safely
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'students_teacher_id_fkey'
          AND table_name = 'students'
    ) THEN
        ALTER TABLE students DROP CONSTRAINT students_teacher_id_fkey;
        ALTER TABLE students
            ADD CONSTRAINT students_teacher_id_fkey
            FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 6. Student Submissions & Auto-Graded Scores Table
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    rolling_code_used TEXT,
    total_score NUMERIC(5,2) DEFAULT 0.00,
    max_possible NUMERIC(5,2) DEFAULT 0.00,
    percentage NUMERIC(5,2) DEFAULT 0.00,
    time_taken_seconds INTEGER DEFAULT 0,
    is_dev_demo BOOLEAN DEFAULT FALSE,
    attempt_number INTEGER DEFAULT 1,
    responses JSONB NOT NULL, -- Detailed student answers & question-by-question marks
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure submissions.exam_id is nullable for practice/demo assessments
ALTER TABLE submissions ALTER COLUMN exam_id DROP NOT NULL;

-- Indexes for Fast Query Performance
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_rolling ON exam_sessions(exam_id, rolling_code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);

-- =======================================================
-- Explicit Data API Role Grants (Required for 2026 Supabase Publishable & Secret Keys)
-- =======================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Enable Row Level Security (RLS)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- RLS Policies (Idempotent: drops prior policy before re-creating)
-- =======================================================

-- 1. Teachers Policies
DROP POLICY IF EXISTS "Teachers can view and update own profile" ON teachers;
DROP POLICY IF EXISTS "Public teacher lookup for student linking" ON teachers;

CREATE POLICY "Public teacher lookup for student linking"
    ON teachers FOR SELECT USING (TRUE);

CREATE POLICY "Teachers can view and update own profile"
    ON teachers FOR ALL
    USING (auth.uid() = id OR auth.role() = 'service_role')
    WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- 2. Exams Policies
DROP POLICY IF EXISTS "Teachers can manage own exams" ON exams;
DROP POLICY IF EXISTS "Public student read for active exams" ON exams;

CREATE POLICY "Public student read for active exams"
    ON exams FOR SELECT
    USING (status IN ('active', 'published') OR auth.uid() = teacher_id OR teacher_id IS NULL);

CREATE POLICY "Teachers can manage own exams"
    ON exams FOR ALL
    USING (auth.uid() = teacher_id OR teacher_id IS NULL OR auth.role() = 'authenticated')
    WITH CHECK (auth.uid() = teacher_id OR teacher_id IS NULL OR auth.role() = 'authenticated');

-- 3. Questions Policies
DROP POLICY IF EXISTS "Teachers can manage own exam questions" ON questions;
DROP POLICY IF EXISTS "Public read questions for active exams" ON questions;

CREATE POLICY "Public read questions for active exams"
    ON questions FOR SELECT
    USING (TRUE);

CREATE POLICY "Teachers can manage own exam questions"
    ON questions FOR ALL
    USING (
        auth.role() = 'authenticated' OR
        EXISTS (SELECT 1 FROM exams WHERE exams.id = questions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    )
    WITH CHECK (
        auth.role() = 'authenticated' OR
        EXISTS (SELECT 1 FROM exams WHERE exams.id = questions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    );

-- 4. Active Sessions Policies
DROP POLICY IF EXISTS "Public student access for active sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Teachers can manage exam sessions" ON exam_sessions;

CREATE POLICY "Public student access for active sessions"
    ON exam_sessions FOR SELECT
    USING (is_active = TRUE OR auth.role() = 'authenticated');

CREATE POLICY "Teachers can manage exam sessions"
    ON exam_sessions FOR ALL
    USING (
        auth.role() = 'authenticated' OR
        teacher_id IS NULL OR
        EXISTS (SELECT 1 FROM exams WHERE exams.id = exam_sessions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    )
    WITH CHECK (
        auth.role() = 'authenticated' OR
        teacher_id IS NULL OR
        EXISTS (SELECT 1 FROM exams WHERE exams.id = exam_sessions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    );

-- 5. Submissions Policies
DROP POLICY IF EXISTS "Public student submissions insert" ON submissions;
DROP POLICY IF EXISTS "Teachers view submissions for own exams" ON submissions;
DROP POLICY IF EXISTS "Teachers update submissions for own exams" ON submissions;
DROP POLICY IF EXISTS "Students can view own submissions" ON submissions;

CREATE POLICY "Public student submissions insert"
    ON submissions FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Students can view own submissions"
    ON submissions FOR SELECT
    USING (TRUE);

CREATE POLICY "Teachers view submissions for own exams"
    ON submissions FOR SELECT
    USING (
        auth.role() = 'authenticated' OR
        exam_id IS NULL OR
        EXISTS (SELECT 1 FROM exams WHERE exams.id = submissions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    );

CREATE POLICY "Teachers update submissions for own exams"
    ON submissions FOR UPDATE
    USING (
        auth.role() = 'authenticated' OR
        exam_id IS NULL OR
        EXISTS (SELECT 1 FROM exams WHERE exams.id = submissions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    )
    WITH CHECK (TRUE);

-- 6. Students Policies
DROP POLICY IF EXISTS "Public student read for login" ON students;
DROP POLICY IF EXISTS "Public student registration insert" ON students;
DROP POLICY IF EXISTS "Teachers can update enrolled students" ON students;
DROP POLICY IF EXISTS "Teachers can delete enrolled students" ON students;

CREATE POLICY "Public student read for login"
    ON students FOR SELECT
    USING (TRUE);

CREATE POLICY "Public student registration insert"
    ON students FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Teachers can update enrolled students"
    ON students FOR UPDATE
    USING (auth.uid() = teacher_id OR teacher_id IS NULL OR auth.role() = 'authenticated')
    WITH CHECK (TRUE);

CREATE POLICY "Teachers can delete enrolled students"
    ON students FOR DELETE
    USING (auth.uid() = teacher_id OR teacher_id IS NULL OR auth.role() = 'authenticated');

-- =======================================================
-- 7. Storage Bucket Setup for Cropped Diagram Images
-- =======================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagram-media', 'diagram-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Diagram Media" ON storage.objects;
CREATE POLICY "Public Read Diagram Media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'diagram-media');

DROP POLICY IF EXISTS "Public Upload Diagram Media" ON storage.objects;
CREATE POLICY "Public Upload Diagram Media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'diagram-media');

DROP POLICY IF EXISTS "Public Update Diagram Media" ON storage.objects;
CREATE POLICY "Public Update Diagram Media"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'diagram-media');
