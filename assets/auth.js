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

export async function usernameExists(username) {
  const clean = (username || "").trim().toLowerCase();
  if (!clean) return false;

  const q = query(collection(db, "users"), where("username", "==", clean));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function signup(name, username, email, password, role) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase();

  if (await usernameExists(cleanUsername)) {
    throw new Error("That username is already taken.");
  }

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const isOwner = cleanEmail === OWNER_EMAIL;

  let organizationLevel = 4;
  let permissions = ["view_own_data"];
  let companyAccessLevel = "subsidiary";
  let approvalStatus = "pending";
  let finalRole = role;

  if (isOwner) {
    finalRole = "super_admin";
    approvalStatus = "approved";
    organizationLevel = 1;
    permissions = ["all"];
    companyAccessLevel = "parent";
  } else if (role === "customer") {
    approvalStatus = "approved";
    organizationLevel = 4;
    permissions = [
      "view_own_data",
      "edit_own_profile",
      "view_own_services",
      "request_service_changes"
    ];
  } else if (role === "admin") {
    approvalStatus = "pending";
    organizationLevel = 2;
    permissions = ["manage_company", "manage_staff", "view_reports", "manage_leads"];
  } else {
    approvalStatus = "pending";
    organizationLevel = 3;
    permissions = ["view_leads", "edit_leads", "update_jobs"];
  }

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    username: cleanUsername,
    email: cleanEmail,
    role: finalRole,
    approvalStatus,
    status: "active",
    companyId: DEFAULT_COMPANY_ID,
    companyAccessLevel,
    photoUrl: "",
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    reportsTo: cred.user.uid,
    organizationLevel,
    permissions,
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    preferredContactMethod: ""
  });

  return cred;
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
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