-- ====================================================================
-- Supabase SQL Migration: Student Authentication, Key Migration & RLS Fixes
-- Run this script in your Supabase SQL Editor to update your database.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Students Table (Admission Number + DOB Authentication)
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admission_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast Admission Number login lookups
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);

-- 2. Update Submissions Table to link with Students & allow practice/demo submissions
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_dev_demo BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

ALTER TABLE submissions ALTER COLUMN exam_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);

-- 3. Auto-sync auth.users into public.teachers so foreign keys never fail
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

-- 4. Explicit Data API Role Grants for Publishable & Secret Keys
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Enable Row Level Security (RLS) for Students Table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 6. Idempotent RLS Policies for Students, Exams, and Submissions
DROP POLICY IF EXISTS "Public student read for login" ON students;
CREATE POLICY "Public student read for login"
    ON students FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public student registration insert" ON students;
CREATE POLICY "Public student registration insert"
    ON students FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Teachers can update enrolled students" ON students;
CREATE POLICY "Teachers can update enrolled students"
    ON students FOR UPDATE
    USING (auth.uid() = teacher_id OR teacher_id IS NULL OR auth.role() = 'authenticated')
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Teachers can delete enrolled students" ON students;
CREATE POLICY "Teachers can delete enrolled students"
    ON students FOR DELETE
    USING (auth.uid() = teacher_id OR teacher_id IS NULL OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public student read for active exams" ON exams;
CREATE POLICY "Public student read for active exams"
    ON exams FOR SELECT
    USING (status IN ('active', 'published') OR auth.uid() = teacher_id OR teacher_id IS NULL);

DROP POLICY IF EXISTS "Students can view own submissions" ON submissions;
CREATE POLICY "Students can view own submissions"
    ON submissions FOR SELECT USING (TRUE);

-- 7. Multi-Tenant Teacher-Student Classroom Junction Table
CREATE TABLE IF NOT EXISTS teacher_students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
    class_code TEXT,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enrollment_source TEXT DEFAULT 'class_code', -- 'class_code', 'invite_link', 'live_exam', 'manual_lookup'
    UNIQUE(teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_class_code ON teacher_students(class_code);

GRANT ALL ON TABLE teacher_students TO anon, authenticated, service_role;
ALTER TABLE teacher_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public teacher_students select" ON teacher_students;
CREATE POLICY "Public teacher_students select"
    ON teacher_students FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Public teacher_students insert" ON teacher_students;
CREATE POLICY "Public teacher_students insert"
    ON teacher_students FOR INSERT
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Teachers can delete enrolled student junction" ON teacher_students;
CREATE POLICY "Teachers can delete enrolled student junction"
    ON teacher_students FOR DELETE
    USING (auth.uid() = teacher_id OR auth.role() = 'authenticated');
