import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  getSavedUserProfile
} from './firebase.js';

let presenceTimer = null;
let unsubscribePresence = null;

function normalizeStatus(value = '') {
  const status = String(value || '').trim().toLowerCase();

  if (['available', 'active', 'online'].includes(status)) return 'available';
  if (['busy', 'working', 'on_job'].includes(status)) return 'busy';
  if (['break', 'paused'].includes(status)) return 'break';
  if (['offline', 'away'].includes(status)) return 'offline';

  return 'available';
}

function buildPresencePayload(user, overrides = {}) {
  const profile = getSavedUserProfile() || {};
  const uid = user?.uid || profile.uid || '';

  return {
    uid,
    displayName: overrides.displayName || profile.displayName || profile.fullName || profile.name || user?.displayName || user?.email || 'Team Member',
    email: overrides.email || user?.email || profile.email || '',
    role: overrides.role || profile.role || 'staff',
    companyId: overrides.companyId || profile.companyId || '',
    companyName: overrides.companyName || profile.companyName || '',
    territoryId: overrides.territoryId || profile.territoryId || '',
    regionId: overrides.regionId || profile.regionId || '',
    status: normalizeStatus(overrides.status || 'available'),
    presenceMode: 'heartbeat',
    lastSeenMs: Date.now(),
    updatedAt: serverTimestamp()
  };
}

export async function updateMyPresence(overrides = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to update presence.');

  const payload = buildPresencePayload(user, overrides);
  await setDoc(doc(db, 'workforce_presence', payload.uid), payload, { merge: true });
  return payload;
}

export function startPresenceHeartbeat(options = {}) {
  stopPresenceHeartbeat();

  const intervalMs = Number(options.intervalMs || 60000);
  const status = normalizeStatus(options.status || 'available');

  updateMyPresence({ status }).catch((error) => console.warn('Presence update failed:', error));

  presenceTimer = window.setInterval(() => {
    updateMyPresence({ status }).catch((error) => console.warn('Presence heartbeat failed:', error));
  }, intervalMs);

  return stopPresenceHeartbeat;
}

export function stopPresenceHeartbeat() {
  if (presenceTimer) window.clearInterval(presenceTimer);
  presenceTimer = null;
}

export async function markMyPresenceOffline() {
  try {
    await updateMyPresence({ status: 'offline' });
  } catch (error) {
    console.warn('Offline presence update failed:', error);
  }
}

export function subscribeWorkforcePresence(callback, options = {}) {
  if (typeof callback !== 'function') throw new Error('subscribeWorkforcePresence requires a callback.');

  if (unsubscribePresence) unsubscribePresence();

  const onError = typeof options.onError === 'function'
    ? options.onError
    : (error) => console.error('Presence subscription failed:', error);

  unsubscribePresence = onSnapshot(collection(db, 'workforce_presence'), (snap) => {
    const rows = snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
    callback(rows);
  }, onError);

  return unsubscribeWorkforcePresence;
}

export function unsubscribeWorkforcePresence() {
  if (unsubscribePresence) unsubscribePresence();
  unsubscribePresence = null;
}

function bindAuthPresence() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopPresenceHeartbeat();
      unsubscribeWorkforcePresence();
    }
  });
}

bindAuthPresence();
window.EvaraPageLifecycle?.registerCleanup?.(() => {
  markMyPresenceOffline();
  stopPresenceHeartbeat();
  unsubscribeWorkforcePresence();
});
window.addEventListener('pagehide', () => {
  markMyPresenceOffline();
  stopPresenceHeartbeat();
  unsubscribeWorkforcePresence();
});

window.EvaraWorkforcePresence = {
  updateMyPresence,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
  markMyPresenceOffline,
  subscribeWorkforcePresence,
  unsubscribeWorkforcePresence
};
