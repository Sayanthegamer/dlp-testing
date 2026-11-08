import React, { useState, useEffect } from 'react';
import { fetchExamsList, toggleExamStatus, startRollingSession } from '../../services/apiService';
import {
  Copy,
  Check,
  Power,
  RefreshCw,
  FileText,
  Search,
  AlertCircle,
  KeyRound,
  Calendar,
  HelpCircle,
  Users
} from 'lucide-react';

export default function PublishedExamsList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [activeCodes, setActiveCodes] = useState({});
  const [generatingCodeId, setGeneratingCodeId] = useState(null);

  async function loadExams() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchExamsList();
      if (res && res.exams) {
        setExams(res.exams);
      }
    } catch (err) {
      setError(err.message || 'Could not load published exams');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExams();
  }, []);

  const handleCopyLink = (examId) => {
    const origin = window.location.origin;
    const shareableUrl = `${origin}/?mode=student&testId=${examId}`;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedId(examId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyCode = (examId, code) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(examId);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleGenerateCode = async (examId) => {
    setGeneratingCodeId(examId);
    setError(null);
    try {
      const data = await startRollingSession(examId);
      if (data.success && data.rollingCode) {
        setActiveCodes(prev => ({ ...prev, [examId]: data.rollingCode }));
      } else {
        setError(data.error || 'Could not generate rolling passcode');
      }
    } catch (err) {
      setError(`Could not generate passcode: ${err.message}`);
    } finally {
      setGeneratingCodeId(null);
    }
  };

  const handleToggleStatus = async (examId, currentStatus) => {
    setTogglingId(examId);
    setError(null);
    const nextStatus = currentStatus === 'closed' ? 'active' : 'closed';
    try {
      const res = await toggleExamStatus(examId, nextStatus);
      if (res && res.success) {
        setExams(prev => prev.map(e => e.id === examId ? { ...e, status: res.status } : e));
      }
    } catch (err) {
      setError(`Could not update exam status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredExams = exams.filter(e =>
    (e.testTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6 bg-[#f7f4ee]">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dcd5c4] pb-4">
        <div>
          <h4 className="font-serif font-medium text-xl text-[#1f1b16]">
            Published exams
          </h4>
          <p className="text-xs text-[#5e554a]">
            Manage shareable links, 5-minute rolling passcodes, and session status
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial w-full sm:w-56">
            <Search className="w-4 h-4 text-[#7b7266] absolute left-3 top-2.5" strokeWidth={1.5} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search exams"
              className="pl-9 pr-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-xs text-[#1f1b16] focus:outline-none focus:border-[#8c4a17] w-full"
            />
          </div>

          <button
            type="button"
            onClick={loadExams}
            className="p-2 h-9 w-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#5e554a] transition-calm shrink-0 flex items-center justify-center"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#fdfbf7] border border-[#dc2626] text-[#dc2626] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      )}

      {loading && exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[#7b7266] space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin text-[#8c4a17]" strokeWidth={1.5} />
          <span className="text-xs">Loading published exams</span>
        </div>
      )}

      {!loading && filteredExams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center space-y-2 bg-[#fdfbf7] rounded-xl border border-[#dcd5c4] p-8">
          <FileText className="w-8 h-8 text-[#7b7266]" strokeWidth={1.5} />
          <h5 className="font-serif font-medium text-base text-[#1f1b16]">No published exams yet</h5>
          <p className="text-xs text-[#5e554a] max-w-sm">
            Publish an exam from the question paper editor to generate snapshot links for students
          </p>
        </div>
      )}

      {/* Exam Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredExams.map((exam) => {
          const isClosed = exam.status === 'closed';
          const isCopied = copiedId === exam.id;
          const isToggling = togglingId === exam.id;

          const formattedDate = exam.createdAt
            ? new Date(exam.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            : 'Recent';

          return (
            <div
              key={exam.id}
              className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-5 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-[#7b7266] truncate max-w-[200px]">
                    {exam.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-md border ${
                      isClosed
                        ? 'bg-[#efe9df] border-[#dcd5c4] text-[#5e554a]'
                        : 'bg-[#f4f8f5] border-[#3f6b4a] text-[#3f6b4a]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-[#7b7266]' : 'bg-[#3f6b4a]'}`} />
                    <span>{isClosed ? 'Closed' : 'Active'}</span>
                  </span>
                </div>

                <h5 className="font-serif font-medium text-lg text-[#1f1b16] leading-snug">
                  {exam.testTitle}
                </h5>

                {/* Meta Row with Lucide Icons instead of Emojis */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#5e554a] font-mono tabular-nums pt-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                    <span>{formattedDate}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                    <span>{exam.questionCount} questions</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                    <span>{exam.submissionCount} submissions</span>
                  </span>
                </div>

                {/* Rolling Passcode Box */}
                <div className="p-3 bg-[#f7f4ee] rounded-lg border border-[#dcd5c4] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#8c4a17] shrink-0" strokeWidth={1.5} />
                    {activeCodes[exam.id] ? (
                      <div>
                        <span className="text-[11px] text-[#5e554a] block leading-none">5-minute code</span>
                        <span className="font-mono tabular-nums font-medium text-base tracking-wider text-[#1f1b16]">
                          {activeCodes[exam.id]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#5e554a]">
                        {isClosed ? 'Session closed' : 'Generate 6-digit rolling code'}
                      </span>
                    )}
                  </div>

                  {activeCodes[exam.id] ? (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(exam.id, activeCodes[exam.id])}
                      className={`text-xs font-medium px-2.5 h-7 rounded-md transition-calm flex items-center gap-1 ${
                        copiedCodeId === exam.id
                          ? 'bg-[#3f6b4a] text-[#fdfbf7]'
                          : 'bg-[#fdfbf7] text-[#1f1b16] border border-[#dcd5c4] hover:bg-[#efe9df]'
                      }`}
                    >
                      {copiedCodeId === exam.id ? <Check className="w-3 h-3" strokeWidth={1.5} /> : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                      <span>{copiedCodeId === exam.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerateCode(exam.id)}
                      disabled={isClosed || generatingCodeId === exam.id}
                      className="text-xs font-medium px-3 h-7 rounded-md bg-[#1f1b16] text-[#fdfbf7] hover:bg-[#332d25] transition-calm disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${generatingCodeId === exam.id ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                      <span>Show code</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#efe9df] gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyLink(exam.id)}
                  disabled={isClosed}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-calm ${
                    isClosed
                      ? 'bg-[#efe9df] text-[#7b7266] cursor-not-allowed'
                      : isCopied
                      ? 'bg-[#3f6b4a] text-[#fdfbf7]'
                      : 'bg-[#1f1b16] text-[#fdfbf7] hover:bg-[#332d25]'
                  }`}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  <span>{isCopied ? 'Copied link' : 'Copy student link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(exam.id, exam.status)}
                  disabled={isToggling}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border border-[#dcd5c4] bg-[#fdfbf7] hover:bg-[#efe9df] text-[#1f1b16] transition-calm"
                >
                  <Power className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                  <span>{isClosed ? 'Reopen exam' : 'Close exam'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
