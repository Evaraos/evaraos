import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getMultiFactorResolver
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

const firebaseConfig = {
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.firebasestorage.app",
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================
   SESSION + USER HELPERS
========================= */
const USER_ROLE_KEY = "evaraos_user_role";
const USER_PROFILE_KEY = "evaraos_user_profile";

async function setAuthPersistence(rememberDevice = true) {
  const mode = rememberDevice ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, mode);
}

function normalizeRole(rawRole = "") {
  const value = String(rawRole || "").trim().toLowerCase();

  if (["owner", "founder", "executive"].includes(value)) return "owner";
  if (["admin", "administrator"].includes(value)) return "admin";
  if (["manager", "management", "ops"].includes(value)) return "manager";
  if (["sales", "salesrep", "sales_rep", "rep"].includes(value)) return "sales";
  if (["technician", "tech"].includes(value)) return "technician";
  if (["customer", "client"].includes(value)) return "customer";

  return "owner";
}

function inferRoleFromEmail(email = "") {
  const value = String(email || "").toLowerCase();

  if (value.includes("admin")) return "admin";
  if (value.includes("manager")) return "manager";
  if (value.includes("sales")) return "sales";
  if (value.includes("tech")) return "technician";
  if (value.includes("customer") || value.includes("client")) return "customer";

  return "owner";
}

function saveUserRole(role) {
  try {
    localStorage.setItem(USER_ROLE_KEY, normalizeRole(role));
  } catch (error) {
    console.warn("Could not save role:", error);
  }
}

function getSavedUserRole() {
  try {
    return normalizeRole(localStorage.getItem(USER_ROLE_KEY) || "owner");
  } catch (error) {
    console.warn("Could not read saved role:", error);
    return "owner";
  }
}

function clearSavedUserRole() {
  try {
    localStorage.removeItem(USER_ROLE_KEY);
  } catch (error) {
    console.warn("Could not clear saved role:", error);
  }
}

function saveUserProfile(profile = {}) {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Could not save user profile:", error);
  }
}

function getSavedUserProfile() {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not parse saved profile:", error);
    return null;
  }
}

function clearSavedUserProfile() {
  try {
    localStorage.removeItem(USER_PROFILE_KEY);
  } catch (error) {
    console.warn("Could not clear saved profile:", error);
  }
}

function getUserDisplayName(user) {
  if (!user) return "Owner Account";
  return user.displayName || user.email || "Owner Account";
}

function getUserInitial(user) {
  const source = getUserDisplayName(user);
  return source.trim().charAt(0).toUpperCase() || "U";
}

function buildSessionProfile(user, explicitRole = "") {
  if (!user) return null;

  const role = normalizeRole(explicitRole || getSavedUserRole() || inferRoleFromEmail(user.email || ""));

  return {
    uid: user.uid,
    email: user.email || "",
    displayName: getUserDisplayName(user),
    initial: getUserInitial(user),
    role
  };
}

function syncUserSession(user, explicitRole = "") {
  if (!user) {
    clearSavedUserRole();
    clearSavedUserProfile();
    return null;
  }

  const profile = buildSessionProfile(user, explicitRole);
  saveUserRole(profile.role);
  saveUserProfile(profile);
  return profile;
}

function applyUserToUi(profile = null) {
  const safeProfile = profile || getSavedUserProfile();
  if (!safeProfile) return;

  const avatar = document.getElementById("dashboardAvatar");
  const avatarLarge = document.getElementById("dashboardAvatarLarge");
  const profileName = document.getElementById("dashboardProfileName");
  const profileRole = document.getElementById("dashboardProfileRole");
  const brandSubline = document.getElementById("dashboardBrandSubline");
  const overviewTitle = document.getElementById("dashboardOverviewTitle");

  const roleMap = {
    owner: {
      heading: "Executive Overview",
      subline: "Executive Control Center",
      profile: "Executive Access"
    },
    admin: {
      heading: "Admin Overview",
      subline: "Administrative Control Center",
      profile: "Admin Access"
    },
    manager: {
      heading: "Management Overview",
      subline: "Management Control Center",
      profile: "Manager Access"
    },
    sales: {
      heading: "Sales Overview",
      subline: "Sales Control Center",
      profile: "Sales Access"
    },
    technician: {
      heading: "Technician Overview",
      subline: "Technician Control Center",
      profile: "Technician Access"
    },
    customer: {
      heading: "Customer Overview",
      subline: "Customer Control Center",
      profile: "Customer Access"
    }
  };

  const roleUi = roleMap[safeProfile.role] || roleMap.owner;

  if (avatar) avatar.textContent = safeProfile.initial;
  if (avatarLarge) avatarLarge.textContent = safeProfile.initial;
  if (profileName) profileName.textContent = safeProfile.displayName;
  if (profileRole) profileRole.textContent = roleUi.profile;
  if (brandSubline) brandSubline.textContent = roleUi.subline;
  if (overviewTitle) overviewTitle.textContent = roleUi.heading;
}

async function logoutAndRedirect(path = "/evaraos/login.html") {
  clearSavedUserRole();
  clearSavedUserProfile();
  await signOut(auth);
  window.location.href = path;
}

function wireLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn || logoutBtn.dataset.bound === "true") return;

  logoutBtn.dataset.bound = "true";
  logoutBtn.addEventListener("click", async () => {
    try {
      await logoutAndRedirect("/evaraos/login.html");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
}

function protectRoute({
  requireAuth = false,
  redirectAuthedTo = "/evaraos/dashboard.html",
  redirectGuestTo = "/evaraos/login.html"
} = {}) {
  onAuthStateChanged(auth, (user) => {
    if (requireAuth && !user) {
      window.location.href = redirectGuestTo;
      return;
    }

    if (!requireAuth && user) {
      syncUserSession(user);
      window.location.href = redirectAuthedTo;
      return;
    }

    if (user) {
      const profile = syncUserSession(user);
      applyUserToUi(profile);
      wireLogoutButton();
    }
  });
}

export {
  app,
  auth,
  db,

  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,

  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getMultiFactorResolver,

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
  serverTimestamp,

  setAuthPersistence,
  normalizeRole,
  inferRoleFromEmail,
  saveUserRole,
  getSavedUserRole,
  clearSavedUserRole,
  saveUserProfile,
  getSavedUserProfile,
  clearSavedUserProfile,
  getUserDisplayName,
  getUserInitial,
  buildSessionProfile,
  syncUserSession,
  applyUserToUi,
  logoutAndRedirect,
  wireLogoutButton,
  protectRoute
};