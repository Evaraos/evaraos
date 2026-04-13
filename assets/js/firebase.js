// assets/js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6Qpf8ROyqup4",
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

/* RE-EXPORT AUTH HELPERS USED IN THE REPO */
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
};

const STORAGE_KEYS = {
  role: "evaraos-role",
  user: "evaraos-user"
};

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export async function setAuthPersistence(rememberDevice = true) {
  const persistence = rememberDevice ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
}

export function saveUserRole(role = "customer") {
  try {
    localStorage.setItem(STORAGE_KEYS.role, String(role || "customer"));
  } catch {
    // ignore storage errors
  }
}

export function getSavedUserRole() {
  try {
    return localStorage.getItem(STORAGE_KEYS.role) || "customer";
  } catch {
    return "customer";
  }
}

export function clearSavedUserRole() {
  try {
    localStorage.removeItem(STORAGE_KEYS.role);
  } catch {
    // ignore
  }
}

export function saveUserProfile(profile = {}) {
  try {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export function getSavedUserProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedUserProfile() {
  try {
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch {
    // ignore
  }
}

export function roleLabelFromRole(role = "") {
  const value = String(role || "").trim().toLowerCase();

  if (value === "owner") return "Executive Access";
  if (value === "admin") return "Admin Access";
  if (value === "manager") return "Manager Access";
  if (value === "sales") return "Sales Access";
  if (value === "technician") return "Technician Access";
  if (value === "customer") return "Customer Access";

  return "Customer Access";
}

export function applyUserToUi(userData = {}) {
  const displayName = userData.displayName || userData.fullName || userData.email || "User";
  const email = userData.email || "";
  const role = userData.role || "customer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const roleText = roleLabelFromRole(role);

  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = displayName;
  });

  document.querySelectorAll("[data-user-email]").forEach((el) => {
    el.textContent = email;
  });

  document.querySelectorAll("[data-user-avatar]").forEach((el) => {
    el.textContent = initial;
  });

  const dashboardAvatar = document.getElementById("dashboardAvatar");
  const dashboardAvatarLarge = document.getElementById("dashboardAvatarLarge");
  const dashboardProfileName = document.getElementById("dashboardProfileName");
  const dashboardProfileRole = document.getElementById("dashboardProfileRole");

  if (dashboardAvatar) dashboardAvatar.textContent = initial;
  if (dashboardAvatarLarge) dashboardAvatarLarge.textContent = initial;
  if (dashboardProfileName) dashboardProfileName.textContent = displayName;
  if (dashboardProfileRole) dashboardProfileRole.textContent = roleText;
}

export function syncUserSession(user, role = "customer") {
  if (!user) return;

  const profile = {
    uid: user.uid || "",
    email: user.email || "",
    displayName: user.displayName || "",
    role: role || "customer"
  };

  saveUserRole(profile.role);
  saveUserProfile(profile);
  applyUserToUi(profile);
}

export function clearUserSession() {
  clearSavedUserRole();
  clearSavedUserProfile();
}

export async function logoutAndRedirect(path = "/evaraos/login.html") {
  await signOut(auth);
  clearUserSession();
  window.location.href = path;
}

export async function logout() {
  await logoutAndRedirect("/evaraos/login.html");
}

export function protectRoute({
  requireAuth = true,
  redirectGuestTo = "/evaraos/login.html",
  redirectAuthedTo = "/evaraos/dashboard.html"
} = {}) {
  onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    const isAuthPage =
      path.endsWith("/login.html") ||
      path.endsWith("/signup.html") ||
      path.endsWith("/reset.html");

    if (user) {
      const savedProfile = getSavedUserProfile();
      if (savedProfile) {
        applyUserToUi(savedProfile);
      }

      if (!requireAuth && isAuthPage) {
        window.location.href = redirectAuthedTo;
      }
      return;
    }

    if (requireAuth) {
      window.location.href = redirectGuestTo;
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    clearUserSession();
    return;
  }

  currentUser = user;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          fullName: user.displayName || "",
          role: "customer"
        },
        { merge: true }
      );
    }

    const data = snap.exists() ? snap.data() || {} : {};
    const role = data.role || getSavedUserRole() || "customer";

    syncUserSession(user, role);

    applyUserToUi({
      displayName: data.displayName || data.fullName || user.displayName || user.email || "User",
      email: user.email || "",
      role
    });
  } catch (error) {
    console.error("Global auth sync failed:", error);
    syncUserSession(user, getSavedUserRole() || "customer");
  }
});