import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft } from 'lucide-react';

export const EditProfileView = ({ onBack }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser(userData);
          setUsername(userData.username || '');
          setFullName(userData.fullName || '');
          setDob(userData.dob || '');
          setGender(userData.gender || '');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    try {
      const updates: Record<string, any> = { fullName };
      if (dob) updates.dob = dob;
      if (gender) updates.gender = gender;
      await updateDoc(doc(db, 'users', user.id), updates);
      onBack();
    } catch (error) {
      console.error("Error updating profile: ", error);
      alert("Failed to update profile.");
    }
  };

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
      <div className="max-w-md mx-auto flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Edit Profile</h1>
        </div>

        <div>
          {loading ? (
            <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
          ) : user ? (
            <div className="space-y-5 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-5 shadow-xl">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Username</label>
                <input
                  type="text"
                  value={username}
                  disabled
                  className="block w-full px-4 py-3 bg-[var(--color-overlay)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text-secondary)] outline-none text-sm cursor-not-allowed"
                />
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 px-1">Username can be changed in Settings</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full px-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm"
                  placeholder="Your name (optional)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="block w-full px-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="block w-full px-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
                >
                  <option value="" className="bg-[var(--color-bg)]">Select</option>
                  <option value="Male" className="bg-[var(--color-bg)]">Male</option>
                  <option value="Female" className="bg-[var(--color-bg)]">Female</option>
                  <option value="Other" className="bg-[var(--color-bg)]">Other</option>
                  <option value="Prefer not to say" className="bg-[var(--color-bg)]">Prefer not to say</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSave}
                  className="w-full bg-[#1e75ff] hover:bg-blue-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all text-sm shadow-md shadow-blue-500/20"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl text-[var(--color-text-secondary)]">Please log in to edit your profile.</div>
          )}
        </div>
      </div>
    </div>
  );
};
