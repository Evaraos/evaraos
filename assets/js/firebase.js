import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/*
  Replace these placeholder values with your real Firebase web app config.
  Use the exact values from Firebase Console > Project settings > Your apps > Web app.
*/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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