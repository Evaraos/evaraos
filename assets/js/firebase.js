import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ✅ YOUR REAL CONFIG (FIXED)
const firebaseConfig = {
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.firebasestorage.app", // ✅ correct (new Firebase format)
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export everything
export {
  app,
  auth,
  db,
  onAuthStateChanged,
  signOut,
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
};