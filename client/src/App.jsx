import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import InputDrawer from './components/InputPanel/InputDrawer';
import QuestionCatalogue from './components/Catalogue/QuestionCatalogue';
import FloatingMathPopover from './components/VisualMathEditor/FloatingMathPopover';
import PrintViewModal from './components/Common/PrintViewModal';
import LoadingSpinner from './components/Common/LoadingSpinner';
import AccessGateModal from './components/Common/AccessGateModal';
import StudentAuthModal from './components/Student/StudentAuthModal';
import StudentPortal from './components/Student/StudentPortal';
import TestIntroScreen from './components/Student/TestIntroScreen';
import TestQuestionView from './components/Student/TestQuestionView';
import TestReviewScreen from './components/Student/TestReviewScreen';
import TestResultScreen from './components/Student/TestResultScreen';
import ProctoringSecurityGuard from './components/Student/ProctoringSecurityGuard';
import SubmissionsDashboardModal from './components/TeacherDashboard/SubmissionsDashboardModal';
import PublishExamModal from './components/TeacherDashboard/PublishExamModal';
import StudentRosterTab from './components/TeacherDashboard/StudentRosterTab';
import {
  parseQuestionText,
  parseQuestionImage,
  parseDocxStructure,
  publishExam,
  fetchExamSnapshot,
  logoutTeacher,
  getStoredStudentProfile,
  logoutStudent
} from './services/apiService';
import { computeNeedsReview } from './services/reviewEvaluator';
import { GraduationCap, ArrowLeft, Terminal } from 'lucide-react';

