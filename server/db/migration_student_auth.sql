-- ====================================================================
-- Supabase SQL Migration: Stage 1 Security & RLS Hardening
-- Run this script in your Supabase SQL Editor to lock down live tables.
-- Idempotent across fresh or older databases.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Ensure tables, columns, and teacher auto-sync trigger exist on legacy DBs
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admission_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_dev_demo BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS teacher_students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_code TEXT,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enrollment_source TEXT DEFAULT 'class_code',
    UNIQUE(teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_class_code ON teacher_students(class_code);

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

INSERT INTO teachers (id, email, full_name)
SELECT id, COALESCE(email, id::text || '@teacher.local'), COALESCE(raw_user_meta_data->>'full_name', split_part(COALESCE(email, 'Instructor'), '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 1. Revoke unrestricted anonymous PostgREST table dumps
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 2. Ensure Row Level Security is enabled on all tables
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_students ENABLE ROW LEVEL SECURITY;

-- 3. Drop permissive legacy policies (auth.role() = 'authenticated', teacher_id IS NULL, USING (TRUE))
DROP POLICY IF EXISTS "Teachers can view and update own profile" ON teachers;
DROP POLICY IF EXISTS "Public teacher lookup for student linking" ON teachers;
DROP POLICY IF EXISTS "Public student read for active exams" ON exams;
DROP POLICY IF EXISTS "Teachers can manage own exams" ON exams;
DROP POLICY IF EXISTS "Public read questions for active exams" ON questions;
DROP POLICY IF EXISTS "Teachers can manage own exam questions" ON questions;
DROP POLICY IF EXISTS "Public student access for active sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Teachers can manage exam sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Public student submissions insert" ON submissions;
DROP POLICY IF EXISTS "Students can view own submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers view submissions for own exams" ON submissions;
DROP POLICY IF EXISTS "Teachers update submissions for own exams" ON submissions;
DROP POLICY IF EXISTS "Public student read for login" ON students;
DROP POLICY IF EXISTS "Public student registration insert" ON students;
DROP POLICY IF EXISTS "Teachers can view enrolled students" ON students;
DROP POLICY IF EXISTS "Teachers can update enrolled students" ON students;
DROP POLICY IF EXISTS "Teachers can delete enrolled students" ON students;
DROP POLICY IF EXISTS "Public teacher_students select" ON teacher_students;
DROP POLICY IF EXISTS "Public teacher_students insert" ON teacher_students;
DROP POLICY IF EXISTS "Teachers can delete enrolled student junction" ON teacher_students;
DROP POLICY IF EXISTS "Teachers can manage own classroom roster" ON teacher_students;

-- 4. Create strict owner-scoped policies
CREATE POLICY "Teachers can view and update own profile"
    ON teachers FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Teachers can manage own exams"
    ON exams FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

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

CREATE POLICY "Teachers can manage own classroom roster"
    ON teacher_students FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- 5. Storage Bucket & Strict Upload Policies for Cropped Diagram Images
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
