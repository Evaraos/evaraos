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
let useSessionStorageForProfile = false;
let globalAuthSyncStarted = false;

function dispatchSessionReady(detail = {}) {
  window.dispatchEvent(new CustomEvent("evara:session-ready", { detail }));
}

function navigateWithLoader(path, options = {}, replace = false) {
  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => {
    replace ? window.location.replace(path) : window.location.assign(path);
  });
}

export function showGlobalLoader() {
  document.body?.classList.add("app-loading");
  document.body?.classList.remove("app-ready");
}

export function hideGlobalLoader() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending", "app-loading");
  document.body?.classList.add("app-ready");

  if (window.EvaraLoader?.markAppReady) {
    window.EvaraLoader.markAppReady();
  }

  dispatchSessionReady({ at: Date.now() });
}

export function getCurrentUser() {
  return currentUser;
}

export async function setAuthPersistence(rememberDevice = true) {
  const persistence = rememberDevice ? browserLocalPersistence : browserSessionPersistence;
  useSessionStorageForProfile = !rememberDevice;
  await setPersistence(auth, persistence);
}

function writeStorage(key, value) {
  try {
    if (useSessionStorageForProfile) {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    }
  } catch {}
}

function readStorage(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {}
}

export function saveUserRole(role = "customer") {
  writeStorage(STORAGE_KEYS.role, String(role || "customer"));
}

export function getSavedUserRole() {
  return readStorage(STORAGE_KEYS.role) || "customer";
}

export function clearSavedUserRole() {
  removeStorage(STORAGE_KEYS.role);
}

export function saveUserProfile(profile = {}) {
  writeStorage(STORAGE_KEYS.user, JSON.stringify(profile));
}

