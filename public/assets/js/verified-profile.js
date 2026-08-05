import {
  db,
  doc,
  getDoc,
  saveUserRole,
  saveUserProfile,
  clearSavedUserRole,
  clearSavedUserProfile,
  applyUserToUi
} from './firebase.js';

function clean(value = '') {
  return String(value || '').trim();
}

export async function readVerifiedUserProfile(user) {
  if (!user?.uid) return null;

  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() || {};
  const profile = {
    uid: user.uid,
    id: user.uid,
    email: clean(user.email || data.email),
    displayName: clean(data.displayName || data.fullName || data.name || user.displayName || user.email || 'User'),
    fullName: clean(data.fullName || data.displayName || data.name || user.displayName),
    name: clean(data.name || data.fullName || data.displayName || user.displayName),
    username: clean(data.username),
    role: clean(data.role),
    companyId: clean(data.companyId),
    companyName: clean(data.companyName),
    status: clean(data.status),
    approvalStatus: clean(data.approvalStatus),
    verified: true
  };

  if (profile.role) saveUserRole(profile.role);
  else clearSavedUserRole();
  saveUserProfile(profile);
  applyUserToUi(profile);

  return Object.freeze(profile);
}

export function clearVerifiedProfileCache() {
  clearSavedUserRole();
  clearSavedUserProfile();
}
