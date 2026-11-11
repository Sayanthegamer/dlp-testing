import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Printer,
  Search,
  RefreshCw,
  Contact,
  KeyRound,
  UserCheck,
  Clock,
  FileText,
  Edit3,
  Trash2,
  X,
  ShieldAlert,
  Award,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import {
  fetchTeacherRoster,
  teacherCreateStudent,
  generateAdmissionNumber,
  fetchTeacherRollingRefCode,
  regenerateTeacherRollingRefCode,
  teacherAddExistingStudent,
  fetchStudentDossier,
  updateStudentProfile,
  deleteStudentFromRoster,
  fetchTeacherClassCode
} from '../../services/apiService';
import StudentCredentialCardsModal from './StudentCredentialCardsModal';
import ResultPrintModal from '../Student/ResultPrintModal';

export default function StudentRosterTab() {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintRoster, setSelectedPrintRoster] = useState([]);

  // Dossier & Edit State
  const [activeDossier, setActiveDossier] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAdm, setEditAdm] = useState('');
  const [editDob, setEditDob] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedAttemptForPrint, setSelectedAttemptForPrint] = useState(null);

  const [teacherRefCode, setTeacherRefCode] = useState('');
  const [codeTimer, setCodeTimer] = useState(300);
  const [classCode, setClassCode] = useState('CLASS-DEMO26');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [admNum, setAdmNum] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [claimAdmNum, setClaimAdmNum] = useState('');
  const [claimStudentRefCode, setClaimStudentRefCode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    loadRoster();
    loadTeacherCode();
    loadTeacherClassCode();
  }, []);

  const loadTeacherClassCode = async () => {
    try {
      const res = await fetchTeacherClassCode();
      if (res && res.classCode) {
        setClassCode(res.classCode);
      }
    } catch (_) {}
  };

  const handleCopyClassCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(classCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyInviteLink = () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?mode=student&tab=signup&classCode=${encodeURIComponent(classCode)}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCodeTimer((prev) => {
        if (prev <= 1) {
          loadTeacherCode();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTeacherCode = async () => {
    try {
      const res = await fetchTeacherRollingRefCode();
      if (res && res.refCode) {
        setTeacherRefCode(res.refCode);
        if (res.expiresInSeconds) setCodeTimer(res.expiresInSeconds);
      }
    } catch (_) {}
  };

  const handleRegenerateCode = async () => {
    try {
      const res = await regenerateTeacherRollingRefCode();
      if (res && res.refCode) {
        setTeacherRefCode(res.refCode);
        if (res.expiresInSeconds) setCodeTimer(res.expiresInSeconds);
      }
    } catch (_) {}
  };

  const loadRoster = async () => {
    setLoading(true);
    try {
      const data = await fetchTeacherRoster();
      setRoster(data || []);
    } catch (_) {} finally {
      setLoading(false);
    }
  };

  const handleOpenDossier = async (student) => {
    setDossierLoading(true);
    setDossierError('');
    setEditingStudent(null);
    setActiveDossier({
      student,
      metrics: { totalAttempts: 0, averagePercentage: 0, bestPercentage: 0, flaggedAttempts: 0 },
      submissions: []
    });
    try {
      const data = await fetchStudentDossier(student.id || student.admission_number);
      if (data && data.student) {
        setActiveDossier(data);
      }
    } catch (err) {
      setDossierError(err.message || 'Could not load candidate dossier.');
    } finally {
      setDossierLoading(false);
    }
  };

  const handleStartEditStudent = (student) => {
    setEditingStudent(student);
    setEditName(student.full_name || student.fullName || '');
    setEditAdm(student.admission_number || student.admissionNumber || '');
    setEditDob(student.dob || '');
  };

  const handleSaveStudentEdit = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSavingEdit(true);
    setDossierError('');
    try {
      const res = await updateStudentProfile(editingStudent.id, {
        fullName: editName,
        admissionNumber: editAdm,
        dob: editDob
      });
      if (res && res.student) {
        setEditingStudent(null);
        loadRoster();
        if (activeDossier) {
          setActiveDossier(prev => ({ ...prev, student: res.student }));
        }
      }
    } catch (err) {
      setDossierError(err.message || 'Could not update student record.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    try {
      await deleteStudentFromRoster(studentId);
      setActiveDossier(null);
      loadRoster();
    } catch (err) {
      setDossierError(err.message || 'Could not remove student.');
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!admNum.trim() || !fullName.trim() || !dob) {
      setAddError('Fill in all fields');
      return;
    }
    setAddError('');
    setAddSuccess('');
    setSubmitting(true);

    try {
      const res = await teacherCreateStudent(null, admNum.trim(), fullName.trim(), dob);
      if (res && res.student) {
        setAddSuccess(`Enrolled ${res.student.full_name} (${res.student.admission_number})`);
        setAdmNum(generateAdmissionNumber());
        setFullName('');
        setDob('');
        loadRoster();
      }
    } catch (err) {
      setAddError(err.message || 'Could not enroll student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimStudent = async (e) => {
    e.preventDefault();
    const trimmedAdm = claimAdmNum.trim().toUpperCase();
    const trimmedRef = claimStudentRefCode.trim().toUpperCase();
    if (!trimmedAdm && !trimmedRef) {
      setClaimError('Enter an exact Roll Number (DLP-26-XXXXX) or a 5-minute Student Reference Code (STU-XXXXXX)');
      return;
    }
    setClaimError('');
    setClaimSuccess('');
    setClaiming(true);

    try {
      const res = await teacherAddExistingStudent(trimmedAdm, trimmedRef, '');
      if (res && res.success) {
        setClaimSuccess(`Added ${res.student.full_name || res.student.admission_number} to your roster`);
        setClaimAdmNum('');
        setClaimStudentRefCode('');
        loadRoster();
      }
    } catch (err) {
      setClaimError(
        err.message ||
          'No student found matching that exact Roll Number or valid 5-minute Reference Code'
      );
    } finally {
      setClaiming(false);
    }
  };

  const formatSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredRoster = roster.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(query) ||
      (s.admission_number || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Roster Header & Permanent Class Code / Invite Link */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-4 sm:p-6 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 font-serif font-medium text-lg sm:text-xl text-[#1f1b16]">
            <Users className="w-5 h-5 text-[#5e554a]" strokeWidth={1.5} />
            <h2>Student roster, dossiers, and classroom codes</h2>
          </div>
          <p className="text-xs text-[#5e554a] font-sans">
            Share your permanent classroom code or invite link, enroll students by Roll No., or print QR admit cards
          </p>
        </div>

        {/* Permanent Classroom Code & 1-Click Invite Link */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg px-3.5 sm:px-4 py-2 flex items-center gap-3 shadow-2xs">
            <div>
              <div className="flex items-center gap-1 text-[11px] text-[#5e554a]">
                <KeyRound className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                <span>Classroom Code</span>
              </div>
              <div className="font-mono tabular-nums font-bold text-sm text-[#1f1b16] tracking-wider">
                {classCode}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyClassCode}
              className="text-xs text-[#8c4a17] hover:underline font-medium flex items-center gap-1 ml-1"
              title="Copy Classroom Code"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-[#2b5a38]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="px-3.5 h-9 rounded-lg bg-[#efe9df] border border-[#dcd5c4] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium transition-calm flex items-center gap-1.5"
            title="Copy student invite link with class code pre-filled"
          >
            {copiedLink ? <Check className="w-4 h-4 text-[#2b5a38]" /> : <Share2 className="w-4 h-4 text-[#8c4a17]" strokeWidth={1.5} />}
            <span>{copiedLink ? 'Invite Link Copied!' : 'Copy student invite link'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowClaimModal(true)}
            className="flex-1 sm:flex-none px-3.5 h-9 rounded-lg bg-[#efe9df] border border-[#dcd5c4] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium transition-calm flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
            <span>Add by Roll No.</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdmNum(generateAdmissionNumber());
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none px-3.5 h-9 rounded-lg bg-[#efe9df] border border-[#dcd5c4] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium transition-calm flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
            <span>Enroll student</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPrintRoster(roster);
              setShowPrintModal(true);
            }}
            disabled={roster.length === 0}
            className="w-full sm:w-auto px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" strokeWidth={1.5} />
            <span className="tabular-nums">Print admit cards ({roster.length})</span>
          </button>
        </div>
      </div>

      {/* Roster Table & Mobile Card List */}
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-4 sm:p-6 space-y-4 font-sans print:hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or roll number"
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#f7f4ee] text-xs text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
            />
            <Search className="w-4 h-4 text-[#7b7266] absolute left-3 top-2.5" strokeWidth={1.5} />
          </div>

          <button
            type="button"
            onClick={loadRoster}
            className="px-3 h-8 rounded-lg text-[#5e554a] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#7b7266]">
            Loading student roster
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Contact className="w-8 h-8 mx-auto text-[#7b7266]" strokeWidth={1.5} />
            <p className="text-sm font-serif font-medium text-[#1f1b16]">No students enrolled yet</p>
            <p className="text-xs text-[#5e554a]">Click Enroll student to register candidates and print QR hall tickets</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-[#efe9df]">
              {filteredRoster.map((st, idx) => (
                <div key={st.id || idx} className="py-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => handleOpenDossier(st)}
                        className="font-serif font-medium text-base text-[#1f1b16] hover:text-[#8c4a17] hover:underline text-left block"
                      >
                        {st.full_name || st.fullName}
                      </button>
                      <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#5e554a] mt-0.5">
                        <span className="font-medium text-[#1f1b16]">{st.admission_number || st.admissionNumber}</span>
                        <span>•</span>
                        <span>DOB: {st.dob}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#7b7266] tabular-nums shrink-0">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenDossier(st)}
                      className="flex-1 h-8 rounded-lg bg-[#f7f4ee] border border-[#dcd5c4] hover:border-[#8c4a17] text-[#1f1b16] text-xs font-medium transition-calm inline-flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                      <span>Dossier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPrintRoster([st]);
                        setShowPrintModal(true);
                      }}
                      className="flex-1 h-8 rounded-lg bg-[#efe9df] hover:bg-[#1f1b16] text-[#1f1b16] hover:text-[#fdfbf7] text-xs font-medium transition-calm inline-flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Hall ticket</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#dcd5c4] text-[#5e554a] font-medium">
                    <th className="pb-3 px-3 w-12">#</th>
                    <th className="pb-3 px-3">Roll number</th>
                    <th className="pb-3 px-3">Candidate name</th>
                    <th className="pb-3 px-3">Date of birth</th>
                    <th className="pb-3 px-3">Enrolled</th>
                    <th className="pb-3 px-3 text-right">Dossier &amp; admit card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efe9df]">
                  {filteredRoster.map((st, idx) => (
                    <tr key={st.id || idx} className="hover:bg-[#f7f4ee] transition-calm">
                      <td className="py-3 px-3 font-mono tabular-nums text-[#7b7266]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums font-medium text-[#1f1b16]">
                        {st.admission_number || st.admissionNumber}
                      </td>
                      <td className="py-3 px-3 font-serif font-medium text-sm text-[#1f1b16]">
                        <button
                          type="button"
                          onClick={() => handleOpenDossier(st)}
                          className="hover:text-[#8c4a17] hover:underline text-left"
                        >
                          {st.full_name || st.fullName}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-[#5e554a]">
                        {st.dob}
                      </td>
                      <td className="py-3 px-3 text-[#7b7266] font-mono tabular-nums">
                        {st.created_at ? new Date(st.created_at).toLocaleDateString() : 'Active'}
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDossier(st)}
                          className="px-3 h-7 rounded-md bg-[#f7f4ee] border border-[#dcd5c4] hover:border-[#8c4a17] text-[#1f1b16] text-xs font-medium transition-calm inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                          <span>Dossier</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPrintRoster([st]);
                            setShowPrintModal(true);
                          }}
                          className="px-3 h-7 rounded-md bg-[#efe9df] hover:bg-[#1f1b16] text-[#1f1b16] hover:text-[#fdfbf7] text-xs font-medium transition-calm inline-flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>Hall ticket</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Candidate Academic Dossier Modal */}
      {activeDossier && (
        <div className="fixed inset-0 z-50 bg-[#161513]/65 flex items-center justify-center p-4 overflow-y-auto print:hidden modal-backdrop-animated">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-8 max-w-3xl w-full shadow-xl space-y-6 max-h-[90vh] overflow-y-auto font-sans modal-card-animated">
            <div className="exam-rule-double pb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#7b7266] block">
                  CANDIDATE ACADEMIC DOSSIER
                </span>
                <h3 className="text-2xl font-serif font-semibold text-[#1f1b16] mt-0.5">
                  {activeDossier.student.full_name || activeDossier.student.fullName}
                </h3>
                <div className="text-xs font-mono tabular-nums text-[#5e554a] mt-1 flex flex-wrap items-center gap-3">
                  <span>Roll No: <strong className="text-[#1f1b16]">{activeDossier.student.admission_number || activeDossier.student.admissionNumber}</strong></span>
                  <span>•</span>
                  <span>DOB: {activeDossier.student.dob}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPrintRoster([activeDossier.student]);
                    setShowPrintModal(true);
                  }}
                  className="px-3 h-8 rounded-lg bg-[#efe9df] border border-[#dcd5c4] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Print admit card</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEditStudent(activeDossier.student)}
                  className="px-3 h-8 rounded-lg bg-[#efe9df] border border-[#dcd5c4] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStudent(activeDossier.student.id)}
                  className="px-3 h-8 rounded-lg bg-[#fdf2f2] border border-[#dc2626]/30 hover:bg-[#dc2626] text-[#dc2626] hover:text-white text-xs font-medium flex items-center gap-1.5 transition-calm"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Remove</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDossier(null)}
                  className="p-2 h-8 w-8 rounded-lg text-[#5e554a] hover:bg-[#efe9df] flex items-center justify-center"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {dossierError && (
              <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs">
                {dossierError}
              </div>
            )}

            {/* Inline Edit Profile Form */}
            {editingStudent && (
              <form onSubmit={handleSaveStudentEdit} className="p-4 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4] space-y-3 text-xs">
                <div className="font-serif font-medium text-sm text-[#1f1b16]">Update candidate identity</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#5e554a] mb-1">Full name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2.5 h-8 rounded border border-[#dcd5c4] bg-white text-[#1f1b16]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[#5e554a] mb-1">Roll / admission No.</label>
                    <input
                      type="text"
                      value={editAdm}
                      onChange={(e) => setEditAdm(e.target.value.toUpperCase())}
                      className="w-full px-2.5 h-8 rounded border border-[#dcd5c4] bg-white font-mono text-[#1f1b16]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[#5e554a] mb-1">Date of birth</label>
                    <input
                      type="date"
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="w-full px-2.5 h-8 rounded border border-[#dcd5c4] bg-white font-mono text-[#1f1b16]"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-3 h-8 rounded bg-[#efe9df] text-[#1f1b16]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-3.5 h-8 rounded bg-[#8c4a17] text-white font-medium"
                  >
                    {savingEdit ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Dossier Performance Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4]">
                <span className="text-[11px] text-[#7b7266] block">Scripts submitted</span>
                <strong className="font-mono tabular-nums text-xl text-[#1f1b16]">
                  {activeDossier.metrics?.totalAttempts ?? 0}
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4]">
                <span className="text-[11px] text-[#7b7266] block">Mean accuracy</span>
                <strong className="font-mono tabular-nums text-xl text-[#3f6b4a]">
                  {activeDossier.metrics?.averagePercentage ?? 0}%
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4]">
                <span className="text-[11px] text-[#7b7266] block">Highest score</span>
                <strong className="font-mono tabular-nums text-xl text-[#8c4a17]">
                  {activeDossier.metrics?.bestPercentage ?? 0}%
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4]">
                <span className="text-[11px] text-[#7b7266] block">Focus alerts</span>
                <strong className="font-mono tabular-nums text-xl text-[#b8622e]">
                  {activeDossier.metrics?.flaggedAttempts ?? 0}
                </strong>
              </div>
            </div>

            {/* Examination Submission History */}
            <div className="space-y-3">
              <h4 className="font-serif font-medium text-base text-[#1f1b16]">
                Examination script history
              </h4>

              {dossierLoading ? (
                <div className="py-8 text-center text-xs text-[#7b7266]">
                  Loading candidate script records...
                </div>
              ) : !activeDossier.submissions || activeDossier.submissions.length === 0 ? (
                <div className="p-8 rounded-xl border border-[#dcd5c4] bg-[#f7f4ee] text-center space-y-1">
                  <Award className="w-6 h-6 text-[#7b7266] mx-auto" strokeWidth={1.5} />
                  <p className="text-xs font-medium text-[#1f1b16]">No examination scripts recorded yet</p>
                  <p className="text-[11px] text-[#5e554a]">Completed examination attempts by this candidate will appear here automatically.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#dcd5c4] rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#dcd5c4] bg-[#f7f4ee] text-[#5e554a]">
                        <th className="py-2.5 px-3">Examination paper</th>
                        <th className="py-2.5 px-3">Submitted</th>
                        <th className="py-2.5 px-3">Score</th>
                        <th className="py-2.5 px-3">Accuracy</th>
                        <th className="py-2.5 px-3 text-right">Script report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efe9df]">
                      {activeDossier.submissions.map((sub, sIdx) => (
                        <tr key={sub.id || sIdx} className="hover:bg-[#f7f4ee]">
                          <td className="py-2.5 px-3 font-serif font-medium text-sm text-[#1f1b16]">
                            <div className="flex items-center gap-1.5">
                              <span>{sub.testTitle}</span>
                              {sub.cheatingFlagged && (
                                <ShieldAlert className="w-3.5 h-3.5 text-[#dc2626]" title={sub.cheatingReason || 'Proctoring alert'} />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-[#5e554a]">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recorded'}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-medium text-[#1f1b16]">
                            {sub.score} / {sub.maxScore}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-[#3f6b4a]">
                            {sub.percentage}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {Array.isArray(sub.questions) && sub.questions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedAttemptForPrint(sub)}
                                className="px-2.5 h-7 rounded bg-[#efe9df] hover:bg-[#1f1b16] text-[#1f1b16] hover:text-[#fdfbf7] text-xs font-medium inline-flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" strokeWidth={1.5} />
                                <span>Scorecard</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Candidate Scorecard Modal from Dossier */}
      {selectedAttemptForPrint && (
        <ResultPrintModal
          testTitle={selectedAttemptForPrint.testTitle}
          studentName={activeDossier?.student?.full_name || 'Candidate'}
          questions={selectedAttemptForPrint.questions || []}
          studentAnswers={selectedAttemptForPrint.studentAnswers || {}}
          onClose={() => setSelectedAttemptForPrint(null)}
        />
      )}

      {/* Enroll Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#161513]/60 flex items-center justify-center p-4 overflow-y-auto modal-backdrop-animated">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 font-sans my-auto modal-card-animated">
            <h3 className="text-lg font-serif font-medium text-[#1f1b16]">
              Enroll candidate profile
            </h3>

            {addError && <p className="text-xs text-[#dc2626] bg-[#fdf2f2] p-2.5 rounded-lg border border-[#dc2626]">{addError}</p>}
            {addSuccess && <p className="text-xs text-[#3f6b4a] bg-[#f4f8f5] p-2.5 rounded-lg border border-[#3f6b4a]">{addSuccess}</p>}

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#5e554a] mb-1">Candidate full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ananya Roy"
                  className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-[#5e554a]">Admission / roll number</label>
                  <button
                    type="button"
                    onClick={() => setAdmNum(generateAdmissionNumber())}
                    className="text-[11px] font-medium text-[#8c4a17] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                    <span>Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={admNum}
                  onChange={(e) => setAdmNum(e.target.value.replace(/[^A-Za-z0-9_\-]/g, '').toUpperCase())}
                  placeholder="DLP-26-8K39X"
                  className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums font-medium text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[#5e554a] mb-1">Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium"
                >
                  {submitting ? 'Saving' : 'Save student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add by Roll No. / Existing Student Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-[#161513]/60 flex items-center justify-center p-4 overflow-y-auto modal-backdrop-animated">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 font-sans my-auto modal-card-animated">
            <div>
              <h3 className="text-lg font-serif font-medium text-[#1f1b16]">
                Add Student to Classroom Roster
              </h3>
              <p className="text-xs text-[#5e554a] mt-0.5">
                Enter the student&apos;s exact Roll Number (<span className="font-mono">DLP-26-XXXXX</span>) or their 5-minute Student Reference Code (<span className="font-mono">STU-XXXXXX</span>) to enroll them in your classroom.
              </p>
            </div>

            {claimError && <p className="text-xs text-[#dc2626] bg-[#fdf2f2] p-2.5 rounded-lg border border-[#dc2626]">{claimError}</p>}
            {claimSuccess && <p className="text-xs text-[#3f6b4a] bg-[#f4f8f5] p-2.5 rounded-lg border border-[#3f6b4a]">{claimSuccess}</p>}

            <form onSubmit={handleClaimStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#5e554a] mb-1">
                  Exact Roll Number <span className="text-[10px] text-[#7b7266] font-normal">(or leave blank if using Reference Code)</span>
                </label>
                <input
                  type="text"
                  value={claimAdmNum}
                  onChange={(e) => setClaimAdmNum(e.target.value.toUpperCase())}
                  placeholder="DLP-26-XXXXX"
                  className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums font-medium text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-medium text-[#5e554a] mb-1">
                  5-minute Student Reference Code <span className="text-[10px] text-[#7b7266] font-normal">(Optional if Roll No. provided)</span>
                </label>
                <input
                  type="text"
                  value={claimStudentRefCode}
                  onChange={(e) => setClaimStudentRefCode(e.target.value.toUpperCase())}
                  placeholder="STU-XXXXXX"
                  className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums font-medium text-sm text-[#8c4a17] focus:outline-none focus:border-[#8c4a17]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={claiming}
                  className="px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium"
                >
                  {claiming ? 'Adding...' : 'Add to Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrintModal && (
        <StudentCredentialCardsModal
          roster={selectedPrintRoster.length > 0 ? selectedPrintRoster : roster}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
