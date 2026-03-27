import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db, OWNER_EMAIL, DEFAULT_COMPANY_ID } from "./firebase.js";
import { getRoleDefaults } from "./roles.js";

export async function usernameExists(username, excludeUserId = "") {
  const clean = (username || "").trim().toLowerCase();
  if (!clean) return false;

  const q = query(collection(db, "users"), where("username", "==", clean));
  const snap = await getDocs(q);

  return snap.docs.some((d) => d.id !== excludeUserId);
}

async function resolveEmailFromIdentifier(identifier) {
  const raw = (identifier || "").trim().toLowerCase();
  if (!raw) throw new Error("Enter your username or email.");

  if (raw.includes("@")) return raw;

  const q = query(collection(db, "users"), where("username", "==", raw));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("Username not found.");
  }

  const userDoc = snap.docs[0].data();
  if (!userDoc.email) {
    throw new Error("No email found for that username.");
  }

  return userDoc.email;
}

export async function signup(name, username, email, password, role) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase();

  if (await usernameExists(cleanUsername)) {
    throw new Error("That username is already taken.");
  }

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const isOwner = cleanEmail === OWNER_EMAIL;
  const defaults = getRoleDefaults(role, isOwner);

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    username: cleanUsername,
    email: cleanEmail,
    role: defaults.role,
    approvalStatus: defaults.approvalStatus,
    status: "active",
    companyId: DEFAULT_COMPANY_ID,
    companyAccessLevel: defaults.companyAccessLevel,
    photoUrl: "",
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    reportsTo: cred.user.uid,
    organizationLevel: defaults.organizationLevel,
    permissions: defaults.permissions,
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    preferredContactMethod: "",
    emergencyContactName: "",
    emergencyContactPhone: ""
  });

  return cred;
}

export async function login(identifier, password) {
  const email = await resolveEmailFromIdentifier(identifier);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email.trim().toLowerCase());
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