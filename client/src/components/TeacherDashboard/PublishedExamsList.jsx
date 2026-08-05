import React, { useState, useEffect } from 'react';
import { fetchExamsList, toggleExamStatus, startRollingSession } from '../../services/apiService';
import { Copy, Check, Power, RefreshCw, FileText, Search, ExternalLink, AlertCircle, KeyRound } from 'lucide-react';

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
      setError(err.message || 'Failed to load published exams.');
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
    try {
      const data = await startRollingSession(examId);
      if (data.success && data.rollingCode) {
        setActiveCodes(prev => ({ ...prev, [examId]: data.rollingCode }));
      } else {
        alert(data.error || 'Failed to generate rolling passcode.');
      }
    } catch (err) {
      alert(`Error generating passcode: ${err.message}`);
    } finally {
      setGeneratingCodeId(null);
    }
  };



  const handleToggleStatus = async (examId, currentStatus) => {
    setTogglingId(examId);
    const nextStatus = currentStatus === 'closed' ? 'active' : 'closed';
    try {
      const res = await toggleExamStatus(examId, nextStatus);
      if (res && res.success) {
        setExams(prev => prev.map(e => e.id === examId ? { ...e, status: res.status } : e));
      }
    } catch (err) {
      alert(`Error toggling status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredExams = exams.filter(e => 
    (e.testTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6 bg-[#faf7f2]">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2d8ca] pb-4">
        <div>
          <h4 className="font-serif font-bold text-xl text-[#1c1b18]">
            Published Exam History
          </h4>
          <p className="text-xs text-[#786f63]">
            Manage shareable test links, candidate counts, and active access status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial w-full sm:w-auto">
            <Search className="w-4 h-4 text-[#8c8275] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search published exams..."
              className="pl-9 pr-3 py-1.5 rounded-xl border border-[#dcd0be] bg-white text-xs text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] w-full sm:w-56"
            />
          </div>

          <button
            type="button"
            onClick={loadExams}
            className="p-2 rounded-xl bg-[#f0e6d8] hover:bg-[#e4d8c5] text-[#5c5346] transition-colors shrink-0"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[#8c8275] space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#8c4a17]" />
          <span className="text-xs">Loading published exams...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredExams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-white rounded-3xl border border-[#e2d8ca] p-8">
          <FileText className="w-10 h-10 text-[#c9bea9]" />
          <div>
            <h5 className="font-serif font-bold text-base text-[#1c1b18]">No Published Exams Found</h5>
            <p className="text-xs text-[#786f63] max-w-sm mt-1">
              Publish an exam from the question catalogue editor to generate frozen snapshot links for your students.
            </p>
          </div>
        </div>
      )}

      {/* Exam Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredExams.map((exam) => {
          const isClosed = exam.status === 'closed';
          const isCopied = copiedId === exam.id;
          const isToggling = togglingId === exam.id;

          const formattedDate = exam.createdAt
            ? new Date(exam.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Unknown date';

          return (
            <div
              key={exam.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs transition-all space-y-4 flex flex-col justify-between ${
                isClosed ? 'border-amber-300 bg-amber-50/20' : 'border-[#e2d8ca] hover:border-[#c5b8a5]'
              }`}
            >
              <div className="space-y-2">
                {/* Status & ID */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#8c8275] truncate max-w-[200px]">
                    ID: {exam.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      isClosed
                        ? 'bg-amber-100 border border-amber-300 text-amber-900'
                        : 'bg-emerald-100 border border-emerald-300 text-emerald-900'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-amber-600' : 'bg-emerald-600'}`} />
                    {isClosed ? 'Closed (Inactive)' : 'Active (Accepting Submissions)'}
                  </span>
                </div>

                {/* Title */}
                <h5 className="font-serif font-bold text-lg text-[#1c1b18] leading-snug">
                  {exam.testTitle}
                </h5>

                {/* Details Pills */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#786f63] font-sans pt-1">
                  <span>📅 Published: <strong className="text-[#3c3730]">{formattedDate}</strong></span>
                  <span>❓ Questions: <strong className="text-[#3c3730]">{exam.questionCount}</strong></span>
                  <span>📝 Submissions: <strong className="text-[#8c4a17]">{exam.submissionCount}</strong></span>
                </div>

                {/* Active Rolling Passcode Section */}
                <div className="mt-2 p-3 bg-[#f8f3eb] rounded-xl border border-[#e2d8ca] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#8c4a17] shrink-0" />
                    {activeCodes[exam.id] ? (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#736c62] block leading-none">Live Passcode</span>
                        <span className="font-mono font-extrabold text-base tracking-widest text-[#8c4a17]">
                          {activeCodes[exam.id]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#736c62] font-medium">
                        {isClosed ? 'Exam closed' : 'No passcode active'}
                      </span>
                    )}
                  </div>

                  {activeCodes[exam.id] ? (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(exam.id, activeCodes[exam.id])}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                        copiedCodeId === exam.id ? 'bg-emerald-600 text-white' : 'bg-white text-[#8c4a17] border border-[#dcd2c4] hover:bg-[#FAF7F0]'
                      }`}
                    >
                      {copiedCodeId === exam.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerateCode(exam.id)}
                      disabled={isClosed || generatingCodeId === exam.id}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#8c4a17] text-white hover:bg-[#733c11] transition-all disabled:opacity-40 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${generatingCodeId === exam.id ? 'animate-spin' : ''}`} />
                      <span>Generate Code</span>
                    </button>
                  )}
                </div>
              </div>


              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#f0e6d8] gap-2">
                {/* Copy Shareable Link */}
                <button
                  type="button"
                  onClick={() => handleCopyLink(exam.id)}
                  disabled={isClosed}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isClosed
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isCopied
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[#8c4a17] text-white hover:bg-[#733c11] shadow-xs'
                  }`}
                  title={isClosed ? 'Re-activate exam to copy shareable link' : 'Copy student test link to clipboard'}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Student Link</span>
                    </>
                  )}
                </button>

                {/* Toggle Active/Closed */}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(exam.id, exam.status)}
                  disabled={isToggling}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isClosed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Power className={`w-3.5 h-3.5 ${isToggling ? 'animate-spin' : ''}`} />
                  <span>{isClosed ? 'Re-Open Test' : 'Close Test Access'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
