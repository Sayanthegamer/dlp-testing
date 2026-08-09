import React, { useState, useEffect } from 'react';
import { LogOut, Award, PlayCircle, History, Clock, FileText, CheckCircle, XCircle, ChevronRight, RefreshCw, Eye } from 'lucide-react';
import { fetchStudentHistory, logoutStudent } from '../../services/apiService';
import MathRenderer from '../PreviewPanel/MathRenderer';

export default function StudentPortal({ student, onJoinExam, onLogout }) {
  const [rollingCode, setRollingCode] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedReviewSub, setSelectedReviewSub] = useState(null);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    loadTestHistory();
  }, [student]);

  const loadTestHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchStudentHistory();
      setHistory(data);
    } catch (err) {
      console.warn('[Student Portal History Load Error]:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!rollingCode.trim() || rollingCode.trim().length < 6) {
      setJoinError('Please enter a valid 6-digit exam rolling code.');
      return;
    }
    setJoinError('');
    onJoinExam(rollingCode.trim());
  };

  const totalTests = history.length;
  const avgPercentage = totalTests > 0
    ? Math.round(history.reduce((acc, h) => acc + (parseFloat(h.percentage) || 0), 0) / totalTests)
    : 0;

  return (
    <div className="min-h-screen bg-[#f7f3ed] text-[#1c1b18] p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Student Banner */}
        <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 sm:p-8 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center font-serif font-bold text-xl shadow-md shrink-0">
              {student.full_name ? student.full_name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#2c2825]">
                  {student.full_name || student.fullName}
                </h1>
                <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Student Profile
                </span>
              </div>
              <p className="text-xs font-mono text-[#736c62] mt-0.5">
                Admission Number: <span className="font-bold text-[#8c4a17]">{student.admission_number || student.admissionNumber}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logoutStudent();
              onLogout();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all cursor-pointer border border-red-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#e5dcd0] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#8c4a17] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#736c62] uppercase tracking-wider font-semibold block">Exams Completed</span>
              <span className="text-xl font-bold font-mono text-[#1c1b18]">{totalTests}</span>
            </div>
          </div>

          <div className="bg-white border border-[#e5dcd0] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#736c62] uppercase tracking-wider font-semibold block">Average Performance</span>
              <span className="text-xl font-bold font-mono text-emerald-700">{avgPercentage}%</span>
            </div>
          </div>

          <div className="bg-white border border-[#e5dcd0] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#736c62] uppercase tracking-wider font-semibold block">Status</span>
              <span className="text-xs font-bold text-purple-800">Active Candidate</span>
            </div>
          </div>
        </div>

        {/* Join Active Exam Box */}
        <div className="bg-gradient-to-r from-[#8c4a17] to-[#a86e2d] text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
          <div className="max-w-xl space-y-3 relative z-10">
            <div className="flex items-center gap-2 text-amber-200 text-xs font-bold uppercase tracking-wider">
              <PlayCircle className="w-4 h-4" />
              <span>Take Live Examination</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold leading-tight">
              Enter Exam Rolling Code
            </h2>
            <p className="text-xs sm:text-sm text-amber-100 leading-relaxed">
              Enter the 6-digit code provided by your teacher to start your proctored test session.
            </p>

            <form onSubmit={handleJoinSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                maxLength={6}
                value={rollingCode}
                onChange={(e) => setRollingCode(e.target.value.toUpperCase())}
                placeholder="6-Digit Code (e.g. 849201)"
                className="px-4 py-3 rounded-2xl bg-white text-[#1c1b18] font-mono text-lg font-bold tracking-widest focus:outline-none shadow-inner w-full sm:w-64 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:font-normal"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-[#2c2825] hover:bg-black text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <span>Start Test Now</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
            {joinError && <p className="text-xs text-red-200 font-medium">{joinError}</p>}
          </div>
        </div>

        {/* Test History List */}
        <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#e2d8ca] pb-4">
            <div className="flex items-center gap-2 font-serif font-bold text-lg sm:text-xl text-[#2c2825]">
              <History className="w-5 h-5 text-[#8c4a17]" />
              <h2>My Test History & Scorecards</h2>
            </div>

            <button
              type="button"
              onClick={loadTestHistory}
              className="p-2 rounded-xl text-[#736c62] hover:bg-[#f0e6d8] transition-colors"
              title="Refresh Test History"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-[#736c62]">
              Loading your exam history...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-10 h-10 mx-auto text-[#c9bea9]" />
              <p className="text-sm font-semibold text-[#5c5346]">No completed exams found yet.</p>
              <p className="text-xs text-[#8c8275]">Enter a 6-digit rolling code above to take your first test.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((sub, idx) => {
                const perc = parseFloat(sub.percentage) || 0;
                const isPassed = perc >= 40;

                return (
                  <div
                    key={sub.id || idx}
                    className="p-4 rounded-2xl border border-[#e5dcd0] bg-white hover:border-[#a86e2d] transition-all flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-base text-[#1c1b18]">
                          {sub.testTitle || sub.examTitle || 'Mathematics Exam'}
                        </span>
                        {sub.is_dev_demo && (
                          <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded-md">
                            DEV DEMO
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#736c62] font-mono">
                        <span>Submitted: {new Date(sub.submitted_at || sub.submittedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Score: {sub.total_score || sub.finalScore?.score || 0} / {sub.max_possible || sub.finalScore?.total || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-base font-bold font-mono px-3 py-1 rounded-xl border ${
                        isPassed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}>
                        {perc}%
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedReviewSub(sub)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#f0e6d8] hover:bg-[#e4dbcc] text-[#4a4237] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#8c4a17]" />
                        <span>Review Paper</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Answer Key & Paper Review Modal */}
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
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#e2d8ca] pb-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-[#2c2825]">
              Question Paper Detailed Review
            </h3>
            <p className="text-xs text-[#736c62] font-mono mt-0.5">
              {submission.testTitle || 'Exam'} • Score: {submission.total_score || responses.finalScore?.score} / {submission.max_possible || responses.finalScore?.total} ({submission.percentage}%)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#736c62] hover:bg-[#f0e6d8] font-bold text-xs"
          >
            Close
          </button>
        </div>

        <div className="space-y-6">
          {questions.map((q, idx) => {
            const studentAns = studentAnswers[q.id];
            const isMcq = q.type === 'mcq';
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
              <div key={q.id || idx} className="p-4 sm:p-5 rounded-2xl border border-[#e2d8ca] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-[#8c4a17]">
                    Question #{idx + 1}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isCorrect ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{isCorrect ? 'Correct (+4)' : 'Incorrect (0)'}</span>
                  </span>
                </div>

                <div className="text-sm font-serif text-[#1c1b18]">
                  <MathRenderer text={q.questionText} readOnly={true} />
                </div>

                {isMcq && Array.isArray(q.options) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                    {q.options.map((opt, optIdx) => {
                      const letter = optionLetters[optIdx] || optIdx;
                      const isStudentSelected = studentAns === optIdx;
                      const isKey = q.correctAnswer === optIdx;

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                            isKey
                              ? 'bg-emerald-50 border-emerald-400 font-bold'
                              : isStudentSelected
                              ? 'bg-red-50 border-red-300'
                              : 'bg-[#faf7f2] border-[#e2d8ca]'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isKey ? 'bg-emerald-700 text-white' : 'bg-[#e2d8ca] text-[#4a4237]'
                          }`}>
                            {letter}
                          </span>
                          <div className="flex-1 min-w-0">
                            <MathRenderer text={opt} readOnly={true} />
                          </div>
                          {isKey && <span className="text-[10px] text-emerald-800 font-bold ml-auto">Correct Key</span>}
                          {isStudentSelected && !isKey && <span className="text-[10px] text-red-800 font-bold ml-auto">Your Answer</span>}
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