export function getSavedUserProfile() {
  try {
    const raw = readStorage(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedUserProfile() {
  removeStorage(STORAGE_KEYS.user);
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
  const displayName = userData.displayName || userData.fullName || userData.username || userData.email || "User";
  const email = userData.email || "";
  const role = userData.role || "customer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const roleText = roleLabelFromRole(role);

  document.querySelectorAll("[data-user-name]").forEach((el) => { el.textContent = displayName; });
  document.querySelectorAll("[data-user-email]").forEach((el) => { el.textContent = email; });
  document.querySelectorAll("[data-user-avatar]").forEach((el) => { el.textContent = initial; });

  const dashboardAvatar = document.getElementById("dashboardAvatar");
  const dashboardAvatarLarge = document.getElementById("dashboardAvatarLarge");
  const dashboardProfileName = document.getElementById("dashboardProfileName");
  const dashboardProfileRole = document.getElementById("dashboardProfileRole");

  if (dashboardAvatar) dashboardAvatar.textContent = initial;
  if (dashboardAvatarLarge) dashboardAvatarLarge.textContent = initial;
  if (dashboardProfileName) dashboardProfileName.textContent = displayName;
  if (dashboardProfileRole) dashboardProfileRole.textContent = roleText;
}

export function syncUserSession(user, role = "customer", extras = {}) {
  if (!user) return;

  const profile = {
    uid: user.uid || "",
    email: user.email || "",
    displayName: extras.displayName || user.displayName || user.email || "",
    fullName: extras.fullName || extras.displayName || user.displayName || "",
    username: extras.username || "",
    role: role || "customer"
  };

  saveUserRole(profile.role);
  saveUserProfile(profile);
  applyUserToUi(profile);
  dispatchSessionReady({ authenticated: true, role: profile.role });
}

export function clearUserSession() {
  clearSavedUserRole();
  clearSavedUserProfile();
}

export async function logoutAndRedirect(path = "/evaraos/login.html") {
  showGlobalLoader();

  await signOut(auth);
  clearUserSession();

  try { sessionStorage.clear(); } catch {}
  try { localStorage.removeItem("evaraos-last-private-page"); } catch {}

  navigateWithLoader(path, {
    title: "Signed out",
    subtitle: "Returning to login."
  }, true);
}

export async function logout() {
  await logoutAndRedirect("/evaraos/login.html");
}

export function markProtectedPagePending() {
  document.documentElement.classList.add("auth-pending");
  document.body?.classList.add("auth-pending");
}

export function resolveProtectedPage() {
  hideGlobalLoader();
}

let protectRouteActivePromise = null;
let protectRouteUnsubscribe = null;

export function protectRoute({
  requireAuth = true,
  redirectGuestTo = "/evaraos/login.html",
  redirectAuthedTo = "/evaraos/dashboard.html"
} = {}) {
  if (protectRouteActivePromise) return protectRouteActivePromise;

  markProtectedPagePending();

  const path = window.location.pathname;
  const isAuthPage =
    path.endsWith("/login.html") ||
    path.endsWith("/signup.html") ||
    path.endsWith("/reset.html");

  const savedProfile = getSavedUserProfile();

  if (requireAuth && savedProfile?.uid) {
    applyUserToUi(savedProfile);
    resolveProtectedPage();

    protectRouteActivePromise = Promise.resolve(true);
    setTimeout(() => {
      protectRouteActivePromise = null;
    }, 0);

    return protectRouteActivePromise;
  }

  protectRouteActivePromise = new Promise((resolve) => {
    if (protectRouteUnsubscribe) {
      protectRouteUnsubscribe();
      protectRouteUnsubscribe = null;
    }

    protectRouteUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (protectRouteUnsubscribe) {
        protectRouteUnsubscribe();
        protectRouteUnsubscribe = null;
      }

      if (user) {
        currentUser = user;

        if (!requireAuth && isAuthPage) {
          navigateWithLoader(redirectAuthedTo, {
            title: "Opening dashboard",
            subtitle: "Your session is active."
          }, true);
          resolve(true);
          protectRouteActivePromise = null;
          return;
        }

        syncUserSession(user, getSavedUserRole() || "customer", {
          displayName: user.displayName || user.email || "User"
        });

        resolveProtectedPage();
        resolve(true);
        protectRouteActivePromise = null;
        return;
      }

      currentUser = null;

      if (requireAuth) {
        clearUserSession();
        navigateWithLoader(redirectGuestTo, {
          title: "Returning to login",
          subtitle: "Please sign in to continue."
        }, true);
        resolve(false);
        protectRouteActivePromise = null;
        return;
      }

      resolveProtectedPage();
      resolve(true);
      protectRouteActivePromise = null;
    });
  });

  return protectRouteActivePromise;
}

export async function saveUserThemePreferences(themePreferences = {}) {
  const user = auth.currentUser;
  if (!user?.uid) return false;

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      themePreferences: themePreferences || {},
      themePreferencesUpdatedAt: new Date().toISOString()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("Failed to save theme preferences:", error);
    return false;
  }
}

export async function getUserThemePreferences() {
  const user = auth.currentUser;
  if (!user?.uid) return null;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return snap.data()?.themePreferences || null;
  } catch (error) {
    console.error("Failed to load theme preferences:", error);
    return null;
  }
}

function startGlobalAuthSync() {
  if (globalAuthSyncStarted) return;
  globalAuthSyncStarted = true;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUser = null;
      return;
    }

    currentUser = user;

    const savedProfile = getSavedUserProfile();
    if (savedProfile?.uid) {
      applyUserToUi(savedProfile);
    } else {
      syncUserSession(user, getSavedUserRole() || "customer", {
        displayName: user.displayName || user.email || "User"
      });
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          fullName: user.displayName || "",
          username: "",
          usernameLower: "",
          role: getSavedUserRole() || "customer",
          themePreferences: null
        }, { merge: true });
      }

      const freshSnap = await getDoc(userRef);
      const data = freshSnap.exists() ? freshSnap.data() || {} : {};
      const role = data.role || getSavedUserRole() || "customer";

      syncUserSession(user, role, {
        displayName: data.displayName || data.fullName || user.displayName || user.email || "User",
        fullName: data.fullName || data.displayName || user.displayName || "",
        username: data.username || ""
      });
    } catch (error) {
      console.warn("Background auth sync delayed:", error);
    }
  });
}

startGlobalAuthSync();