import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import InputDrawer from './components/InputPanel/InputDrawer';
import QuestionCatalogue from './components/Catalogue/QuestionCatalogue';
import FloatingMathPopover from './components/VisualMathEditor/FloatingMathPopover';
import PrintViewModal from './components/Common/PrintViewModal';
import LoadingSpinner from './components/Common/LoadingSpinner';
import AccessGateModal from './components/Common/AccessGateModal';
import StudentAccessGateModal from './components/Student/StudentAccessGateModal';
import StudentNameCapture from './components/Student/StudentNameCapture';
import TestIntroScreen from './components/Student/TestIntroScreen';
import TestQuestionView from './components/Student/TestQuestionView';
import TestReviewScreen from './components/Student/TestReviewScreen';
import TestResultScreen from './components/Student/TestResultScreen';
import SubmissionsDashboardModal from './components/TeacherDashboard/SubmissionsDashboardModal';
import PublishExamModal from './components/TeacherDashboard/PublishExamModal';
import { parseQuestionText, parseQuestionImage, parseDocxStructure, publishExam, fetchExamSnapshot } from './services/apiService';
import { computeNeedsReview } from './services/reviewEvaluator';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [testTitle, setTestTitle] = useState(INITIAL_CATALOGUE.testTitle);
  const [questions, setQuestions] = useState(INITIAL_CATALOGUE.questions);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [isJustParsed, setIsJustParsed] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);

  // Mode Switch Detection: ?mode=student & ?testId=exam_...
  const searchParams = new URLSearchParams(window.location.search);
  const isStudentMode = searchParams.get('mode') === 'student';
  const targetTestId = searchParams.get('testId');

  const [publishedExamInfo, setPublishedExamInfo] = useState(null);
  const [isFetchingExam, setIsFetchingExam] = useState(false);
  const [examFetchError, setExamFetchError] = useState(null);

  // Fetch published frozen exam snapshot if testId query param exists
  useEffect(() => {
    if (isStudentMode && targetTestId) {
      let isMounted = true;
      async function loadSnapshot() {
        setIsFetchingExam(true);
        setExamFetchError(null);
        try {
          const res = await fetchExamSnapshot(targetTestId);
          if (isMounted && res && res.exam) {
            setTestTitle(res.exam.testTitle);
            setQuestions(res.exam.questions);
          }
        } catch (err) {
          if (isMounted) {
            setExamFetchError(err.message || 'Exam paper snapshot not found or link has expired.');
          }
        } finally {
          if (isMounted) setIsFetchingExam(false);
        }
      }
      loadSnapshot();
      return () => { isMounted = false; };
    }
  }, [isStudentMode, targetTestId]);

  // Student Flow State Machine
  const [isStudentAuthenticated, setIsStudentAuthenticated] = useState(false);
  const [studentStep, setStudentStep] = useState('name'); // 'name' | 'intro' | 'test' | 'review' | 'result'
  const [studentName, setStudentName] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});

  // Check stored auth on load
  useEffect(() => {
    const savedPwd = localStorage.getItem('app_access_password');
    if (savedPwd) {
      setIsAuthenticated(true);
    }

    const savedStudentPwd = localStorage.getItem('student_access_password');
    if (savedStudentPwd) {
      setIsStudentAuthenticated(true);
    }
  }, []);

  // Restore student in-progress answers from sessionStorage
  useEffect(() => {
    if (isStudentMode) {
      try {
        const sessionKey = `student_answers_${testTitle}`;
        const savedSession = sessionStorage.getItem(sessionKey);
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed && typeof parsed === 'object') {
            setStudentAnswers(parsed);
          }
        }
      } catch (e) {
        console.warn('Could not restore sessionStorage answers:', e);
      }
    }
  }, [isStudentMode, testTitle]);

  // Mirror student answers to sessionStorage
  const handleStudentAnswerChange = (questionId, value) => {
    const updated = { ...studentAnswers, [questionId]: value };
    setStudentAnswers(updated);
    try {
      const sessionKey = `student_answers_${testTitle}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save to sessionStorage:', e);
    }
  };

  const handleClearStudentSession = () => {
    setStudentAnswers({});
    try {
      const sessionKey = `student_answers_${testTitle}`;
      sessionStorage.removeItem(sessionKey);
    } catch (e) {}
  };

  // Floating Math Popover state
  const [activeMathEdit, setActiveMathEdit] = useState(null); // { questionId, mathLatex }
  
  // Print Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Reset catalogue
  const handleReset = () => {
    setTestTitle(INITIAL_CATALOGUE.testTitle);
    setQuestions(INITIAL_CATALOGUE.questions);
    setIsJustParsed(false);
    setActiveMathEdit(null);
  };

  // Process imported text
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

  // Process imported photo
  const handleSubmitImage = async (imageBase64, mediaType) => {
    setIsLoading(true);
    setIsJustParsed(false);
    setLoadingMessage('Transcribing test page photo with AI Vision...');
    try {
      const parsed = await parseQuestionImage(imageBase64, mediaType);
      if (parsed.questions && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        if (parsed.testTitle) setTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      alert(`Image transcription error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Process imported docx
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

  // Load Docx Sample
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

  // Catalogue mutation handlers
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

  // Trigger floating math popover editor for a specific question
  const handleSelectMathForEdit = (questionId, mathLatex) => {
    setActiveMathEdit({ questionId, mathLatex });
  };

  // Save updated formula from Floating Math Popover
  const handleSaveEditedMath = (oldLatex, newLatex) => {
    if (!activeMathEdit) return;

    const { questionId } = activeMathEdit;
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;

      // Replace in question stem
      let updatedStem = q.questionText;
      if (oldLatex) {
        updatedStem = updatedStem.replace(
          new RegExp(`<math>${escapeRegExp(oldLatex)}<\/math>`, 'g'),
          `<math>${newLatex}</math>`
        );
      }

      // Replace in options
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

  // Handle Publish Exam snapshot
  const handlePublishExam = async () => {
    // Validate that all questions are confirmed and ready
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
      alert(`Cannot publish exam paper yet!\n\nPlease review and confirm all numerical ranges and answer keys before publishing:\n\n${details}`);
      
      const firstUnreviewedIdx = unreviewedQuestions[0].index - 1;
      const cardElem = document.getElementById(`question-card-${firstUnreviewedIdx}`);
      if (cardElem) {
        cardElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

  // Render Student Flow if ?mode=student query param is present
  if (isStudentMode) {
    if (isFetchingExam) {
      return (
        <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6 text-center font-sans">
          <LoadingSpinner message="Loading published examination paper..." />
        </div>
      );
    }

    if (examFetchError) {
      return (
        <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white border border-[#dcd2c4] rounded-3xl p-8 max-w-md w-full shadow-lg space-y-4">
            <h2 className="font-serif font-bold text-xl text-red-700">Exam Paper Not Found</h2>
            <p className="text-xs text-gray-600">{examFetchError}</p>
            <button
              type="button"
              onClick={() => window.location.href = window.location.pathname}
              className="px-5 py-2.5 rounded-xl bg-[#2c2825] hover:bg-[#1c1b18] text-white text-xs font-semibold shadow-xs"
            >
              Return to Main Portal
            </button>
          </div>
        </div>
      );
    }

    if (!isStudentAuthenticated) {
      return (
        <StudentAccessGateModal
          onAuthenticated={() => setIsStudentAuthenticated(true)}
        />
      );
    }

    if (studentStep === 'name') {
      return (
        <StudentNameCapture
          defaultName={studentName}
          onNameSubmit={(name) => {
            setStudentName(name);
            setStudentStep('intro');
          }}
        />
      );
    }

    if (studentStep === 'intro') {
      return (
        <TestIntroScreen
          testTitle={testTitle}
          questionCount={questions.length}
          studentName={studentName}
          onStartTest={() => {
            setStudentStep('test');
            setCurrentQuestionIndex(0);
          }}
        />
      );
    }

    if (studentStep === 'test') {
      return (
        <TestQuestionView
          questions={questions}
          currentIndex={currentQuestionIndex}
          answers={studentAnswers}
          onAnswerChange={handleStudentAnswerChange}
          onNext={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
          onPrevious={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          onReview={() => setStudentStep('review')}
          studentName={studentName}
        />
      );
    }

    if (studentStep === 'review') {
      return (
        <TestReviewScreen
          questions={questions}
          answers={studentAnswers}
          onJumpToQuestion={(idx) => {
            setCurrentQuestionIndex(idx);
            setStudentStep('test');
          }}
          onSubmitTest={() => setStudentStep('result')}
        />
      );
    }

    if (studentStep === 'result') {
      return (
        <TestResultScreen
          questions={questions}
          studentAnswers={studentAnswers}
          studentName={studentName}
          testTitle={testTitle}
          onRestartTest={() => {
            handleClearStudentSession();
            setStudentStep('intro');
          }}
          onExitStudentMode={() => {
            window.location.href = window.location.pathname;
          }}
        />
      );
    }
  }

  // Teacher Catalogue Mode (Default)
  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        onReset={handleReset}
        onOpenPrintView={() => setShowPrintModal(true)}
        onOpenSubmissions={() => setShowSubmissionsModal(true)}
        onPublishExam={handlePublishExam}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 print:hidden">
        
        {/* Top Import Drawer */}
        <InputDrawer
          onSubmitText={handleSubmitText}
          onSubmitImage={handleSubmitImage}
          onSubmitDocx={handleSubmitDocx}
          isLoading={isLoading}
          onLoadDocxSample={handleLoadDocxSample}
        />

        {/* Processing Spinner */}
        {isLoading ? (
          <LoadingSpinner message={loadingMessage} />
        ) : (
          /* Google Forms Style Catalogue Container */
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

        {/* Developer JSON Schema Inspector */}
        <div className="bg-[#f2ece2] border border-[#e2d8ca] rounded-2xl p-4">
          <details className="group">
            <summary className="text-xs font-semibold text-[#736a5c] uppercase tracking-wider cursor-pointer list-none flex items-center justify-between">
              <span>🔍 View Full Catalogue JSON Pipeline Schema (Developer Verification)</span>
              <span className="group-open:rotate-180 transition-transform text-[#9c907e]">▼</span>
            </summary>
            <pre className="mt-3 p-4 bg-[#1c1b18] text-[#81c784] rounded-xl text-xs font-mono overflow-x-auto">
              {JSON.stringify({ testTitle, questions }, null, 2)}
            </pre>
          </details>
        </div>

      </main>

      {/* Floating Math Popover Editor */}
      {activeMathEdit && (
        <FloatingMathPopover
          activeMath={activeMathEdit.mathLatex}
          onSave={handleSaveEditedMath}
          onClose={() => setActiveMathEdit(null)}
        />
      )}

      {/* Printable Exam Paper Modal */}
      {showPrintModal && (
        <PrintViewModal
          testTitle={testTitle}
          questions={questions}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Submissions & Grading Dashboard Modal */}
      {showSubmissionsModal && (
        <SubmissionsDashboardModal
          onClose={() => setShowSubmissionsModal(false)}
        />
      )}

      {/* Published Exam Snapshot Share Link Modal */}
      {publishedExamInfo && (
        <PublishExamModal
          examId={publishedExamInfo.examId}
          testTitle={publishedExamInfo.testTitle}
          questionsCount={publishedExamInfo.questionsCount}
          onClose={() => setPublishedExamInfo(null)}
        />
      )}

      {/* Access Gate Modal (Restricted Entry) */}
      {!isAuthenticated && (
        <AccessGateModal onAuthenticated={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
