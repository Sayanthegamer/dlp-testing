import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Printer, Search, RefreshCw, Contact, Calendar, CheckCircle } from 'lucide-react';
import { fetchTeacherRoster, teacherCreateStudent, generateAdmissionNumber } from '../../services/apiService';
import StudentCredentialCardsModal from './StudentCredentialCardsModal';

export default function StudentRosterTab() {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Add Student Form State
  const [admNum, setAdmNum] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRoster();
  }, []);

  const loadRoster = async () => {
    setLoading(true);
    try {
      const data = await fetchTeacherRoster();
      setRoster(data || []);
    } catch (err) {
      console.warn('[Roster Load Error]:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!admNum.trim() || !fullName.trim() || !dob) {
      setAddError('Please fill in all fields.');
      return;
    }
    setAddError('');
    setAddSuccess('');
    setSubmitting(true);

    try {
      const res = await teacherCreateStudent(null, admNum.trim(), fullName.trim(), dob);
      if (res && res.student) {
        setAddSuccess(`Enrolled student ${res.student.full_name} (${res.student.admission_number}) successfully!`);
        setAdmNum('');
        setFullName('');
        setDob('');
        loadRoster();
      }
    } catch (err) {
      setAddError(err.message || 'Failed to enroll student. Admission number may already exist.');
    } finally {
      setSubmitting(false);
    }
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
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 font-serif font-bold text-xl sm:text-2xl text-[#2c2825]">
            <Users className="w-6 h-6 text-[#8c4a17]" />
            <h2>Student Batch Roster & Admit Cards</h2>
          </div>
          <p className="text-xs text-[#736c62] font-sans mt-1">
            Manage student candidates enrolled in your institute and print physical DLP Admit Cards
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAdmNum(generateAdmissionNumber());
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#8c4a17] hover:bg-[#733b11] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Student</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            disabled={roster.length === 0}
            className="px-4 py-2.5 rounded-xl bg-[#2c2825] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print WYSIWYG Credential Cards ({roster.length})</span>
          </button>
        </div>
      </div>

      {/* Search & Roster Table */}
      <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 shadow-sm space-y-4 font-sans">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name or Admission #..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#c9bea9] bg-white text-xs text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
            />
            <Search className="w-3.5 h-3.5 text-[#8c8275] absolute left-3 top-2.5" />
          </div>

          <button
            type="button"
            onClick={loadRoster}
            className="p-2 rounded-xl text-[#736c62] hover:bg-[#f0e6d8] transition-colors text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Roster</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#736c62]">
            Loading student roster...
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Contact className="w-10 h-10 mx-auto text-[#c9bea9]" />
            <p className="text-sm font-semibold text-[#5c5346]">No students enrolled in roster yet.</p>
            <p className="text-xs text-[#8c8275]">Click "Enroll New Student" to add candidate profiles.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e2d8ca] text-[#736c62] uppercase tracking-wider font-semibold">
                  <th className="pb-3 px-3">#</th>
                  <th className="pb-3 px-3">Admission Number</th>
                  <th className="pb-3 px-3">Candidate Name</th>
                  <th className="pb-3 px-3">Date of Birth (Login Key)</th>
                  <th className="pb-3 px-3">Enrolled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e6d8]">
                {filteredRoster.map((st, idx) => (
                  <tr key={st.id || idx} className="hover:bg-[#faf7f2] transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-[#8c4a17]">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-[#1c1b18]">
                      {st.admission_number || st.admissionNumber}
                    </td>
                    <td className="py-3.5 px-3 font-serif font-bold text-sm text-[#2c2825]">
                      {st.full_name || st.fullName}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[#4a4237]">
                      {st.dob}
                    </td>
                    <td className="py-3.5 px-3 text-[#736c62] font-mono">
                      {st.created_at ? new Date(st.created_at).toLocaleDateString() : 'Active'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#1c1b18]/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 font-sans">
            <h3 className="text-xl font-serif font-bold text-[#2c2825]">
              Enroll Candidate Profile
            </h3>

            {addError && <p className="text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200">{addError}</p>}
            {addSuccess && <p className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">{addSuccess}</p>}

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#4a4237] mb-1">Candidate Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Roy"
                  className="w-full px-3 py-2 rounded-xl border border-[#c9bea9] bg-white text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-[#4a4237]">Admission / Roll Number *</label>
                  <button
                    type="button"
                    onClick={() => setAdmNum(generateAdmissionNumber())}
                    className="text-[11px] font-bold text-[#8c4a17] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={admNum}
                  onChange={(e) => setAdmNum(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                  placeholder="Auto-generated e.g. ADM8K9P2"
                  className="w-full px-3 py-2 rounded-xl border border-[#c9bea9] bg-white font-mono font-bold tracking-wider text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#4a4237] mb-1">Date of Birth (DOB) *</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#c9bea9] bg-white text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#f0e6d8] hover:bg-[#e4dbcc] text-[#4a4237] font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8c4a17] hover:bg-[#733b11] text-white font-bold"
                >
                  {submitting ? 'Enrolling...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WYSIWYG Credentials Modal */}
      {showPrintModal && (
        <StudentCredentialCardsModal
          roster={roster}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
