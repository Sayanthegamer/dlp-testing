import React, { useState } from 'react';
import Navbar from '../Navbar';
import InputDrawer from '../InputPanel/InputDrawer';
import QuestionCatalogue from '../Catalogue/QuestionCatalogue';
import FloatingMathPopover from '../VisualMathEditor/FloatingMathPopover';
import PrintViewModal from '../Common/PrintViewModal';
import LoadingSpinner from '../Common/LoadingSpinner';
import AccessGateModal from '../Common/AccessGateModal';
import SubmissionsDashboardModal from './SubmissionsDashboardModal';
import PublishExamModal from './PublishExamModal';
import StudentRosterTab from './StudentRosterTab';
import {
  parseQuestionText,
  parseQuestionImage,
  parseDocxStructure,
  publishExam,
  logoutTeacher,
} from '../../services/apiService';
import { computeNeedsReview } from '../../services/reviewEvaluator';
import { repairMissingMathBackslashes } from '../../services/mathSanitizerService';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Dedicated Teacher Application Shell
 * Extracted from App.jsx to isolate authoring, AI parsing, roster management, publishing, and grading workflows.
 */
export default function TeacherWorkspaceShell({
  isAuthenticated,
  onSetAuthenticated,
  teacherAuthInitialMode = 'login',
  testTitle,
  onSetTestTitle,
  questions,
  onSetQuestions,
  sanitizeQuestionsList,
  onResetCatalogue,
  publishedExamInfo,
  onSetPublishedExamInfo,
  onBackToRoleGate,
  onSwitchToStudentPortal,
}) {
  const [activeTab, setActiveTab] = useState('catalogue');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Typesetting questions');
  const [isJustParsed, setIsJustParsed] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activeMathEdit, setActiveMathEdit] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);

  const showBanner = (type, title, details = []) => {
    setNotice({ type, title, details });
  };

  if (!isAuthenticated) {
    return (
      <AccessGateModal
        initialMode={teacherAuthInitialMode}
        onAuthenticated={() => onSetAuthenticated(true)}
        onBackToPortalChooser={onBackToRoleGate}
        onSwitchToStudentPortal={onSwitchToStudentPortal}
      />
    );
  }

  const handleReset = () => {
    onResetCatalogue();
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
        onSetQuestions(sanitizeQuestionsList(parsed.questions));
        if (parsed.testTitle) onSetTestTitle(parsed.testTitle);
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
        onSetQuestions(sanitizeQuestionsList(parsed.questions));
        if (parsed.testTitle) onSetTestTitle(parsed.testTitle);
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
        onSetQuestions(sanitizeQuestionsList(parsed.questions));
        if (parsed.testTitle) onSetTestTitle(parsed.testTitle);
        setIsJustParsed(true);
      }
    } catch (err) {
      showBanner('error', `Could not process Word document: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDocxSample = () => {
    onSetTestTitle('Word OMML Calculus Paper');
    onSetQuestions([
      {
        id: 'q_docx_sample_1',
        questionText:
          'Evaluate the definite integral <math>\\int_{0}^{1} x^2 \\, dx</math> and select the exact value.',
        type: 'mcq',
        options: [
          '<math>\\frac{1}{3}</math>',
          '<math>\\frac{1}{2}</math>',
          '<math>1</math>',
          '<math>\\frac{2}{3}</math>',
        ],
        correctAnswer: 0,
        mathSpans: ['\\int_{0}^{1} x^2 \\, dx', '\\frac{1}{3}'],
        confidenceScore: 1.0,
        needsReview: false,
      },
    ]);
    setIsJustParsed(true);
    setNotice(null);
  };

  const handleUpdateQuestion = (questionId, updatedData) => {
    onSetQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, ...updatedData } : q))
    );
  };

  const handleDeleteQuestion = (questionId) => {
    onSetQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  const handleDuplicateQuestion = (questionId) => {
    const targetIdx = questions.findIndex((q) => q.id === questionId);
    if (targetIdx === -1) return;
    const target = questions[targetIdx];
    const duplicated = {
      ...target,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      questionText: `${target.questionText}`,
    };
    const nextList = [...questions];
    nextList.splice(targetIdx + 1, 0, duplicated);
    onSetQuestions(nextList);
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: `q_${Date.now()}`,
      questionText: 'Solve for <math>x</math> in the linear equation <math>2x + 5 = 17</math>.',
      type: 'mcq',
      options: ['<math>x = 6</math>', '<math>x = 5</math>', '<math>x = 11</math>', '<math>x = 4</math>'],
      correctAnswer: null,
      mathSpans: ['x', '2x + 5 = 17', 'x = 6'],
      confidenceScore: 1.0,
      needsReview: true,
    };
    onSetQuestions((prev) => [...prev, newQ]);
  };

  const handleSaveEditedMath = (oldLatex, newLatex) => {
    if (!activeMathEdit) return;
    const { questionId } = activeMathEdit;
    const sanitizedOld = oldLatex
      ? repairMissingMathBackslashes(`<math>${oldLatex}</math>`).replace(/<\/?math>/gi, '').trim()
      : '';

    onSetQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;

        let updatedStem = repairMissingMathBackslashes(q.questionText || '');
        if (oldLatex) {
          updatedStem = updatedStem
            .replace(
              new RegExp(`<math>\\s*${escapeRegExp(oldLatex)}\\s*<\\/math>`, 'g'),
              `<math>${newLatex}</math>`
            )
            .replace(
              new RegExp(`<math>\\s*${escapeRegExp(sanitizedOld)}\\s*<\\/math>`, 'g'),
              `<math>${newLatex}</math>`
            );
        }

        const updatedOptions = (q.options || []).map((rawOpt) => {
          const opt = repairMissingMathBackslashes(rawOpt || '');
          if (oldLatex && (opt.includes(oldLatex) || (sanitizedOld && opt.includes(sanitizedOld)))) {
            return opt
              .replace(
                new RegExp(`<math>\\s*${escapeRegExp(oldLatex)}\\s*<\\/math>`, 'g'),
                `<math>${newLatex}</math>`
              )
              .replace(
                new RegExp(`<math>\\s*${escapeRegExp(sanitizedOld)}\\s*<\\/math>`, 'g'),
                `<math>${newLatex}</math>`
              );
          }
          return opt;
        });

        return {
          ...q,
          questionText: updatedStem,
          options: updatedOptions,
          needsReview: false,
        };
      })
    );

    setActiveMathEdit(null);
  };

  const handlePublishExam = async () => {
    const sanitizedQuestions = sanitizeQuestionsList(questions);
    onSetQuestions(sanitizedQuestions);

    const unreviewedQuestions = [];
    sanitizedQuestions.forEach((q, idx) => {
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
      const res = await publishExam({ testTitle, questions: sanitizedQuestions });
      if (res && res.examId) {
        onSetPublishedExamInfo({
          examId: res.examId,
          testTitle: res.testTitle,
          questionsCount: sanitizedQuestions.length,
        });
      }
    } catch (err) {
      showBanner('error', `Could not publish exam: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-paper-200 flex flex-col font-sans text-exam-ink">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onReset={handleReset}
        onOpenPrintView={() => setShowPrintModal(true)}
        onOpenSubmissions={() => setShowSubmissionsModal(true)}
        onSwitchToStudentPortal={onSwitchToStudentPortal}
        onPublishExam={handlePublishExam}
        onLogout={() => {
          logoutTeacher();
          onSetAuthenticated(false);
          onBackToRoleGate();
        }}
        onScrollToInput={() => {
          const drawer = document.getElementById('input-drawer-container');
          if (drawer) drawer.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-12 space-y-6">
        {notice && (
          <div
            className={`p-4 rounded-lg border flex items-start justify-between gap-3 bg-exam-card ${
              notice.type === 'error' ? 'border-exam-warn' : 'border-exam-positive'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {notice.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-exam-warn shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-exam-positive shrink-0 mt-0.5" strokeWidth={1.5} />
              )}
              <div className="space-y-1 text-sm">
                <p className="font-medium text-exam-ink">{notice.title}</p>
                {Array.isArray(notice.details) && notice.details.length > 0 && (
                  <ul className="list-disc list-inside text-exam-secondary space-y-0.5 pt-1 text-xs">
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
              className="p-1 rounded-md text-exam-muted hover:text-exam-ink hover:bg-paper-300"
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
                onUpdateTestTitle={onSetTestTitle}
                onUpdateQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onDuplicateQuestion={handleDuplicateQuestion}
                onAddQuestion={handleAddQuestion}
                onSelectMathForEdit={(questionId, mathLatex) =>
                  setActiveMathEdit({ questionId, mathLatex })
                }
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
        <SubmissionsDashboardModal onClose={() => setShowSubmissionsModal(false)} />
      )}

      {publishedExamInfo && (
        <PublishExamModal
          examId={publishedExamInfo.examId}
          testTitle={publishedExamInfo.testTitle}
          questionsCount={publishedExamInfo.questionsCount}
          onClose={() => onSetPublishedExamInfo(null)}
        />
      )}
    </div>
  );
}
