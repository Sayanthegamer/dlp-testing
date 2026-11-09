import React, { useState, useEffect } from 'react';
import {
  LogOut,
  History,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  Eye,
  KeyRound,
  Link2,
  Play
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchStudentHistory,
  logoutStudent,
  fetchStudentRollingRefCode,
  regenerateStudentRollingRefCode,
  studentLinkToTeacher,
  studentJoinClass
} from '../../services/apiService';
import MathRenderer from '../PreviewPanel/MathRenderer';

export default function StudentPortal({ student, onJoinExam, onPreviewCurrentPaper, onLogout }) {
  const [rollingCode, setRollingCode] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedReviewSub, setSelectedReviewSub] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  const [studentRefCode, setStudentRefCode] = useState('');
  const [stuCodeTimer, setStuCodeTimer] = useState(300);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [teacherInputCode, setTeacherInputCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  const [linking, setLinking] = useState(false);

  const admNum = student.admission_number || student.admissionNumber || '';
  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?adm=${encodeURIComponent(admNum)}&dob=${encodeURIComponent(student.dob || '')}`
    : '';

  useEffect(() => {
    loadTestHistory();
    loadStudentCode();
  }, [student]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStuCodeTimer((prev) => {
        if (prev <= 1) {
          loadStudentCode();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadStudentCode = async () => {
    try {
      const res = await fetchStudentRollingRefCode();
      if (res && res.refCode) {
        setStudentRefCode(res.refCode);
        if (res.expiresInSeconds) setStuCodeTimer(res.expiresInSeconds);
      }
    } catch (_) {}
  };

  const handleRegenerateStudentCode = async () => {
    try {
      const res = await regenerateStudentRollingRefCode();
      if (res && res.refCode) {
        setStudentRefCode(res.refCode);
        if (res.expiresInSeconds) setStuCodeTimer(res.expiresInSeconds);
      }
    } catch (_) {}
  };

  const loadTestHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchStudentHistory();
      setHistory(data);
    } catch (_) {} finally {
      setLoadingHistory(false);
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!rollingCode.trim() || rollingCode.trim().length < 6) {
      setJoinError('Enter the 6-digit session passcode displayed by your instructor');
      return;
    }
    setJoinError('');
    onJoinExam(rollingCode.trim());
  };

  const handleLinkTeacherSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = teacherInputCode.trim().toUpperCase();
    if (!cleanCode) {
      setLinkError('Enter your classroom code or teacher code');
      return;
    }
    setLinkError('');
    setLinkSuccess('');
    setLinking(true);

    try {
      if (cleanCode.startsWith('CLASS-') || !cleanCode.startsWith('TCH-')) {
        try {
          const classRes = await studentJoinClass(cleanCode.startsWith('CLASS-') ? cleanCode : `CLASS-${cleanCode}`);
          if (classRes && classRes.success) {
            setLinkSuccess('Successfully enrolled into classroom!');
            setTeacherInputCode('');
            setLinking(false);
            return;
          }
        } catch (cErr) {
          if (cleanCode.startsWith('CLASS-')) throw cErr;
        }
      }

      const res = await studentLinkToTeacher(cleanCode);
      if (res && res.success) {
        setLinkSuccess('Linked your profile to your instructor roster!');
        setTeacherInputCode('');
      }
    } catch (err) {
      setLinkError(err.message || 'Could not join classroom. Check the code and try again.');
    } finally {
      setLinking(false);
    }
  };

  const formatSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalTests = history.length;
  const avgPercentage = totalTests > 0
    ? Math.round(history.reduce((acc, h) => acc + (parseFloat(h.percentage) || 0), 0) / totalTests)
    : 0;
  const latestPercentage = totalTests > 0 ? Math.round(parseFloat(history[0]?.percentage) || 0) : null;

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1f1b16] p-4 sm:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Candidate Header Card */}
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#1f1b16] text-[#fdfbf7] flex items-center justify-center font-serif font-medium text-lg shrink-0">
              {student.full_name ? student.full_name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-serif font-medium text-[#1f1b16]">
                  {student.full_name || student.fullName}
                </h1>
                <span className="bg-[#efe9df] border border-[#dcd5c4] text-[#5e554a] text-xs font-medium px-2 py-0.5 rounded-md">
                  Candidate
                </span>
              </div>
              <p className="text-xs font-mono tabular-nums text-[#5e554a] mt-0.5">
                Roll number: <span className="font-medium text-[#1f1b16]">{admNum}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Student 5-Min Reference Code */}
            <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg px-3.5 py-2 flex items-center gap-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-[#5e554a]">
                  <KeyRound className="w-3 h-3 text-[#8c4a17]" strokeWidth={1.5} />
                  <span>Reference code</span>
                </div>
                <div className="font-mono tabular-nums font-medium text-sm text-[#1f1b16] tracking-wider">
                  {studentRefCode || 'STU-••••••'}
                </div>
              </div>
              <div className="text-right border-l border-[#dcd5c4] pl-3">
                <span className="text-xs font-mono tabular-nums text-[#5e554a] flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3 text-[#7b7266]" strokeWidth={1.5} />
                  {formatSec(stuCodeTimer)}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateStudentCode}
                  className="text-[11px] font-medium text-[#8c4a17] hover:underline block"
                >
                  Rotate
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium transition-calm border border-[#dcd5c4]"
            >
              <Link2 className="w-4 h-4 text-[#8c4a17]" strokeWidth={1.5} />
              <span>Join class (CLASS code)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="bg-[#fdfbf7] border border-[#dcd5c4] px-3 h-9 rounded-lg flex items-center gap-2 hover:bg-[#efe9df] transition-calm text-xs font-medium text-[#1f1b16]"
              title="Open digital hall ticket QR"
            >
              <QRCodeSVG value={qrUrl} size={22} level="M" />
              <span>Hall ticket</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logoutStudent();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#fdfbf7] hover:bg-[#efe9df] text-[#5e554a] hover:text-[#dc2626] text-xs font-medium transition-calm border border-[#dcd5c4]"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Stat Cards Row (Numbers only, shared height, no decorative icons inside) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-5 space-y-1">
            <span className="text-xs text-[#5e554a] block">Completed assessments</span>
            <div className="text-2xl font-mono tabular-nums font-medium text-[#1f1b16]">
              {totalTests}
            </div>
            <span className="text-xs text-[#7b7266] block">
              {totalTests === 0 ? 'No papers submitted yet' : 'Recorded in candidate history'}
            </span>
          </div>

          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-5 space-y-1">
            <span className="text-xs text-[#5e554a] block">Average score</span>
            <div className="text-2xl font-mono tabular-nums font-medium text-[#1f1b16]">
              {avgPercentage}%
            </div>
            <span className="text-xs text-[#7b7266] block">
              {latestPercentage !== null ? `Latest paper: ${latestPercentage}%` : 'Across graded attempts'}
            </span>
          </div>

          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-5 space-y-1">
            <span className="text-xs text-[#5e554a] block">Roll number</span>
            <div className="text-2xl font-mono tabular-nums font-medium text-[#8c4a17] truncate">
              {admNum}
            </div>
            <span className="text-xs text-[#7b7266] block">
              Verified candidate registration
            </span>
          </div>
        </div>

        {/* Enter Live Examination Card (Solid raised surface instead of gradient banner) */}
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-lg">
            <span className="text-xs font-medium text-[#8c4a17] block">
              Live examination session
            </span>
            <h2 className="text-2xl font-serif font-medium text-[#1f1b16]">
              Enter 6-digit rolling passcode
            </h2>
            <p className="text-xs text-[#5e554a] leading-relaxed">
              Enter the 6-digit session code displayed by your instructor to unlock the examination paper and begin the timed session.
            </p>
            {joinError && <p className="text-xs text-[#dc2626] pt-1 font-medium">{joinError}</p>}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <form onSubmit={handleJoinSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                maxLength={6}
                value={rollingCode}
                onChange={(e) => setRollingCode(e.target.value.toUpperCase())}
                placeholder="849201"
                className="px-4 h-11 rounded-lg bg-[#f7f4ee] border border-[#dcd5c4] text-[#1f1b16] font-mono tabular-nums text-base font-medium tracking-widest focus:outline-none focus:border-[#8c4a17] w-full sm:w-44"
              />
              <button
                type="submit"
                className="px-5 h-11 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2 shrink-0"
              >
                <span>Join exam</span>
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </form>

            {onPreviewCurrentPaper && (
              <button
                type="button"
                onClick={onPreviewCurrentPaper}
                className="px-4 h-11 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] border border-[#dcd5c4] text-[#1f1b16] font-medium text-xs transition-calm flex items-center justify-center gap-1.5 shrink-0"
                title="Practice with the current studio question paper"
              >
                <Play className="w-3.5 h-3.5 text-[#5e554a]" strokeWidth={1.5} />
                <span>Practice current paper</span>
              </button>
            )}
          </div>
        </div>

        {/* Test History List */}
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#dcd5c4] pb-4">
            <div className="flex items-center gap-2 font-serif font-medium text-lg text-[#1f1b16]">
              <History className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
              <h2>Submission history and scorecards</h2>
            </div>

            <button
              type="button"
              onClick={loadTestHistory}
              className="p-2 h-8 w-8 rounded-lg text-[#5e554a] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
              title="Refresh history"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-[#7b7266]">
              Loading examination history
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-8 h-8 mx-auto text-[#7b7266]" strokeWidth={1.5} />
              <p className="text-sm font-serif font-medium text-[#1f1b16]">No completed assessments yet</p>
              <p className="text-xs text-[#5e554a]">Enter a 6-digit rolling passcode above or launch a practice paper</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((sub, idx) => {
                const perc = Math.round(parseFloat(sub.percentage) || 0);
                const isPassed = perc >= 40;

                return (
                  <div
                    key={sub.id || idx}
                    className="p-4 rounded-lg border border-[#dcd5c4] bg-[#f7f4ee] flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-medium text-base text-[#1f1b16]">
                          {sub.testTitle || sub.examTitle || 'Mathematics Assessment'}
                        </span>
                        {sub.is_dev_demo && (
                          <span className="text-[11px] bg-[#efe9df] text-[#5e554a] border border-[#dcd5c4] font-medium px-2 py-0.5 rounded">
                            Demo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#5e554a] font-mono tabular-nums">
                        <span>{new Date(sub.submitted_at || sub.submittedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Score: {sub.total_score ?? sub.finalScore?.score ?? 0} / {sub.max_possible ?? sub.finalScore?.total ?? 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-sm font-medium font-mono tabular-nums px-2.5 py-1 rounded-md border ${
                          isPassed
                            ? 'bg-[#f4f8f5] text-[#3f6b4a] border-[#3f6b4a]'
                            : 'bg-[#fdf2f2] text-[#dc2626] border-[#dc2626]'
                        }`}
                      >
                        {perc}%
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedReviewSub(sub)}
                        className="px-3 h-8 rounded-lg bg-[#fdfbf7] hover:bg-[#efe9df] border border-[#dcd5c4] text-[#1f1b16] text-xs font-medium transition-calm flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5e554a]" strokeWidth={1.5} />
                        <span>Inspect paper</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Digital QR Hall Ticket Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-[#161513]/60 flex items-center justify-center p-4 overflow-y-auto py-6 sm:py-8">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 max-w-sm w-full shadow-xl text-center space-y-5 my-auto">
            <div className="exam-rule-double pb-3">
              <span className="text-xs text-[#5e554a] block">Distance Learning Assessment</span>
              <h3 className="text-lg font-serif font-medium text-[#1f1b16] mt-0.5">Candidate Hall Ticket</h3>
            </div>

            <div className="bg-white border border-[#1f1b16] p-4 rounded-xl inline-block">
              <QRCodeSVG value={qrUrl} size={176} level="H" includeMargin={true} />
            </div>

            <div className="space-y-1 font-mono tabular-nums text-xs text-[#5e554a]">
              <p className="font-serif font-medium text-base text-[#1f1b16]">{student.full_name || student.fullName}</p>
              <p className="text-[#8c4a17] font-medium">Roll number: {admNum}</p>
              {student.dob && <p className="text-[#7b7266]">DOB: {student.dob}</p>}
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm"
            >
              Close ticket
            </button>
          </div>
        </div>
      )}

      {/* Join Classroom Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-[#161513]/60 flex items-center justify-center p-4 overflow-y-auto py-6 sm:py-8">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 font-sans my-auto">
            <div>
              <h3 className="text-lg font-serif font-medium text-[#1f1b16]">
                Join Instructor Classroom
              </h3>
              <p className="text-xs text-[#5e554a] mt-0.5">
                Enter your instructor's permanent Classroom Code (<span className="font-mono">CLASS-XXXXXX</span>) to enroll in their roster
              </p>
            </div>

            {linkError && <p className="text-xs text-[#dc2626] bg-[#fdf2f2] p-2.5 rounded-lg border border-[#dc2626]">{linkError}</p>}
            {linkSuccess && <p className="text-xs text-[#3f6b4a] bg-[#f4f8f5] p-2.5 rounded-lg border border-[#3f6b4a]">{linkSuccess}</p>}

            <form onSubmit={handleLinkTeacherSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#5e554a] mb-1">Classroom Code / Teacher Code</label>
                <input
                  type="text"
                  value={teacherInputCode}
                  onChange={(e) => setTeacherInputCode(e.target.value.toUpperCase())}
                  placeholder="CLASS-XXXXXX"
                  className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums font-medium text-sm text-[#8c4a17]"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium"
                >
                  {linking ? 'Enrolling...' : 'Join Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReviewSub && (
        <StudentPaperReviewModal
          submission={selectedReviewSub}
          onClose={() => setSelectedReviewSub(null)}
        />
      )}
    </div>
  );
}

function StudentPaperReviewModal({ submission, onClose }) {
  const responses = submission.responses || submission;
  const questions = responses.questions || [];
  const studentAnswers = responses.studentAnswers || {};

  return (
    <div className="fixed inset-0 z-50 bg-[#161513]/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 max-w-3xl w-full shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#dcd5c4] pb-4">
          <div>
            <h3 className="text-lg font-serif font-medium text-[#1f1b16]">
              Completed paper review
            </h3>
            <p className="text-xs text-[#5e554a] font-mono tabular-nums mt-0.5">
              {submission.testTitle || 'Assessment'} • Score: {submission.total_score ?? responses.finalScore?.score ?? 0} / {submission.max_possible ?? responses.finalScore?.total ?? 0} ({Math.round(parseFloat(submission.percentage) || 0)}%)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 h-8 rounded-lg bg-[#efe9df] text-[#1f1b16] font-medium text-xs"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const studentAns = studentAnswers[q.id];
            const isMcq = q.type === 'mcq' || q.type === 'match_following';
            const optionLetters = ['A', 'B', 'C', 'D', 'E'];

            let isCorrect = false;
            if (isMcq) {
              isCorrect = studentAns === q.correctAnswer;
            } else if (q.type === 'short_answer_numeric') {
              const numVal = parseFloat(studentAns);
              if (Array.isArray(q.acceptedRange) && typeof numVal === 'number' && !isNaN(numVal)) {
                isCorrect = numVal >= q.acceptedRange[0] && numVal <= q.acceptedRange[1];
              }
            }

            return (
              <div key={q.id || idx} className="p-4 rounded-xl border border-[#dcd5c4] bg-[#f7f4ee] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-medium text-sm text-[#1f1b16] tabular-nums">
                    Q{idx + 1}.
                  </span>
                  <span
                    className={`text-xs font-mono tabular-nums font-medium px-2.5 py-0.5 rounded-md flex items-center gap-1 border ${
                      isCorrect
                        ? 'bg-[#f4f8f5] border-[#3f6b4a] text-[#3f6b4a]'
                        : 'bg-[#fdf2f2] border-[#dc2626] text-[#dc2626]'
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} /> : <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    <span>{isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}</span>
                  </span>
                </div>

                <div className="text-base font-serif text-[#1f1b16]">
                  <MathRenderer text={q.questionText} readOnly={true} />
                </div>

                {isMcq && Array.isArray(q.options) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    {q.options.map((opt, optIdx) => {
                      const letter = optionLetters[optIdx] || optIdx;
                      const isStudentSelected = studentAns === optIdx;
                      const isKey = q.correctAnswer === optIdx;

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${
                            isKey
                              ? 'bg-[#f4f8f5] border-[#3f6b4a] font-medium'
                              : isStudentSelected
                              ? 'bg-[#fdf2f2] border-[#dc2626]'
                              : 'bg-[#fdfbf7] border-[#dcd5c4]'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-mono font-medium ${
                              isKey ? 'bg-[#3f6b4a] text-[#fdfbf7]' : 'bg-[#efe9df] text-[#5e554a]'
                            }`}
                          >
                            {letter}
                          </span>
                          <div className="flex-1 min-w-0 font-serif text-sm">
                            <MathRenderer text={opt} readOnly={true} />
                          </div>
                          {isKey && <span className="text-[11px] text-[#3f6b4a] font-medium ml-auto">Key</span>}
                          {isStudentSelected && !isKey && <span className="text-[11px] text-[#dc2626] font-medium ml-auto">Selected</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
