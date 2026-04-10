// assets/js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.firebasestorage.app",
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f",
  measurementId: "G-296N94CKPR"
};

/* INIT */
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/* GLOBAL USER STATE */
let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

/* APPLY USER TO UI */
export function applyUserToUi(userData) {
  const nameEls = document.querySelectorAll("[data-user-name]");
  const emailEls = document.querySelectorAll("[data-user-email]");
  const avatarEls = document.querySelectorAll("[data-user-avatar]");

  nameEls.forEach(el => el.textContent = userData.displayName || "User");
  emailEls.forEach(el => el.textContent = userData.email || "");

  avatarEls.forEach(el => {
    const letter = (userData.displayName || "U").charAt(0).toUpperCase();
    el.textContent = letter;
  });
}

/* AUTH LISTENER GLOBAL */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    return;
  }

  currentUser = user;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      role: "owner"
    });
  }

  const data = snap.exists() ? snap.data() : {};

  applyUserToUi({
    displayName: data.displayName || user.displayName,
    email: user.email,
    role: data.role || "owner"
  });
});

/* LOGOUT */
export async function logout() {
  await signOut(auth);
  window.location.href = "/evaraos/login.html";
}