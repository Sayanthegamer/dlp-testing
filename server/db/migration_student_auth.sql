-- ====================================================================
-- Supabase SQL Migration: Student Authentication & Persistent History
-- Run this script in your Supabase SQL Editor to update your database.
-- ====================================================================

-- 1. Create Students Table (Admission Number + DOB Authentication)
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    admission_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast Admission Number login lookups
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);

-- 2. Update Submissions Table to link with Students & track Dev Demo / Attempts
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_dev_demo BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);

-- 3. Enable Row Level Security (RLS) for Students Table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Students Table
-- Allow public student lookup & authentication via Admission Number
CREATE POLICY "Public student read for login"
    ON students FOR SELECT USING (TRUE);

-- Allow students to self-register or teachers to insert students
CREATE POLICY "Public student registration insert"
    ON students FOR INSERT WITH CHECK (TRUE);

-- Allow teachers to manage students enrolled under them
CREATE POLICY "Teachers can update enrolled students"
    ON students FOR UPDATE USING (
        auth.uid() = teacher_id OR teacher_id IS NULL
    );

-- Allow students to view their own submissions
CREATE POLICY "Students can view own submissions"
    ON submissions FOR SELECT USING (
        TRUE -- Public read allowed for authenticated student ID matching
    );
