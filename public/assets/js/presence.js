import { auth, db, onAuthStateChanged, collection, onSnapshot, doc, setDoc, serverTimestamp } from './firebase.js';

const onlineEl = document.getElementById('presenceOnline');
const idleEl = document.getElementById('presenceIdle');
const totalEl = document.getElementById('presenceTotal');
const list = document.getElementById('presenceList');

let heartbeat = null;
let unsub = null;

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function now() {
  return Date.now();
}

function stateFrom(lastSeen) {
  const diff = now() - Number(lastSeen || 0);

  if (diff <= 120000) return 'online';
  if (diff <= 900000) return 'idle';
  return 'offline';
}

function render(users) {
  const online = users.filter((u) => stateFrom(u.lastSeenMs) === 'online').length;
  const idle = users.filter((u) => stateFrom(u.lastSeenMs) === 'idle').length;

  onlineEl.textContent = String(online);
  idleEl.textContent = String(idle);
  totalEl.textContent = String(users.length);

  if (!users.length) {
    list.innerHTML = '<div class="item muted">No workforce activity detected.</div>';
    return;
  }

  list.innerHTML = users.map((user) => {
    const state = stateFrom(user.lastSeenMs);

    return '<article class="item"><h3>' + clean(user.displayName || user.fullName || 'Staff Member') + '</h3><p class="muted">' + clean(user.role || 'staff') + '</p><div class="row"><span class="pill ' + state + '">' + state + '</span></div></article>';
  }).join('');
}

async function heartbeatWrite(user) {
  await setDoc(doc(db, 'presence', user.uid), {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    role: user.role || 'staff',
    lastSeenMs: Date.now(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function startPresence(user) {
  if (heartbeat) clearInterval(heartbeat);
  if (unsub) unsub();

  heartbeatWrite(user);

  heartbeat = setInterval(() => {
    heartbeatWrite(user);
  }, 60000);

  unsub = onSnapshot(collection(db, 'presence'), (snap) => {
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render(rows);
  }, (error) => {
    console.error(error);
    list.innerHTML = '<div class="item muted">Presence system failed to load.</div>';
  });
}

function init() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    startPresence(user);
  });
}

window.addEventListener('beforeunload', () => {
  if (heartbeat) clearInterval(heartbeat);
  if (unsub) unsub();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
