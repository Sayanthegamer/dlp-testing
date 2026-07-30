import React, { useState } from 'react';
import Navbar from './components/Navbar';
import InputDrawer from './components/InputPanel/InputDrawer';
import QuestionCatalogue from './components/Catalogue/QuestionCatalogue';
import FloatingMathPopover from './components/VisualMathEditor/FloatingMathPopover';
import PrintViewModal from './components/Common/PrintViewModal';
import LoadingSpinner from './components/Common/LoadingSpinner';
import { parseQuestionText, parseQuestionImage, parseDocxStructure } from './services/apiService';

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
  const [testTitle, setTestTitle] = useState(INITIAL_CATALOGUE.testTitle);
  const [questions, setQuestions] = useState(INITIAL_CATALOGUE.questions);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isJustParsed, setIsJustParsed] = useState(false);

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
    setQuestions(prev => prev.map(q => q.id === questionId ? updatedData : q));
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

  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        onReset={handleReset}
        onOpenPrintView={() => setShowPrintModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        
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
    </div>
  );
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
