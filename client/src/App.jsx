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
import StudentErrorBoundary from './components/Student/StudentErrorBoundary';
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
  logoutTeacher,
  getStoredStudentProfile,
  logoutStudent
} from './services/apiService';
import { computeNeedsReview } from './services/reviewEvaluator';
import { ArrowLeft, Terminal, AlertTriangle, CheckCircle2, X } from 'lucide-react';

const INITIAL_CATALOGUE = {
  testTitle: "Higher Secondary Mathematics — Unit Assessment",
  questions: [
    {
      id: "q_init_1",
      questionText: "Find all real roots of the quadratic equation <math>x^2 + 2x - 3 = 0</math>.",
      type: "mcq",
      options: [
        "<math>x = 1, -3</math>",
        "<math>x = -1, 3</math>",
        "<math>x = 2, -3</math>",
        "<math>x = -2, 1</math>"
      ],
      correctAnswer: 0,
      mathSpans: ["x^2 + 2x - 3 = 0", "x = 1, -3"],
      confidenceScore: 0.98,
      needsReview: false
    },
    {
      id: "q_init_2",
      questionText: "Evaluate the definite integral <math>\\int_{0}^{1} (3x^2 + 1) \\, dx</math>.",
      type: "short_answer_numeric",
      options: [],
      correctAnswer: 2,
      acceptedRange: [1.98, 2.02],
      numericalConfirmed: true,
      mathSpans: ["\\int_{0}^{1} (3x^2 + 1) \\, dx"],
      confidenceScore: 0.97,
      needsReview: false
    }
  ]
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('teacher_auth_token')));
  const [testTitle, setTestTitle] = useState(INITIAL_CATALOGUE.testTitle);
  const [questions, setQuestions] = useState(INITIAL_CATALOGUE.questions);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Typesetting questions');
  const [isJustParsed, setIsJustParsed] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'roster'
  const [notice, setNotice] = useState(null); // { type: 'error' | 'info', title: string, details?: string[] }

  const searchParams = new URLSearchParams(window.location.search);
  const isStudentUrl = searchParams.get('mode') === 'student';
  const [targetTestId, setTargetTestId] = useState(() => searchParams.get('testId') || searchParams.get('examId') || '');

  const [viewMode, setViewMode] = useState(() => isStudentUrl ? 'student_portal' : 'teacher');
  const [studentUser, setStudentUser] = useState(() => getStoredStudentProfile());
  const [isDevDemo, setIsDevDemo] = useState(false);

  const [publishedExamInfo, setPublishedExamInfo] = useState(null);

  // Student Test Flow State Machine
  const [studentStep, setStudentStep] = useState('portal'); // 'portal' | 'intro' | 'test' | 'review' | 'result'
  const [rollingCodeUsed, setRollingCodeUsed] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [cheatingFlagged, setCheatingFlagged] = useState(false);
  const [cheatingReason, setCheatingReason] = useState('');

  const showBanner = (type, title, details = []) => {
    setNotice({ type, title, details });
  };

  const handleUpdateQuestionStatus = (qId, status) => {
    setQuestionStatuses(prev => ({
      ...prev,
      [qId]: status
    }));
  };

  const handleDisqualifyCheating = ({ reason }) => {
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
    setStudentAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleClearStudentSession = () => {
    setStudentAnswers({});
    setQuestionStatuses({});
    setCheatingFlagged(false);
    setCheatingReason('');
  };

  const [activeMathEdit, setActiveMathEdit] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const handleReset = () => {
    setTestTitle(INITIAL_CATALOGUE.testTitle);
    setQuestions(INITIAL_CATALOGUE.questions);
    setIsJustParsed(false);
    setActiveMathEdit(null);
    setNotice(null);
  };

  const handleSubmitText = async (rawText) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setNotice(null);
    setLoadingMessage('Extracting and typesetting math questions');
    try {
      const parsed = await parseQuestionText(rawText);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      showBanner('error', `Could not parse text: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitImage = async (payload, mediaType) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setNotice(null);
    setLoadingMessage('Transcribing document pages and extracting diagrams');
    try {
      const parsed = await parseQuestionImage(payload, mediaType);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      showBanner('error', `Could not transcribe document: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDocx = async (docxStatus) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setNotice(null);
    setLoadingMessage('Converting Word OMML equations');
    try {
      const parsed = await parseDocxStructure(docxStatus);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      showBanner('error', `Could not process Word document: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDocxSample = () => {
    setTestTitle("Word OMML Calculus Paper");
    setQuestions([
      {
        id: "q_docx_sample_1",
        questionText: "Evaluate the definite integral <math>\\int_{0}^{1} x^2 \\, dx</math> and select the exact value.",
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
    setNotice(null);
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
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      questionText: `${target.questionText}`
    };
    const newQuestions = [...questions];
    newQuestions.splice(targetIdx + 1, 0, duplicated);
    setQuestions(newQuestions);
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}`,
      questionText: "Solve for <math>x</math> in the linear equation <math>2x + 5 = 17</math>.",
      type: "mcq",
      options: [
        "<math>x = 6</math>",
        "<math>x = 5</math>",
        "<math>x = 11</math>",
        "<math>x = 4</math>"
      ],
      correctAnswer: null,
      mathSpans: ["x", "2x + 5 = 17", "x = 6"],
      confidenceScore: 1.0,
      needsReview: true
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
          new RegExp(`<math>${escapeRegExp(oldLatex)}<\\/math>`, 'g'),
          `<math>${newLatex}</math>`
        );
      }

      const updatedOptions = (q.options || []).map(opt => {
        if (oldLatex && opt.includes(oldLatex)) {
          return opt.replace(
            new RegExp(`<math>${escapeRegExp(oldLatex)}<\\/math>`, 'g'),
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
        unreviewedQuestions.push(`Question ${idx + 1}: ${evaluation.reasons.join(', ')}`);
      }
    });

    if (unreviewedQuestions.length > 0) {
      showBanner(
        'error',
        'Complete question review before publishing the exam paper',
        unreviewedQuestions
      );
      return;
    }

    setNotice(null);
    setIsLoading(true);
    setLoadingMessage('Publishing frozen exam snapshot');
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
      showBanner('error', `Could not publish exam: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentJoinExam = async (code) => {
    setRollingCodeUsed(code);
    setIsLoading(true);
    setNotice(null);
    setLoadingMessage('Validating 6-digit rolling passcode');
    try {
      const studentName = studentUser?.full_name || studentUser?.fullName || 'Candidate';
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
        throw new Error(data.error || 'Invalid or expired 6-digit rolling passcode');
      }

      let examObj = data.exam;
      if (typeof examObj === 'string') {
        try { examObj = JSON.parse(examObj); } catch (_) {}
      }

      if (examObj) {
        if (examObj.testTitle) setTestTitle(examObj.testTitle);
        const qList = Array.isArray(examObj.questions) ? examObj.questions : (examObj.snapshot_data?.questions || []);
        if (Array.isArray(qList) && qList.length > 0) {
          setQuestions(qList);
        }
        if (examObj.id) setTargetTestId(examObj.id);
      }
      setStudentStep('intro');
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: STUDENT PORTAL MODE
  // -------------------------------------------------------------
  if (viewMode === 'student_portal') {
    if (!studentUser && !isDevDemo) {
      return (
        <StudentAuthModal
          onStudentAuthenticated={(stu) => {
            setStudentUser(stu);
            setIsDevDemo(false);
          }}
          onBackToTeacher={() => setViewMode('teacher')}
          onLaunchDevDemo={() => {
            setIsDevDemo(true);
            setStudentUser({
              id: 'dev_demo_candidate',
              admission_number: 'DLP-26-DEMO',
              full_name: 'Arjun Sen',
              dob: '2008-05-14'
            });
          }}
        />
      );
    }

    const currentStudentName = isDevDemo
      ? 'Arjun Sen (Demo)'
      : (studentUser ? (studentUser.full_name || studentUser.fullName) : 'Candidate');

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
            setViewMode('teacher');
          }}
        />
      );
    }

    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        {isDevDemo && (
          <div className="bg-[#1f1b16] text-[#fdfbf7] px-4 py-2 text-xs font-mono flex items-center justify-between border-b border-[#dcd5c4]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#8a847a]" strokeWidth={1.5} />
              <span>Demo candidate mode — submissions appear in teacher grading</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDevDemo(false)}
              className="text-xs bg-[#262421] hover:bg-[#332d25] text-[#fdfbf7] px-2.5 py-1 rounded-md transition-calm"
            >
              Exit demo
            </button>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 flex justify-between items-center">
          <button
            type="button"
            onClick={() => setViewMode('teacher')}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] text-xs font-medium text-[#5e554a] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
            <span>Return to teacher studio</span>
          </button>
        </div>

        {notice && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3">
            <div className="p-3.5 rounded-xl bg-[#fdfbf7] border border-[#b8622e] text-xs text-[#1f1b16] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#b8622e] shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="font-medium text-[#1f1b16]">{notice.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-[#7b7266] hover:text-[#1f1b16]"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        <StudentPortal
          student={studentUser || { full_name: 'Arjun Sen', admission_number: 'DLP-26-DEMO', dob: '2008-05-14' }}
          onJoinExam={handleStudentJoinExam}
          onPreviewCurrentPaper={() => setStudentStep('intro')}
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
      <div className="min-h-dvh bg-[#161513] flex items-center justify-center p-4 font-sans">
        <AccessGateModal onAuthenticated={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f7f4ee] flex flex-col font-sans text-[#1f1b16]">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onReset={handleReset}
        onOpenPrintView={() => setShowPrintModal(true)}
        onOpenSubmissions={() => setShowSubmissionsModal(true)}
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-12 space-y-6">
        {notice && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
              notice.type === 'error'
                ? 'bg-[#fdfbf7] border-[#b8622e] text-[#1f1b16]'
                : 'bg-[#fdfbf7] border-[#3f6b4a] text-[#1f1b16]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {notice.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-[#b8622e] shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#3f6b4a] shrink-0 mt-0.5" strokeWidth={1.5} />
              )}
              <div className="space-y-1 text-xs">
                <p className="font-medium text-sm text-[#1f1b16]">{notice.title}</p>
                {Array.isArray(notice.details) && notice.details.length > 0 && (
                  <ul className="list-disc list-inside text-[#5e554a] space-y-0.5 pt-1">
                    {notice.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-1 rounded-md text-[#7b7266] hover:text-[#1f1b16] hover:bg-[#efe9df]"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

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
