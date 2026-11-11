-- =======================================================
-- Supabase PostgreSQL Schema for Tuition Test Platform
-- Hardened Stage 1 RLS: Strict Teacher Ownership & No Public Credential/Key Exposure
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
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rolling_code TEXT NOT NULL, -- Active 6-digit rolling code
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 6. Student Submissions & Auto-Graded Scores Table
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    rolling_code_used TEXT,
    total_score NUMERIC(5,2) DEFAULT 0.00,
    max_possible NUMERIC(5,2) DEFAULT 0.00,
    percentage NUMERIC(5,2) DEFAULT 0.00,
    time_taken_seconds INTEGER DEFAULT 0,
    is_dev_demo BOOLEAN DEFAULT FALSE,
    attempt_number INTEGER DEFAULT 1,
    responses JSONB NOT NULL, -- Detailed student answers & server-computed marks
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Multi-Tenant Teacher-Student Classroom Junction Table
CREATE TABLE IF NOT EXISTS teacher_students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_code TEXT,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enrollment_source TEXT DEFAULT 'class_code',
    UNIQUE(teacher_id, student_id)
);

-- Indexes for Fast Query Performance
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_rolling ON exam_sessions(exam_id, rolling_code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_class_code ON teacher_students(class_code);

-- =======================================================
-- Principle of Least Privilege Role Grants
-- Revoke public/anon direct table access; backend uses service_role and teacher JWTs use authenticated
-- =======================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Enable Row Level Security (RLS) across all tables
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_students ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- Strict Owner-Scoped RLS Policies
-- =======================================================

-- 1. Teachers Policies
DROP POLICY IF EXISTS "Teachers can view and update own profile" ON teachers;
DROP POLICY IF EXISTS "Public teacher lookup for student linking" ON teachers;

CREATE POLICY "Teachers can view and update own profile"
    ON teachers FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Exams Policies (Strict Teacher Ownership; no teacher_id IS NULL or wildcard authenticated bypass)
DROP POLICY IF EXISTS "Teachers can manage own exams" ON exams;
DROP POLICY IF EXISTS "Public student read for active exams" ON exams;

CREATE POLICY "Teachers can manage own exams"
    ON exams FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- 3. Questions Policies (Strict Teacher Ownership; prevents answer key leakage via PostgREST)
DROP POLICY IF EXISTS "Teachers can manage own exam questions" ON questions;
DROP POLICY IF EXISTS "Public read questions for active exams" ON questions;

CREATE POLICY "Teachers can manage own exam questions"
    ON questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = questions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = questions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

-- 4. Active Sessions Policies
DROP POLICY IF EXISTS "Public student access for active sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Teachers can manage exam sessions" ON exam_sessions;

CREATE POLICY "Teachers can manage exam sessions"
    ON exam_sessions FOR ALL
    USING (
        auth.uid() = teacher_id
        AND EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = exam_sessions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = teacher_id
        AND EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = exam_sessions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

-- 5. Submissions Policies (Strict Teacher Ownership; student reads/writes go through backend service_role)
DROP POLICY IF EXISTS "Public student submissions insert" ON submissions;
DROP POLICY IF EXISTS "Teachers view submissions for own exams" ON submissions;
DROP POLICY IF EXISTS "Teachers update submissions for own exams" ON submissions;
DROP POLICY IF EXISTS "Students can view own submissions" ON submissions;

CREATE POLICY "Teachers view submissions for own exams"
    ON submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = submissions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers update submissions for own exams"
    ON submissions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = submissions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = submissions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

-- 6. Students Policies (Teachers can only access students enrolled in their classroom)
DROP POLICY IF EXISTS "Public student read for login" ON students;
DROP POLICY IF EXISTS "Public student registration insert" ON students;
DROP POLICY IF EXISTS "Teachers can view enrolled students" ON students;
DROP POLICY IF EXISTS "Teachers can update enrolled students" ON students;
DROP POLICY IF EXISTS "Teachers can delete enrolled students" ON students;

CREATE POLICY "Teachers can view enrolled students"
    ON students FOR SELECT
    USING (
        auth.uid() = teacher_id
        OR EXISTS (
            SELECT 1 FROM teacher_students
            WHERE teacher_students.student_id = students.id
              AND teacher_students.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update enrolled students"
    ON students FOR UPDATE
    USING (
        auth.uid() = teacher_id
        OR EXISTS (
            SELECT 1 FROM teacher_students
            WHERE teacher_students.student_id = students.id
              AND teacher_students.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = teacher_id
        OR EXISTS (
            SELECT 1 FROM teacher_students
            WHERE teacher_students.student_id = students.id
              AND teacher_students.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can delete enrolled students"
    ON students FOR DELETE
    USING (auth.uid() = teacher_id);

-- 7. Teacher-Students Junction Policies
DROP POLICY IF EXISTS "Public teacher_students select" ON teacher_students;
DROP POLICY IF EXISTS "Public teacher_students insert" ON teacher_students;
DROP POLICY IF EXISTS "Teachers can manage own classroom roster" ON teacher_students;
DROP POLICY IF EXISTS "Teachers can delete enrolled student junction" ON teacher_students;

CREATE POLICY "Teachers can manage own classroom roster"
    ON teacher_students FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- 8. Storage Bucket Setup for Cropped Diagram Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagram-media', 'diagram-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Diagram Media" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Diagram Media" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Diagram Media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Teachers Upload Diagram Media" ON storage.objects;

CREATE POLICY "Public Read Diagram Media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'diagram-media');

CREATE POLICY "Authenticated Teachers Upload Diagram Media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'diagram-media' AND auth.role() IN ('authenticated', 'service_role'));
