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

/* =========================================
   GLOBAL LOADER
   ========================================= */

const GLOBAL_LOADER_ID = "evaraGlobalLoader";

function ensureGlobalLoader() {
  let loader = document.getElementById(GLOBAL_LOADER_ID);
  if (loader) return loader;

  if (!document.body) return null;

  loader = document.createElement("div");
  loader.id = GLOBAL_LOADER_ID;
  loader.className = "evara-global-loader";
  loader.setAttribute("aria-hidden", "true");

  loader.innerHTML = `
    <div class="evara-loader-backdrop"></div>
    <div class="evara-loader-box glass-card">
      <div class="evara-loader-mark">
        <span class="evara-loader-ring"></span>
        <span class="evara-loader-ring2"></span>
        <span class="evara-loader-ring3"></span>

        <div class="evara-loader-logo-wrap">
          <img
            src="/evaraos/assets/img/evaraos_logo.png"
            alt="Evaraos"
            class="evara-loader-logo"
            onerror="this.onerror=null;this.src='/evaraos/assets/logo.png';"
          />
        </div>
      </div>

      <div class="evara-loader-copy">
        <p class="evara-loader-title" id="evaraLoaderTitle">Loading Evaraos</p>
        <p class="evara-loader-subtitle" id="evaraLoaderSubtitle">Preparing your workspace and syncing your secure session.</p>
      </div>

      <div class="evara-loader-dots" aria-hidden="true">
        <span class="evara-loader-dot"></span>
        <span class="evara-loader-dot"></span>
        <span class="evara-loader-dot"></span>
      </div>
    </div>
  `;

  document.body.appendChild(loader);
  return loader;
}

export function showGlobalLoader({
  title = "Loading Evaraos",
  subtitle = "Preparing your workspace and syncing your secure session."
} = {}) {
  const loader = ensureGlobalLoader();
  if (!loader) return;

  const titleEl = loader.querySelector("#evaraLoaderTitle");
  const subtitleEl = loader.querySelector("#evaraLoaderSubtitle");

  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  loader.classList.add("active");
  loader.setAttribute("aria-hidden", "false");
  document.body?.classList.add("app-loading");
}

export function hideGlobalLoader() {
  const loader = document.getElementById(GLOBAL_LOADER_ID);
  if (loader) {
    loader.classList.remove("active");
    loader.setAttribute("aria-hidden", "true");
  }
  document.body?.classList.remove("app-loading");
}

/* =========================================
   CURRENT USER
   ========================================= */

export function getCurrentUser() {
  return currentUser;
}

/* =========================================
   AUTH PERSISTENCE
   ========================================= */

export async function setAuthPersistence(rememberDevice = true) {
  const persistence = rememberDevice ? browserLocalPersistence : browserSessionPersistence;
  useSessionStorageForProfile = !rememberDevice;
  await setPersistence(auth, persistence);
}

/* =========================================
   STORAGE HELPERS
   ========================================= */

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

/* =========================================
   USER UI HELPERS
   ========================================= */

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

export function syncUserSession(user, role = "customer", extras = {}) {
  if (!user) return;

  const profile = {
    uid: user.uid || "",
    email: user.email || "",
    displayName: extras.displayName || user.displayName || "",
    fullName: extras.fullName || extras.displayName || user.displayName || "",
    username: extras.username || "",
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

/* =========================================
   LOGOUT
   ========================================= */

export async function logoutAndRedirect(path = "/evaraos/login.html") {
  showGlobalLoader({
    title: "Signing out",
    subtitle: "Clearing your secure session and returning to login."
  });

  await signOut(auth);
  clearUserSession();

  try {
    sessionStorage.clear();
  } catch {}

  try {
    localStorage.removeItem("evaraos-last-private-page");
  } catch {}

  window.location.replace(path);
}

export async function logout() {
  await logoutAndRedirect("/evaraos/login.html");
}

/* =========================================
   ROUTE LOADING STATE
   ========================================= */

export function markProtectedPagePending(message = "Checking your secure session") {
  document.documentElement.classList.add("auth-pending");
  document.body?.classList.add("auth-pending");

  showGlobalLoader({
    title: "Loading Evaraos",
    subtitle: message
  });
}

export function resolveProtectedPage() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending");
  hideGlobalLoader();
}

/* =========================================
   ROUTE PROTECTION
   ========================================= */

export function protectRoute({
  requireAuth = true,
  redirectGuestTo = "/evaraos/login.html",
  redirectAuthedTo = "/evaraos/dashboard.html"
} = {}) {
  markProtectedPagePending(
    requireAuth
      ? "Verifying your access and restoring your workspace."
      : "Checking your current sign-in state."
  );

  const path = window.location.pathname;
  const isAuthPage =
    path.endsWith("/login.html") ||
    path.endsWith("/signup.html") ||
    path.endsWith("/reset.html");

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;

      const savedProfile = getSavedUserProfile();
      if (savedProfile) {
        applyUserToUi(savedProfile);
      }

      if (!requireAuth && isAuthPage) {
        showGlobalLoader({
          title: "Redirecting",
          subtitle: "You are already signed in. Opening your dashboard."
        });
        window.location.replace(redirectAuthedTo);
        return;
      }

      resolveProtectedPage();
      return;
    }

    currentUser = null;
    clearUserSession();

    if (requireAuth) {
      showGlobalLoader({
        title: "Redirecting to login",
        subtitle: "This protected page requires an active secure session."
      });
      window.location.replace(redirectGuestTo);
      return;
    }

    resolveProtectedPage();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      const activeUser = auth.currentUser;

      if (requireAuth && !activeUser) {
        showGlobalLoader({
          title: "Restoring session",
          subtitle: "No active session was found. Redirecting to login."
        });
        window.location.replace(redirectGuestTo);
        return;
      }

      if (!requireAuth && activeUser && isAuthPage) {
        showGlobalLoader({
          title: "Restoring session",
          subtitle: "You are already signed in. Redirecting now."
        });
        window.location.replace(redirectAuthedTo);
        return;
      }

      resolveProtectedPage();
    }
  });
}

/* =========================================
   USER THEME PREFERENCES
   ========================================= */

export async function saveUserThemePreferences(themePreferences = {}) {
  const user = auth.currentUser;
  if (!user?.uid) return false;

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        themePreferences: themePreferences || {},
        themePreferencesUpdatedAt: new Date().toISOString()
      },
      { merge: true }
    );
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
    const data = snap.data() || {};
    return data.themePreferences || null;
  } catch (error) {
    console.error("Failed to load theme preferences:", error);
    return null;
  }
}

/* =========================================
   GLOBAL AUTH SYNC
   ========================================= */

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
          username: "",
          usernameLower: "",
          role: "customer",
          themePreferences: null
        },
        { merge: true }
      );
    }

    const freshSnap = await getDoc(userRef);
    const data = freshSnap.exists() ? freshSnap.data() || {} : {};
    const role = data.role || getSavedUserRole() || "customer";

    syncUserSession(user, role, {
      displayName: data.displayName || data.fullName || user.displayName || user.email || "User",
      fullName: data.fullName || data.displayName || user.displayName || "",
      username: data.username || ""
    });

    applyUserToUi({
      displayName: data.displayName || data.fullName || user.displayName || user.email || "User",
      fullName: data.fullName || data.displayName || user.displayName || "",
      username: data.username || "",
      email: user.email || "",
      role
    });
  } catch (error) {
    console.error("Global auth sync failed:", error);
    syncUserSession(user, getSavedUserRole() || "customer", {
      displayName: user.displayName || user.email || "User",
      fullName: user.displayName || "",
      username: ""
    });
  }
});