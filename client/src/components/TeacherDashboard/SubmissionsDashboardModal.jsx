import React, { useState, useEffect } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import PublishedExamsList from './PublishedExamsList';
import { fetchSubmissions, gradeSubmission } from '../../services/apiService';
import { evaluateSubmission } from '../../services/gradingService';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  Check,
  Award,
  MessageSquare,
  Users,
  ShieldAlert
} from 'lucide-react';

export default function SubmissionsDashboardModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'published_exams'
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'needs_review' | 'reviewed'

  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [manualGrades, setManualGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState('');

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
      setError(err.message || 'Could not load submissions');
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
    setSaveBanner('');
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
    setSaveBanner('');
    setError(null);
    try {
      const res = await gradeSubmission(selectedSubmission.id, manualGrades);
      if (res && res.submission) {
        setSubmissions(prev => prev.map(s => s.id === res.submission.id ? res.submission : s));
        setSelectedSubmission(res.submission);
        setSaveBanner('Grades saved');
        setTimeout(() => setSaveBanner(''), 3000);
      }
    } catch (err) {
      setError(`Could not save grades: ${err.message}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-[#161513]/60 overflow-y-auto modal-backdrop-animated">
      <div className="bg-[#f7f4ee] border-0 sm:border border-[#dcd5c4] rounded-none sm:rounded-2xl max-w-5xl w-full h-dvh sm:h-auto sm:max-h-[90vh] flex flex-col shadow-xl overflow-hidden font-sans text-[#1f1b16] modal-card-animated">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-[#dcd5c4] bg-[#fdfbf7] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#efe9df] text-[#1f1b16] flex items-center justify-center">
              <Award className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-serif font-medium text-lg text-[#1f1b16] leading-tight">
                Submissions and published exams
              </h3>
              <p className="text-xs text-[#5e554a] font-mono tabular-nums">
                {submissions.length} submissions • {unreviewedCount} pending review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#efe9df] p-1 rounded-lg border border-[#dcd5c4]">
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-calm ${
                activeTab === 'submissions'
                  ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
              <span>Student submissions</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('published_exams')}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-calm ${
                activeTab === 'published_exams'
                  ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
              <span>Published exams</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {activeTab === 'submissions' && (
              <button
                type="button"
                onClick={loadSubmissions}
                className="p-2 h-8 w-8 rounded-lg text-[#5e554a] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
                title="Refresh submissions"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 h-8 w-8 rounded-lg text-[#5e554a] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {activeTab === 'published_exams' ? (
          <PublishedExamsList />
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left Column: Submissions List */}
            <div className={`${selectedSubmission ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-[#dcd5c4] bg-[#fdfbf7]`}>
              <div className="p-3 border-b border-[#dcd5c4] flex items-center gap-1 bg-[#f7f4ee]">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2.5 h-7 rounded-md text-xs font-medium tabular-nums transition-calm ${
                    filter === 'all' ? 'bg-[#1f1b16] text-[#fdfbf7]' : 'text-[#5e554a] hover:bg-[#efe9df]'
                  }`}
                >
                  All ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('needs_review')}
                  className={`px-2.5 h-7 rounded-md text-xs font-medium tabular-nums transition-calm flex items-center gap-1.5 ${
                    filter === 'needs_review' ? 'bg-[#b8622e] text-[#fdfbf7]' : 'text-[#5e554a] hover:bg-[#efe9df]'
                  }`}
                >
                  <span>Needs review</span>
                  {unreviewedCount > 0 && (
                    <span className="font-mono text-[11px]">({unreviewedCount})</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('reviewed')}
                  className={`px-2.5 h-7 rounded-md text-xs font-medium transition-calm ${
                    filter === 'reviewed' ? 'bg-[#1f1b16] text-[#fdfbf7]' : 'text-[#5e554a] hover:bg-[#efe9df]'
                  }`}
                >
                  Graded
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && submissions.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#7b7266]">
                    Loading submissions
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs">
                    {error}
                  </div>
                )}

                {!loading && filteredSubmissions.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#7b7266]">
                    No submissions match this filter
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
                      className={`w-full text-left p-3.5 rounded-xl border transition-calm space-y-1.5 ${
                        isSelected
                          ? 'bg-[#efe9df] border-[#8c4a17]'
                          : 'bg-[#fdfbf7] border-[#dcd5c4] hover:border-[#c4bba6]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif font-medium text-sm text-[#1f1b16] truncate">
                          {sub.studentName}
                        </span>
                        {sub.cheatingFlagged ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-[11px] font-medium shrink-0">
                            Flagged
                          </span>
                        ) : sub.status === 'pending_review' ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#efe9df] border border-[#b8622e] text-[#b8622e] text-[11px] font-medium shrink-0">
                            Needs review
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] text-[11px] font-medium shrink-0">
                            Graded
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#5e554a] flex items-center justify-between font-mono tabular-nums">
                        <span className="font-sans truncate max-w-[140px]">{sub.testTitle}</span>
                        {sub.cheatingFlagged ? (
                          <span className="text-[#dc2626]">0 pts</span>
                        ) : (
                          <span className="text-[#1f1b16] font-medium">
                            {sub.finalScore ? `${sub.finalScore.score}/${sub.finalScore.total}` : `${sub.autoGraded?.score || 0}/${sub.autoGraded?.total || 0}`}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#7b7266] font-mono tabular-nums">
                        {formattedTime}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Submission Detail */}
            <div className={`${selectedSubmission ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#f7f4ee] overflow-hidden`}>
              {selectedSubmission ? (() => {
                const evaluation = evaluateSubmission(
                  selectedSubmission.questions,
                  selectedSubmission.studentAnswers,
                  manualGrades
                );

                return (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="md:hidden p-3 border-b border-[#dcd5c4] bg-[#fdfbf7] flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedSubmission(null)}
                        className="px-3 h-8 rounded-lg bg-[#efe9df] border border-[#dcd5c4] text-xs font-medium text-[#1f1b16]"
                      >
                        Back to list
                      </button>
                    </div>

                    <div className="p-5 border-b border-[#dcd5c4] bg-[#fdfbf7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-[#5e554a]">
                            Candidate script
                          </span>
                          {saveBanner && (
                            <span className="px-2 py-0.5 rounded-md bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] text-xs font-medium">
                              {saveBanner}
                            </span>
                          )}
                        </div>
                        <h2 className="font-serif font-medium text-xl text-[#1f1b16]">
                          {selectedSubmission.studentName}
                        </h2>
                        <p className="text-xs text-[#7b7266] font-mono tabular-nums">
                          {selectedSubmission.testTitle} • {new Date(selectedSubmission.submittedAt).toLocaleString()}
                        </p>
                        {selectedSubmission.cheatingFlagged && (
                          <div className="mt-2 p-2.5 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            <span>Violation recorded: {selectedSubmission.cheatingReason || 'Window focus lost during exam'}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right space-y-1.5 w-full sm:w-auto">
                        <div className="font-mono tabular-nums font-medium text-2xl text-[#1f1b16]">
                          {evaluation.score} / {evaluation.total} <span className="text-sm text-[#5e554a]">({evaluation.percentage}%)</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveGrades}
                          disabled={saving}
                          className="w-full sm:w-auto px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" strokeWidth={1.5} />
                          <span>{saving ? 'Saving' : 'Save grades'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {selectedSubmission.questions.map((q, idx) => {
                        const studentAns = selectedSubmission.studentAnswers[q.id];
                        const gradeInfo = manualGrades[q.id] || {};
                        const qEval = evaluation.perQuestion[idx] || {};
                        const effectiveStatus = qEval.effectiveStatus || 'pending_review';

                        let formattedStudentAns = 'No response';
                        if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
                          if ((q.type === 'mcq' || q.type === 'match_following') && typeof studentAns === 'number') {
                            formattedStudentAns = `Option ${optionLetters[studentAns] || studentAns}`;
                          } else {
                            formattedStudentAns = `${studentAns}`;
                          }
                        }

                        return (
                          <div key={q.id || idx} className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-5 space-y-3">
                            <div className="flex items-center justify-between border-b border-[#efe9df] pb-2 text-xs">
                              <span className="font-serif font-medium text-sm text-[#1f1b16] tabular-nums">
                                Q{idx + 1}.
                              </span>
                              <span className="font-mono tabular-nums font-medium">
                                {effectiveStatus === 'correct' && <span className="text-[#3f6b4a]">Correct (+1)</span>}
                                {effectiveStatus === 'incorrect' && <span className="text-[#dc2626]">Incorrect (0)</span>}
                                {effectiveStatus === 'pending_review' && <span className="text-[#b8622e]">Needs review</span>}
                              </span>
                            </div>

                            <div className="font-serif text-base text-[#1f1b16]">
                              <MathRenderer text={q.questionText} readOnly={true} />
                            </div>

                            {(q.type === 'mcq' || q.type === 'match_following') && q.options && (
                              <div className="text-xs text-[#5e554a] bg-[#f7f4ee] p-3 rounded-lg space-y-1.5 border border-[#dcd5c4]">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2 font-serif">
                                    <span className="font-mono text-xs text-[#7b7266]">({optionLetters[oIdx]})</span>
                                    <MathRenderer text={opt} readOnly={true} />
                                    {q.correctAnswer === oIdx && (
                                      <span className="text-[#3f6b4a] font-sans text-[11px] font-medium ml-auto">Answer key</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-3.5 text-xs space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[#5e554a]">Student response</span>
                                <span className="font-mono font-medium text-[#1f1b16]">{formattedStudentAns}</span>
                              </div>

                              <div className="pt-2 border-t border-[#dcd5c4] space-y-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleGrade(q.id, 'correct')}
                                    className={`flex items-center gap-1.5 px-3 h-8 rounded-md font-medium transition-calm text-xs border ${
                                      effectiveStatus === 'correct'
                                        ? 'bg-[#3f6b4a] border-[#3f6b4a] text-[#fdfbf7]'
                                        : 'bg-[#fdfbf7] text-[#3f6b4a] border-[#dcd5c4] hover:bg-[#efe9df]'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span>Mark correct</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleGrade(q.id, 'incorrect')}
                                    className={`flex items-center gap-1.5 px-3 h-8 rounded-md font-medium transition-calm text-xs border ${
                                      effectiveStatus === 'incorrect'
                                        ? 'bg-[#dc2626] border-[#dc2626] text-[#fdfbf7]'
                                        : 'bg-[#fdfbf7] text-[#dc2626] border-[#dcd5c4] hover:bg-[#efe9df]'
                                    }`}
                                  >
                                    <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span>Mark incorrect</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-3.5 h-3.5 text-[#7b7266] shrink-0" strokeWidth={1.5} />
                                  <input
                                    type="text"
                                    placeholder="Teacher note"
                                    value={gradeInfo.comment || ''}
                                    onChange={e => handleCommentChange(q.id, e.target.value)}
                                    className="w-full bg-[#fdfbf7] border border-[#dcd5c4] rounded-md px-2.5 h-8 text-xs text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#7b7266] space-y-2">
                  <FileText className="w-8 h-8 text-[#7b7266]" strokeWidth={1.5} />
                  <p className="text-sm font-serif text-[#5e554a]">Select a submission on the left to inspect responses and grade</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