const INITIAL_CATALOGUE = {
  testTitle: "Mathematics Practice Test",
  questions: [
    {
      id: "q_init_1",
      questionText: "Solve for <math>x</math>: <math>x^2 + 2x - 3 = 0</math>",
      type: "mcq",
      options: [
        "<math>x = 1, -3</math>",
        "<math>x = -1, 3</math>",
        "<math>x = 2, -3</math>",
        "<math>x = -2, 1</math>"
      ],
      correctAnswer: 0,
      mathSpans: ["x", "x^2 + 2x - 3 = 0"],
      confidenceScore: 0.98,
      needsReview: false
    },
    {
      id: "q_init_2",
      questionText: "Evaluate the definite integral: <math>\\int_{0}^{1} x^2 \\, dx</math>",
      type: "mcq",
      options: [
        "<math>\\frac{1}{3}</math>",
        "<math>\\frac{1}{2}</math>",
        "<math>1</math>",
        "<math>\\frac{2}{3}</math>"
      ],
      correctAnswer: 0,
      mathSpans: ["\\int_{0}^{1} x^2 \\, dx", "\\frac{1}{3}"],
      confidenceScore: 0.96,
      needsReview: false
    }
  ]
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('teacher_auth_token')));
  const [testTitle, setTestTitle] = useState(INITIAL_CATALOGUE.testTitle);
  const [questions, setQuestions] = useState(INITIAL_CATALOGUE.questions);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [isJustParsed, setIsJustParsed] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'roster'

  // URL parameters check
  const searchParams = new URLSearchParams(window.location.search);
  const isStudentUrl = searchParams.get('mode') === 'student';
  const targetTestId = searchParams.get('testId') || searchParams.get('examId');

  // Application View Mode
  const [viewMode, setViewMode] = useState(() => isStudentUrl ? 'student_portal' : 'teacher');
  const [studentUser, setStudentUser] = useState(() => getStoredStudentProfile());
  const [isDevDemo, setIsDevDemo] = useState(false);

  const [publishedExamInfo, setPublishedExamInfo] = useState(null);
  const [isFetchingExam, setIsFetchingExam] = useState(false);

  // Student Test Flow State Machine
  const [studentStep, setStudentStep] = useState('portal'); // 'portal' | 'intro' | 'test' | 'review' | 'result'
  const [rollingCodeUsed, setRollingCodeUsed] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [cheatingFlagged, setCheatingFlagged] = useState(false);
  const [cheatingReason, setCheatingReason] = useState('');

  const handleUpdateQuestionStatus = (qId, status) => {
    setQuestionStatuses(prev => ({
      ...prev,
      [qId]: status
    }));
  };

  const handleDisqualifyCheating = ({ cheatingFlagged, reason }) => {
    setCheatingFlagged(true);
    setCheatingReason(reason || 'Proctoring security violation');
    setStudentStep('result');
  };

  useEffect(() => {
    const savedPwd = localStorage.getItem('app_access_password');
    if (savedPwd) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleStudentAnswerChange = (questionId, value) => {
    const updated = { ...studentAnswers, [questionId]: value };
    setStudentAnswers(updated);
  };

  const handleClearStudentSession = () => {
    setStudentAnswers({});
    setQuestionStatuses({});
    setCheatingFlagged(false);
    setCheatingReason('');
  };

  // Popovers & Modals
  const [activeMathEdit, setActiveMathEdit] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const handleReset = () => {
    setTestTitle(INITIAL_CATALOGUE.testTitle);
    setQuestions(INITIAL_CATALOGUE.questions);
    setIsJustParsed(false);
    setActiveMathEdit(null);
  };

  const handleSubmitText = async (rawText) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setLoadingMessage('Extracting & typesetting math questions...');
    try {
      const parsed = await parseQuestionText(rawText);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      alert(`Parsing error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitImage = async (payload, mediaType) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setLoadingMessage('Transcribing photos & PDF document pages with AI Vision...');
    try {
      const parsed = await parseQuestionImage(payload, mediaType);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      alert(`Transcription error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDocx = async (docxStatus) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setLoadingMessage('Parsing Word OMML XML equations...');
    try {
      const parsed = await parseDocxStructure(docxStatus);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      alert(`Docx parsing error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDocxSample = () => {
    setTestTitle("Word OMML Document Test Paper");
    setQuestions([
      {
        id: "q_docx_sample_1",
        questionText: "Word Document Sample: Evaluate the integral <math>\\int_{0}^{1} x^2 \\, dx</math> and state its exact value.",
        type: "mcq",
        options: [
          "<math>\\frac{1}{3}</math>",
          "<math>\\frac{1}{2}</math>",
          "<math>1</math>",
          "<math>\\frac{2}{3}</math>"
        ],
        correctAnswer: 0,
        mathSpans: ["\\int_{0}^{1} x^2 \\, dx", "\\frac{1}{3}"],
        confidenceScore: 1.0,
        needsReview: false
      }
    ]);
    setIsJustParsed(true);
  };

  const handleUpdateQuestion = (questionId, updatedData) => {
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, ...updatedData } : q));
  };

  const handleDeleteQuestion = (questionId) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const handleDuplicateQuestion = (questionId) => {
    const targetIdx = questions.findIndex(q => q.id === questionId);
    if (targetIdx === -1) return;
    const target = questions[targetIdx];
    const duplicated = {
      ...target,
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      questionText: `${target.questionText} (Copy)`
    };
    const newQuestions = [...questions];
    newQuestions.splice(targetIdx + 1, 0, duplicated);
    setQuestions(newQuestions);
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}`,
      questionText: "New Question: Solve for <math>x</math>: <math>x + 5 = 10</math>",
      type: "mcq",
      options: [
        "<math>x = 5</math>",
        "<math>x = 10</math>",
        "<math>x = 15</math>",
        "<math>x = 0</math>"
      ],
      correctAnswer: 0,
      mathSpans: ["x + 5 = 10", "x = 5"],
      confidenceScore: 1.0,
      needsReview: false
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleSelectMathForEdit = (questionId, mathLatex) => {
    setActiveMathEdit({ questionId, mathLatex });
  };

  const handleSaveEditedMath = (oldLatex, newLatex) => {
    if (!activeMathEdit) return;

    const { questionId } = activeMathEdit;
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;

      let updatedStem = q.questionText;
      if (oldLatex) {
        updatedStem = updatedStem.replace(
          new RegExp(`<math>${escapeRegExp(oldLatex)}<\/math>`, 'g'),
          `<math>${newLatex}</math>`
        );
      }

      const updatedOptions = (q.options || []).map(opt => {
        if (oldLatex && opt.includes(oldLatex)) {
          return opt.replace(
            new RegExp(`<math>${escapeRegExp(oldLatex)}<\/math>`, 'g'),
            `<math>${newLatex}</math>`
          );
        }
        return opt;
      });

      return {
        ...q,
        questionText: updatedStem,
        options: updatedOptions,
        needsReview: false
      };
    }));

    setActiveMathEdit(null);
  };

  const handlePublishExam = async () => {
    const unreviewedQuestions = [];
    questions.forEach((q, idx) => {
      const evaluation = computeNeedsReview(q);
      if (evaluation.needsReview) {
        unreviewedQuestions.push({ index: idx + 1, reasons: evaluation.reasons });
      }
    });

    if (unreviewedQuestions.length > 0) {
      const details = unreviewedQuestions
        .map(u => `Question #${u.index}: ${u.reasons.join(', ')}`)
        .join('\n');
      alert(`Cannot publish exam paper yet!\n\nPlease review all numerical ranges and answer keys:\n\n${details}`);
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Publishing frozen exam snapshot...');
    try {
      const res = await publishExam({ testTitle, questions });
      if (res && res.examId) {
        setPublishedExamInfo({
          examId: res.examId,
          testTitle: res.testTitle,
          questionsCount: questions.length
        });
      }
    } catch (err) {
      alert(`Publish Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Student Exam Join Handler
  const handleStudentJoinExam = async (code) => {
    setRollingCodeUsed(code);
    setIsLoading(true);
    setLoadingMessage('Validating exam rolling code...');
    try {
      const studentName = studentUser?.full_name || studentUser?.fullName || 'Student Candidate';
      const response = await fetch('/api/exams/student-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          rollingCode: code,
          examId: targetTestId || undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired 6-Digit Rolling Passcode.');
      }

      if (data.exam) {
        if (data.exam.testTitle) setTestTitle(data.exam.testTitle);
        if (Array.isArray(data.exam.questions)) setQuestions(data.exam.questions);
        if (data.exam.id) setTargetTestId(data.exam.id);
      }
      setStudentStep('intro');
    } catch (err) {
      alert(`Error joining exam: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: STUDENT PORTAL MODE
  // -------------------------------------------------------------
  if (viewMode === 'student_portal') {
    // Unauthenticated student prompt (unless in Dev Demo mode)
    if (!studentUser && !isDevDemo) {
      return (
        <StudentAuthModal
          onStudentAuthenticated={(stu) => {
            setStudentUser(stu);
            setIsDevDemo(false);
          }}
          onLaunchDevDemo={() => {
            setIsDevDemo(true);
            setStudentUser({
              id: 'dev_demo_candidate',
              admission_number: 'DEMO-999',
              full_name: 'Developer Demo Candidate'
            });
          }}
        />
      );
    }

    const currentStudentName = isDevDemo
      ? '[Dev Demo] Developer Candidate'
      : (studentUser ? (studentUser.full_name || studentUser.fullName) : 'Student Candidate');

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
        />
      );
    }

    const isExamActive = !cheatingFlagged && (studentStep === 'test' || studentStep === 'review');

    if (studentStep === 'test') {
      return (
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
            onAnswerChange={handleStudentAnswerChange}
            onUpdateQuestionStatus={handleUpdateQuestionStatus}
            onSelectQuestion={(idx) => setCurrentQuestionIndex(idx)}
            onNext={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
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
            setViewMode('teacher');
          }}
        />
      );
    }

    // Default Student Portal View
    return (
      <div className="min-h-screen bg-[#f7f3ed]">
        {/* Dev Mode Top Banner */}
        {isDevDemo && (
          <div className="bg-purple-900 text-purple-100 px-4 py-2 text-xs font-mono font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-300" />
              <span>DEV DEMO EXAM MODE (No Account Required • Submissions Sent to Teacher Dashboard)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDevDemo(false)}
              className="text-xs bg-purple-800 hover:bg-purple-700 text-white px-2.5 py-1 rounded-md"
            >
              Exit Dev Demo
            </button>
          </div>
        )}

        {/* Back to Teacher Dashboard Button */}
        <div className="max-w-5xl mx-auto p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={() => setViewMode('teacher')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#e2d8ca] text-xs font-bold text-[#4a4237] hover:bg-[#faf7f2] shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-[#8c4a17]" />
            <span>Switch to Teacher Mode</span>
          </button>
        </div>

        <StudentPortal
          student={studentUser || { full_name: 'Developer Candidate', admission_number: 'DEMO-999' }}
          onJoinExam={handleStudentJoinExam}
          onLogout={() => {
            logoutStudent();
            setStudentUser(null);
            setIsDevDemo(false);
          }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: TEACHER MODE (Default)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh bg-[#1c1b18] flex items-center justify-center p-4 font-sans">
        <AccessGateModal onAuthenticated={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f7f4ee] flex flex-col font-sans">
      <Navbar
        onReset={handleReset}
        onOpenPrintView={() => setShowPrintModal(true)}
        onOpenSubmissions={() => setShowSubmissionsModal(true)}
        onOpenRoster={() => setActiveTab('roster')}
        onSwitchToStudentPortal={() => setViewMode('student_portal')}
        onPublishExam={handlePublishExam}
        onLogout={() => {
          logoutTeacher();
          setIsAuthenticated(false);
        }}
        onScrollToInput={() => {
          const drawer = document.getElementById('input-drawer-container');
          if (drawer) drawer.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Mode Switch Bar: Catalogue vs Student Roster */}
      <div className="bg-[#f0e6d8] border-b border-[#e2d8ca] px-4 sm:px-6 py-2 mode-switch-bar print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('catalogue')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'catalogue'
                  ? 'bg-white text-[#8c4a17] shadow-2xs'
                  : 'text-[#6b6255] hover:text-[#2c2825]'
              }`}
            >
              Question Catalogue & Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'roster'
                  ? 'bg-white text-[#8c4a17] shadow-2xs'
                  : 'text-[#6b6255] hover:text-[#2c2825]'
              }`}
            >
              Student Roster & Credentials
            </button>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('student_portal')}
            className="flex items-center gap-1 text-xs font-bold text-[#8c4a17] hover:underline"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Open Student Portal</span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 sm:pb-8 space-y-6 sm:space-y-8">
        {activeTab === 'roster' ? (
          <StudentRosterTab />
        ) : (
          <>
            <div id="input-drawer-container">
              <InputDrawer
                onSubmitText={handleSubmitText}
                onSubmitImage={handleSubmitImage}
                onSubmitDocx={handleSubmitDocx}
                isLoading={isLoading}
                onLoadDocxSample={handleLoadDocxSample}
              />
            </div>

            {isLoading ? (
              <LoadingSpinner message={loadingMessage} />
            ) : (
              <QuestionCatalogue
                testTitle={testTitle}
                questions={questions}
                onUpdateTestTitle={setTestTitle}
                onUpdateQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onDuplicateQuestion={handleDuplicateQuestion}
                onAddQuestion={handleAddQuestion}
                onSelectMathForEdit={handleSelectMathForEdit}
                isJustParsed={isJustParsed}
              />
            )}
          </>
        )}
      </main>

      {activeMathEdit && (
        <FloatingMathPopover
          activeMath={activeMathEdit.mathLatex}
          onSave={handleSaveEditedMath}
          onClose={() => setActiveMathEdit(null)}
        />
      )}

      {showPrintModal && (
        <PrintViewModal
          testTitle={testTitle}
          questions={questions}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {showSubmissionsModal && (
        <SubmissionsDashboardModal
          onClose={() => setShowSubmissionsModal(false)}
        />
      )}

      {publishedExamInfo && (
        <PublishExamModal
          examId={publishedExamInfo.examId}
          testTitle={publishedExamInfo.testTitle}
          questionsCount={publishedExamInfo.questionsCount}
          onClose={() => setPublishedExamInfo(null)}
        />
      )}
    </div>
  );
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
