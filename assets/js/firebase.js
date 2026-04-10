// assets/js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* YOUR REAL CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.firebasestorage.app",
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f",
  measurementId: "G-296N94CKPR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/* passthrough exports so auth.js can stay clean */
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut
};

const STORAGE_KEYS = {
  role: "evaraos-role",
  user: "evaraos-user"
};

export async function setAuthPersistence(rememberDevice = true) {
  const persistence = rememberDevice ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
}

export function saveUserRole(role = "owner") {
  try {
    localStorage.setItem(STORAGE_KEYS.role, String(role || "owner"));
  } catch {
    // ignore storage issues
  }
}

export function getSavedUserRole() {
  try {
    return localStorage.getItem(STORAGE_KEYS.role) || "owner";
  } catch {
    return "owner";
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
    // ignore
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

export function syncUserSession(user, role = "owner") {
  if (!user) return;

  const profile = {
    uid: user.uid || "",
    email: user.email || "",
    displayName: user.displayName || "",
    role: role || "owner"
  };

  saveUserRole(profile.role);
  saveUserProfile(profile);
  applyUserToUi(profile);
}

export function clearUserSession() {
  clearSavedUserRole();
  clearSavedUserProfile();
}

export function roleLabelFromRole(role = "") {
  const value = String(role || "").trim().toLowerCase();

  if (value === "owner") return "Executive Access";
  if (value === "admin") return "Admin Access";
  if (value === "manager") return "Manager Access";
  if (value === "sales") return "Sales Access";
  if (value === "technician") return "Technician Access";
  if (value === "customer") return "Customer Access";

  return "Executive Access";
}

export function applyUserToUi(profile = null) {
  if (!profile) return;

  const displayName = profile.displayName || profile.email || "Owner Account";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const roleText = roleLabelFromRole(profile.role || "owner");

  const avatar = document.getElementById("dashboardAvatar");
  const avatarLarge = document.getElementById("dashboardAvatarLarge");
  const profileName = document.getElementById("dashboardProfileName");
  const profileRole = document.getElementById("dashboardProfileRole");

  if (avatar) avatar.textContent = initial;
  if (avatarLarge) avatarLarge.textContent = initial;
  if (profileName) profileName.textContent = displayName;
  if (profileRole) profileRole.textContent = roleText;
}

export async function logoutAndRedirect(path = "/evaraos/login.html") {
  await signOut(auth);
  clearUserSession();
  window.location.href = path;
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
      const saved = getSavedUserProfile();
      if (saved) applyUserToUi(saved);

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

/* passive sync so nav/profile UI stays updated */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    clearUserSession();
    return;
  }

  const savedRole = getSavedUserRole() || "owner";
  syncUserSession(user, savedRole);
});