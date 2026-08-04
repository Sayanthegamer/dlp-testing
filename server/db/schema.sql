-- =======================================================
-- Supabase PostgreSQL Schema for Tuition Test Platform
-- =======================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Teachers / Profiles Table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Exams Table (Metadata & Published Snapshots)
CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject TEXT DEFAULT 'Mathematics',
    grade TEXT DEFAULT 'JEE Advanced',
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'published', 'closed', 'archived')),
    needs_review BOOLEAN DEFAULT FALSE,
    question_count INTEGER DEFAULT 0,
    snapshot_data JSONB, -- Published question snapshot payload
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
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    rolling_code TEXT NOT NULL, -- Active 6-digit rolling code
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Student Submissions & Auto-Graded Scores Table
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    rolling_code_used TEXT,
    total_score NUMERIC(5,2) DEFAULT 0.00,
    max_possible NUMERIC(5,2) DEFAULT 0.00,
    percentage NUMERIC(5,2) DEFAULT 0.00,
    time_taken_seconds INTEGER DEFAULT 0,
    responses JSONB NOT NULL, -- Detailed student answers & question-by-question marks
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Fast Query Performance
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_rolling ON exam_sessions(exam_id, rolling_code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON submissions(exam_id);

-- Enable Row Level Security (RLS)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Teacher Isolation & Public Student Access to Sessions)
-- 1. Teachers Policies
CREATE POLICY "Teachers can view and update own profile" 
    ON teachers FOR ALL USING (auth.uid() = id);

-- 2. Exams Policies
CREATE POLICY "Teachers can manage own exams" 
    ON exams FOR ALL USING (auth.uid() = teacher_id OR teacher_id IS NULL);

-- 3. Questions Policies
CREATE POLICY "Teachers can manage own exam questions" 
    ON questions FOR ALL USING (
        EXISTS (SELECT 1 FROM exams WHERE exams.id = questions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    );

-- 4. Active Sessions Public Access Policy
CREATE POLICY "Public student access for active sessions" 
    ON exam_sessions FOR SELECT USING (is_active = TRUE);

-- 5. Submissions Policy
CREATE POLICY "Public student submissions insert" 
    ON submissions FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Teachers view submissions for own exams" 
    ON submissions FOR SELECT USING (
        EXISTS (SELECT 1 FROM exams WHERE exams.id = submissions.exam_id AND (exams.teacher_id = auth.uid() OR exams.teacher_id IS NULL))
    );
