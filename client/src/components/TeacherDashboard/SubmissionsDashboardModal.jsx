import React, { useState, useEffect } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { fetchSubmissions, gradeSubmission } from '../../services/apiService';
import { evaluateSubmission } from '../../services/gradingService';
import { X, CheckCircle2, XCircle, Clock, RefreshCw, FileText, Check, Award, MessageSquare } from 'lucide-react';

export default function SubmissionsDashboardModal({ onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'needs_review' | 'reviewed'
  
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [manualGrades, setManualGrades] = useState({});
  const [saving, setSaving] = useState(false);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSubmissions();
      if (res && res.submissions) {
        setSubmissions(res.submissions);
      }
    } catch (err) {
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  function handleSelectSubmission(sub) {
    setSelectedSubmission(sub);
    setManualGrades(sub.manualGrades || {});
  }

  function handleToggleGrade(questionId, status) {
    setManualGrades(prev => {
      const existing = prev[questionId] || {};
      const newStatus = existing.status === status ? null : status;
      if (!newStatus) {
        const copy = { ...prev };
        delete copy[questionId];
        return copy;
      }
      return {
        ...prev,
        [questionId]: {
          ...existing,
          status: newStatus,
          score: newStatus === 'correct' ? 1 : 0
        }
      };
    });
  }

  function handleCommentChange(questionId, comment) {
    setManualGrades(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { status: 'incorrect', score: 0 }),
        comment
      }
    }));
  }

  async function handleSaveGrades() {
    if (!selectedSubmission) return;
    setSaving(true);
    try {
      const res = await gradeSubmission(selectedSubmission.id, manualGrades);
      if (res && res.submission) {
        // Update in list
        setSubmissions(prev => prev.map(s => s.id === res.submission.id ? res.submission : s));
        setSelectedSubmission(res.submission);
      }
    } catch (err) {
      alert(`Error saving grades: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const filteredSubmissions = submissions.filter(s => {
    if (filter === 'needs_review') return s.status === 'pending_review';
    if (filter === 'reviewed') return s.status === 'reviewed';
    return true;
  });

  const unreviewedCount = submissions.filter(s => s.status === 'pending_review').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FAF7F0] border border-[#dcd2c4] rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto font-sans text-[#1c1b18]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2d8ca] bg-[#f5efe4]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#1c1b18] leading-tight">
                Teacher Submissions & Grading Dashboard
              </h3>
              <p className="text-xs text-[#786f63]">
                {submissions.length} Total Submissions • {unreviewedCount} Pending Teacher Review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSubmissions}
              className="p-2 rounded-xl text-[#786f63] hover:bg-[#e8decb] transition-colors"
              title="Refresh submissions"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#786f63] hover:bg-[#e8decb] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content (Split view if candidate selected) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Column: Submissions List */}
          <div className={`${selectedSubmission ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 border-r border-[#e2d8ca] bg-[#fcfbfa]`}>
            {/* Filter Tabs */}
            <div className="p-3 border-b border-[#e2d8ca] flex items-center gap-1.5 bg-[#f5efe4]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === 'all' ? 'bg-[#2c2825] text-white shadow-xs' : 'text-[#5c5346] hover:bg-[#e8decb]'
                }`}
              >
                All ({submissions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('needs_review')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                  filter === 'needs_review' ? 'bg-[#8c4a17] text-white shadow-xs' : 'text-[#8c4a17] hover:bg-[#e8decb]'
                }`}
              >
                <span>Needs Review</span>
                {unreviewedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    {unreviewedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFilter('reviewed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === 'reviewed' ? 'bg-[#2c2825] text-white shadow-xs' : 'text-[#5c5346] hover:bg-[#e8decb]'
                }`}
              >
                Completed
              </button>
            </div>

            {/* List Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading && submissions.length === 0 && (
                <div className="p-8 text-center text-xs text-[#786f63]">
                  Loading student submissions...
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-xs">
                  {error}
                </div>
              )}

              {!loading && filteredSubmissions.length === 0 && (
                <div className="p-8 text-center text-xs text-[#786f63] font-serif italic">
                  No submissions found for this filter.
                </div>
              )}

              {filteredSubmissions.map(sub => {
                const isSelected = selectedSubmission && selectedSubmission.id === sub.id;
                const formattedTime = new Date(sub.submittedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSelectSubmission(sub)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-1.5 ${
                      isSelected
                        ? 'bg-[#f0e6d8] border-[#8c4a17] shadow-xs'
                        : 'bg-white border-[#e2d8ca] hover:border-[#c5b9a7]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-[#1c1b18] truncate max-w-[160px]">
                        {sub.studentName}
                      </span>
                      {sub.status === 'pending_review' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Review Needed</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Reviewed</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#5c5346] flex items-center justify-between">
                      <span className="truncate max-w-[140px]">{sub.testTitle}</span>
                      <span className="font-semibold text-gray-900">
                        {sub.finalScore ? `${sub.finalScore.score}/${sub.finalScore.total}` : `${sub.autoGraded.score}/${sub.autoGraded.total}`}
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-400 font-mono text-right">
                      {formattedTime}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Submission Detail & Manual Grading Inspector */}
          <div className="flex-1 flex flex-col bg-[#FAF7F0] overflow-hidden">
            {selectedSubmission ? (() => {
              const evaluation = evaluateSubmission(selectedSubmission.questions, selectedSubmission.studentAnswers, manualGrades);

              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* Inspector Banner */}
                  <div className="p-4 sm:p-6 border-b border-[#e2d8ca] bg-[#fcfbfa] flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8c4a17]">
                          Candidate Scorecard
                        </span>
                        {selectedSubmission.status === 'pending_review' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                            Pending Review ({selectedSubmission.pendingCount} items)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-semibold">
                            Reviewed
                          </span>
                        )}
                      </div>
                      <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1c1b18]">
                        {selectedSubmission.studentName}
                      </h2>
                      <p className="text-xs text-[#786f63]">
                        Test: {selectedSubmission.testTitle} • Submitted {new Date(selectedSubmission.submittedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-xs text-gray-500 font-medium">
                        {evaluation.pendingCount > 0 ? (
                          <span className="text-amber-800 font-semibold">Provisional Score ({evaluation.pendingCount} pending)</span>
                        ) : (
                          <span>Final Score</span>
                        )}
                      </div>
                      <div className="font-serif font-bold text-2xl sm:text-3xl text-[#1c1b18] flex items-baseline justify-end gap-2">
                        <span>{evaluation.score} / {evaluation.total}</span>
                        <span className="text-xs font-sans font-semibold text-[#8c4a17]">
                          {evaluation.pendingCount > 0
                            ? `(${evaluation.provisionalPercentage}% graded rate)`
                            : `(${evaluation.percentage}%)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveGrades}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-[#8c4a17] hover:bg-[#703a11] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 ml-auto"
                      >
                        <Check className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Save & Finalize Grades'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Itemized Questions & Manual Grade Form */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {selectedSubmission.questions.map((q, idx) => {
                      const studentAns = selectedSubmission.studentAnswers[q.id];
                      const gradeInfo = manualGrades[q.id] || {};
                      const qEval = evaluation.perQuestion[idx] || {};
                      const effectiveStatus = qEval.effectiveStatus || 'pending_review';

                    let formattedStudentAns = 'No response provided';
                    if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
                      if (q.type === 'mcq' && typeof studentAns === 'number') {
                        formattedStudentAns = `Option ${optionLetters[studentAns] || studentAns}`;
                      } else {
                        formattedStudentAns = `"${studentAns}"`;
                      }
                    }

                    return (
                      <div key={q.id || idx} className="bg-white border border-[#e2d8ca] rounded-2xl p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 text-xs">
                          <span className="font-bold text-gray-900">Question #{idx + 1} ({q.type})</span>
                          <span className="font-bold">
                            {effectiveStatus === 'correct' && <span className="text-emerald-700">Correct (+1)</span>}
                            {effectiveStatus === 'incorrect' && <span className="text-red-700">Incorrect (0)</span>}
                            {effectiveStatus === 'pending_review' && <span className="text-amber-800">Pending Review</span>}
                          </span>
                        </div>

                        {/* Stem */}
                        <div className="font-serif text-base text-[#1c1b18]">
                          <MathRenderer text={q.questionText} readOnly={true} />
                        </div>

                        {/* MCQ options summary if MCQ */}
                        {q.type === 'mcq' && q.options && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg space-y-1">
                            <span className="font-semibold block text-gray-700">Options:</span>
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <span className="font-bold">({optionLetters[oIdx]})</span>
                                <MathRenderer text={opt} readOnly={true} />
                                {q.correctAnswer === oIdx && <span className="text-emerald-700 font-bold ml-2">(Correct Key)</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Response & Evaluation */}
                        <div className="bg-[#FAF7F0] border border-[#e2d8ca] rounded-xl p-3.5 text-xs space-y-2">
                          <div>
                            <span className="text-gray-500 font-medium">Candidate Response: </span>
                            <strong className="text-gray-900">{formattedStudentAns}</strong>
                          </div>

                          {/* Teacher Manual Grading Action Controls for short answers / text */}
                          {(q.type === 'short_answer_text' || autoStatus === 'pending_review' || q.type === 'short_answer') && (
                            <div className="pt-2 border-t border-[#e2d8ca] space-y-2">
                              <span className="font-bold text-[#8c4a17] block">Teacher Manual Evaluation:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleGrade(q.id, 'correct')}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all text-xs ${
                                    effectiveStatus === 'correct'
                                      ? 'bg-emerald-700 text-white shadow-xs'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark Correct (+1)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleGrade(q.id, 'incorrect')}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all text-xs ${
                                    effectiveStatus === 'incorrect'
                                      ? 'bg-red-700 text-white shadow-xs'
                                      : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Mark Incorrect (0)</span>
                                </button>
                              </div>

                              {/* Optional Comment */}
                              <div className="pt-1 flex items-center gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <input
                                  type="text"
                                  placeholder="Add optional teacher feedback comment..."
                                  value={gradeInfo.comment || ''}
                                  onChange={e => handleCommentChange(q.id, e.target.value)}
                                  className="w-full bg-white border border-[#e2d8ca] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#8c4a17]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
              );
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 space-y-3 font-serif">
                <FileText className="w-12 h-12 text-gray-300" />
                <p className="text-base text-gray-600">Select a student submission from the left list to inspect answers and perform manual grading.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
