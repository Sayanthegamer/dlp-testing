import React, { useState } from 'react';
import StudentAuthModal from './StudentAuthModal';
import StudentPortal from './StudentPortal';
import StudentErrorBoundary from './StudentErrorBoundary';
import TestIntroScreen from './TestIntroScreen';
import TestQuestionView from './TestQuestionView';
import TestReviewScreen from './TestReviewScreen';
import TestResultScreen from './TestResultScreen';
import ProctoringSecurityGuard from './ProctoringSecurityGuard';
import { logoutStudent } from '../../services/apiService';
import { ArrowLeft, AlertTriangle, X } from 'lucide-react';

/**
 * Dedicated Student Examination Shell
 * Coordinates student sign-in, session code entry, proctored test-taking, review, and scorecard results.
 */
export default function StudentExamShell({
  studentUser,
  onSetStudentUser,
  isDevDemo,
  onSetIsDevDemo,
  studentAuthInitialTab = 'login',
  studentAuthClassCode = '',
  targetTestId,
  onSetTargetTestId,
  publishedExamInfo,
  testTitle,
  onSetTestTitle,
  questions,
  onSetQuestions,
  sanitizeQuestionsList,
  onBackToRoleGate,
  onSwitchToTeacher,
}) {
  const [studentStep, setStudentStep] = useState('portal'); // 'portal' | 'intro' | 'test' | 'review' | 'result'
  const [rollingCodeUsed, setRollingCodeUsed] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [cheatingFlagged, setCheatingFlagged] = useState(false);
  const [cheatingReason, setCheatingReason] = useState('');
  const [notice, setNotice] = useState(null);

  const handleClearStudentSession = () => {
    setStudentAnswers({});
    setQuestionStatuses({});
    setCheatingFlagged(false);
    setCheatingReason('');
  };

  const handleDisqualifyCheating = ({ reason }) => {
    setCheatingFlagged(true);
    setCheatingReason(reason || 'Proctoring security violation');
    setStudentStep('result');
  };

  const handleStudentJoinExam = async (code) => {
    setRollingCodeUsed(code);
    setNotice(null);
    try {
      const studentName = studentUser?.full_name || studentUser?.fullName || 'Candidate';
      const headers = { 'Content-Type': 'application/json' };
      const studentToken =
        typeof window !== 'undefined' ? localStorage.getItem('student_auth_token') : null;
      if (studentToken) {
        headers['Authorization'] = `Bearer ${studentToken}`;
      }
      const response = await fetch('/api/exams/student-access', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          studentName,
          studentId: studentUser?.id,
          rollingCode: code,
          examId: targetTestId || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired 6-digit rolling passcode');
      }

      let examObj = data.exam;
      if (typeof examObj === 'string') {
        try {
          examObj = JSON.parse(examObj);
        } catch (_) {}
      }

      if (examObj) {
        if (examObj.testTitle) onSetTestTitle(examObj.testTitle);
        const qList = Array.isArray(examObj.questions)
          ? examObj.questions
          : examObj.snapshot_data?.questions || [];
        if (Array.isArray(qList) && qList.length > 0) {
          onSetQuestions(sanitizeQuestionsList(qList));
        }
        if (examObj.id) onSetTargetTestId(examObj.id);
      }
      handleClearStudentSession();
      setStudentStep('intro');
    } catch (err) {
      setNotice({ type: 'error', title: err.message });
    }
  };

  if (!studentUser && !isDevDemo) {
    return (
      <StudentAuthModal
        initialTab={studentAuthInitialTab}
        initialClassCode={studentAuthClassCode}
        onStudentAuthenticated={(stu) => {
          onSetStudentUser(stu);
          onSetIsDevDemo(false);
        }}
        onBackToTeacher={onSwitchToTeacher}
        onBackToPortalChooser={onBackToRoleGate}
        onLaunchDevDemo={() => {
          onSetIsDevDemo(true);
          onSetStudentUser({
            id: 'dev_demo_candidate',
            admission_number: 'DLP-26-DEMO',
            full_name: 'Arjun Sen',
            dob: '2008-05-14',
          });
        }}
      />
    );
  }

  const currentStudentName = isDevDemo
    ? 'Arjun Sen (Sample)'
    : studentUser
    ? studentUser.full_name || studentUser.fullName
    : 'Candidate';

  if (studentStep === 'intro') {
    return (
      <TestIntroScreen
        testTitle={testTitle}
        questionCount={questions.length}
        studentName={currentStudentName}
        onStartTest={() => {
          setStudentStep('test');
          setCurrentQuestionIndex(0);
        }}
        onCancel={() => setStudentStep('portal')}
      />
    );
  }

  const isExamActive = !cheatingFlagged && (studentStep === 'test' || studentStep === 'review');

  if (studentStep === 'test') {
    return (
      <StudentErrorBoundary>
        <div className="relative min-h-screen">
          <ProctoringSecurityGuard
            isActive={isExamActive}
            onDisqualifyCheating={handleDisqualifyCheating}
            studentName={currentStudentName}
          />
          <TestQuestionView
            questions={questions}
            currentIndex={currentQuestionIndex}
            answers={studentAnswers}
            questionStatuses={questionStatuses}
            onAnswerChange={(qId, value) =>
              setStudentAnswers((prev) => ({ ...prev, [qId]: value }))
            }
            onUpdateQuestionStatus={(qId, status) =>
              setQuestionStatuses((prev) => ({ ...prev, [qId]: status }))
            }
            onSelectQuestion={(idx) => setCurrentQuestionIndex(idx)}
            onNext={() =>
              setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
            }
            onPrevious={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            onReview={() => setStudentStep('review')}
            onSubmitExam={() => setStudentStep('review')}
            onDisqualifyCheating={handleDisqualifyCheating}
            cheatingFlagged={cheatingFlagged}
            studentName={currentStudentName}
            examId={targetTestId || publishedExamInfo?.examId}
            rollingCode={rollingCodeUsed}
          />
        </div>
      </StudentErrorBoundary>
    );
  }

  if (studentStep === 'review') {
    return (
      <div className="relative min-h-screen">
        <ProctoringSecurityGuard
          isActive={isExamActive}
          onDisqualifyCheating={handleDisqualifyCheating}
          studentName={currentStudentName}
        />
        <TestReviewScreen
          questions={questions}
          answers={studentAnswers}
          onJumpToQuestion={(idx) => {
            setCurrentQuestionIndex(idx);
            setStudentStep('test');
          }}
          onSubmitTest={() => setStudentStep('result')}
        />
      </div>
    );
  }

  if (studentStep === 'result') {
    return (
      <TestResultScreen
        examId={targetTestId || publishedExamInfo?.examId || 'exam_default'}
        rollingCodeUsed={rollingCodeUsed}
        studentId={studentUser?.id}
        isDevDemo={isDevDemo}
        questions={questions}
        studentAnswers={studentAnswers}
        studentName={currentStudentName}
        testTitle={testTitle}
        cheatingFlagged={cheatingFlagged}
        cheatingReason={cheatingReason}
        onRestartTest={() => {
          handleClearStudentSession();
          setStudentStep('portal');
        }}
        onExitStudentMode={() => {
          handleClearStudentSession();
          setStudentStep('portal');
          onSwitchToTeacher();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper-200 font-sans text-exam-ink">
      {isDevDemo && (
        <div className="bg-exam-ink text-exam-card px-4 py-2 text-xs font-mono flex items-center justify-between border-b border-exam-border">
          <span>Sample practice mode — explore how students take an assessment</span>
          <button
            type="button"
            onClick={() => {
              onSetIsDevDemo(false);
              onSetStudentUser(null);
            }}
            className="text-xs bg-exam-secondary/40 hover:bg-exam-secondary/60 text-exam-card px-2.5 py-1 rounded-sm transition-calm"
          >
            Exit sample
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToRoleGate}
            className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-exam-card border border-exam-border text-sm font-medium text-exam-secondary hover:text-exam-ink transition-calm"
          >
            <ArrowLeft className="w-4 h-4 text-exam-muted" strokeWidth={1.5} />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToTeacher}
            className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-exam-card border border-exam-border text-sm font-medium text-exam-secondary hover:text-exam-ink transition-calm"
          >
            <span>Teacher sign in</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3">
          <div className="p-3.5 rounded-lg bg-exam-card border border-exam-warn text-sm text-exam-ink flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-exam-warn shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="font-medium text-exam-ink">{notice.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-exam-muted hover:text-exam-ink"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <StudentPortal
        student={
          studentUser || {
            full_name: 'Arjun Sen',
            admission_number: 'DLP-26-DEMO',
            dob: '2008-05-14',
          }
        }
        onJoinExam={handleStudentJoinExam}
        onPreviewCurrentPaper={() => setStudentStep('intro')}
        onLogout={() => {
          logoutStudent();
          onSetStudentUser(null);
          onSetIsDevDemo(false);
          onBackToRoleGate();
        }}
      />
    </div>
  );
}
