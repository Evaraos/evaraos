import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db, COMPANY_ID, OWNER_EMAIL } from "./firebase.js";

export async function signup(name, email, password, role) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  const normalizedEmail = email.toLowerCase();
  const finalRole = normalizedEmail === OWNER_EMAIL ? "super_admin" : role;
  const approvalStatus =
    normalizedEmail === OWNER_EMAIL || role === "customer" ? "approved" : "pending";

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    role: finalRole,
    approvalStatus,
    status: "active",
    companyId: COMPANY_ID,
    createdAt: serverTimestamp(),
    lastLogin: null
  });

  return cred;
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function getCurrentUserDoc(user) {
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  return { uid: user.uid, ...snap.data() };
}

export function listenAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    const current = await getCurrentUserDoc(user);
    if (!current) {
      callback(null);
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        lastLogin: serverTimestamp()
      });
    } catch (e) {
      console.warn(e);
    }

    callback(current);
  });
}