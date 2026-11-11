-- ============================================================================
-- FULL DATABASE RESET & CLEAN INITIALIZATION (ZERO DEPENDENCIES)
-- Target: Supabase PostgreSQL SQL Editor
--
-- WARNING: This script DROPS and recreates all application tables in `public`
--          (`teachers`, `exams`, `questions`, `exam_sessions`, `students`,
--          `submissions`, `teacher_students`), wiping existing app data cleanly.
--          Safe to run on a blank project, broken state, or partially migrated DB.
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Teardown previous triggers, functions, and app tables cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_teacher_user() CASCADE;

DROP TABLE IF EXISTS public.teacher_students CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.exam_sessions CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;

-- (Optional) Uncomment the next line ONLY if you also want to wipe test teacher accounts in Supabase Auth:
-- DELETE FROM auth.users;

-- 2. Teachers Profile Table (synced with auth.users)
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            split_part(COALESCE(NEW.email, 'Instructor'), '@', 1)
        ),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.teachers.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_teacher_user();

-- Backfill any existing auth.users into public.teachers so FK constraints always succeed
INSERT INTO public.teachers (id, email, full_name)
SELECT
    id,
    COALESCE(email, id::text || '@teacher.local'),
    COALESCE(raw_user_meta_data->>'full_name', split_part(COALESCE(email, 'Instructor'), '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Exams Table (Metadata & Published Snapshots)
CREATE TABLE public.exams (
    id TEXT PRIMARY KEY,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT DEFAULT 'Mathematics',
    grade TEXT DEFAULT 'JEE Advanced',
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'published', 'closed', 'archived')),
    needs_review BOOLEAN DEFAULT FALSE,
    question_count INTEGER DEFAULT 0,
    snapshot_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Individual Questions Table
CREATE TABLE public.questions (
    id TEXT PRIMARY KEY,
    exam_id TEXT REFERENCES public.exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mcq', 'short_answer_numeric', 'match_following')),
    options JSONB,
    correct_answer INTEGER,
    accepted_range JSONB,
    numerical_confirmed BOOLEAN DEFAULT FALSE,
    diagrams JSONB,
    diagram_images JSONB,
    diagrams_confirmed BOOLEAN DEFAULT FALSE,
    needs_review BOOLEAN DEFAULT FALSE,
    review_reasons JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Active Rolling Passcode Exam Sessions Table
CREATE TABLE public.exam_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rolling_code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Students Table (Roll/Admission Number + DOB Authentication)
CREATE TABLE public.students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admission_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Student Submissions & Server-Graded Scores Table
CREATE TABLE public.submissions (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    rolling_code_used TEXT,
    total_score NUMERIC(8,2) DEFAULT 0.00,
    max_possible NUMERIC(8,2) DEFAULT 0.00,
    percentage NUMERIC(5,2) DEFAULT 0.00,
    time_taken_seconds INTEGER DEFAULT 0,
    is_dev_demo BOOLEAN DEFAULT FALSE,
    attempt_number INTEGER DEFAULT 1,
    responses JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Multi-Tenant Teacher-Student Classroom Junction Table
CREATE TABLE public.teacher_students (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_code TEXT,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enrollment_source TEXT DEFAULT 'class_code',
    UNIQUE (teacher_id, student_id)
);

-- 9. Performance Indexes
CREATE INDEX idx_exams_teacher_id ON public.exams(teacher_id);
CREATE INDEX idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX idx_sessions_exam_rolling ON public.exam_sessions(exam_id, rolling_code) WHERE is_active = TRUE;
CREATE INDEX idx_submissions_exam_id ON public.submissions(exam_id);
CREATE INDEX idx_students_admission_number ON public.students(admission_number);
CREATE INDEX idx_students_teacher_id ON public.students(teacher_id);
CREATE INDEX idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX idx_teacher_students_teacher ON public.teacher_students(teacher_id);
CREATE INDEX idx_teacher_students_student ON public.teacher_students(student_id);
CREATE INDEX idx_teacher_students_class_code ON public.teacher_students(class_code);

-- 10. Least-Privilege Role Grants (lock down anon; allow authenticated & backend service_role)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON public.teachers, public.exams, public.questions, public.exam_sessions,
          public.submissions, public.students, public.teacher_students FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.teachers,
    public.exams,
    public.questions,
    public.exam_sessions,
    public.submissions,
    public.students,
    public.teacher_students
    TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 11. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

-- 12. Strict Owner-Scoped RLS Policies
CREATE POLICY "Teachers can view and update own profile"
    ON public.teachers FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Teachers can manage own exams"
    ON public.exams FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own exam questions"
    ON public.questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = questions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = questions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can manage exam sessions"
    ON public.exam_sessions FOR ALL
    USING (
        auth.uid() = teacher_id
        AND EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = exam_sessions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = teacher_id
        AND EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = exam_sessions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers view submissions for own exams"
    ON public.submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = submissions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers update submissions for own exams"
    ON public.submissions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = submissions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exams
            WHERE exams.id = submissions.exam_id
              AND exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can view enrolled students"
    ON public.students FOR SELECT
    USING (
        auth.uid() = teacher_id
        OR EXISTS (
            SELECT 1 FROM public.teacher_students
            WHERE teacher_students.student_id = students.id
              AND teacher_students.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update enrolled students"
    ON public.students FOR UPDATE
    USING (
        auth.uid() = teacher_id
        OR EXISTS (
            SELECT 1 FROM public.teacher_students
            WHERE teacher_students.student_id = students.id
              AND teacher_students.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = teacher_id
        OR EXISTS (
            SELECT 1 FROM public.teacher_students
            WHERE teacher_students.student_id = students.id
              AND teacher_students.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can delete enrolled students"
    ON public.students FOR DELETE
    USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own classroom roster"
    ON public.teacher_students FOR ALL
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- 13. Storage Bucket & Upload Policies for Cropped Diagram Media
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagram-media', 'diagram-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Read Diagram Media" ON storage.objects;
    DROP POLICY IF EXISTS "Public Upload Diagram Media" ON storage.objects;
    DROP POLICY IF EXISTS "Public Update Diagram Media" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Teachers Upload Diagram Media" ON storage.objects;

    CREATE POLICY "Public Read Diagram Media"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'diagram-media');

    CREATE POLICY "Authenticated Teachers Upload Diagram Media"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'diagram-media'
            AND auth.role() IN ('authenticated', 'service_role')
        );
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped storage.objects policy creation (configure Storage policies in Supabase Dashboard if needed): %', SQLERRM;
END;
$$;

-- 14. Refresh Supabase PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
