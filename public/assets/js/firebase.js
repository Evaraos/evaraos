import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

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
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc as firebaseSetDoc,
  addDoc as firebaseAddDoc,
  updateDoc as firebaseUpdateDoc,
  deleteDoc as firebaseDeleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction
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
const appCheckSiteKey = "6LczbtQsAAAAAOHLSS25b38mXh1uTMAWvDjPIiOy";

export let appCheck = null;

try {
  const host = window.location.hostname;
  const isLocalDev = host === "localhost" || host === "127.0.0.1";
  const debugToken = isLocalDev ? window.localStorage.getItem("evaraos-app-check-debug-token") : "";

  if (debugToken) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
} catch (error) {
  console.warn("Evaraos App Check initialization skipped:", error);
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

const HISTORY_SKIP_COLLECTIONS = new Set(["audit_logs", "history_timeline", "operation_events"]);

export {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  getFunctions,
  httpsCallable,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction
};

const STORAGE_KEYS = {
  role: "evaraos-role",
  user: "evaraos-user"
};

let currentUser = null;
let useSessionStorageForProfile = false;
let globalAuthSyncStarted = false;

function dispatchSessionReady(detail = {}) {
  window.dispatchEvent(
    new CustomEvent("evara:session-ready", {
      detail: {
        at: Date.now(),
        ...detail
      }
    })
  );
}

function navigateWithLoader(path, options = {}, replace = false) {
  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => {
    if (replace) {
      window.location.replace(path);
    } else {
      window.location.assign(path);
    }
  });
}

function topCollection(path = "") {
  return String(path || "").split("/")[0] || "unknown";
}

function documentCollectionPath(docRef) {
  return docRef?.parent?.path || String(docRef?.path || "").split("/").slice(0, -1).join("/");
}

function shouldRecordHistory(path = "") {
  return !HISTORY_SKIP_COLLECTIONS.has(topCollection(path));
}

function safeHistoryValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  const type = typeof value;

  if (type === "string" || type === "number" || type === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value?.seconds && typeof value.seconds === "number") return value;
  if (Array.isArray(value)) return value.slice(0, 30).map(safeHistoryValue);

  if (type === "object") {
    const constructorName = value?.constructor?.name || "Object";
    if (constructorName !== "Object") return `[${constructorName}]`;

    const output = {};
    Object.entries(value).slice(0, 40).forEach(([key, child]) => {
      output[key] = safeHistoryValue(child);
    });
    return output;
  }

  return String(value);
}

function safeSnapshot(data = {}) {
  const output = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (["password", "token", "secret", "apiKey", "privateKey"].includes(String(key).toLowerCase())) return;
    output[key] = safeHistoryValue(value);
  });
  return output;
}

function targetNameFromData(data = {}, fallback = "") {
  return (
    data.displayName ||
    data.fullName ||
    data.name ||
    data.companyName ||
    data.brand ||
    data.title ||
    data.email ||
    fallback ||
    "Record"
  );
}

function actorSnapshot() {
  const profile = getSavedUserProfile() || {};
  const user = auth.currentUser || currentUser || {};

  return {
    uid: user.uid || profile.uid || profile.id || "",
    email: user.email || profile.email || "",
    name:
      profile.displayName ||
      profile.fullName ||
      profile.name ||
      profile.username ||
      user.displayName ||
      user.email ||
      "System",
    role: profile.role || getSavedUserRole() || "guest"
  };
}

async function recordFirestoreHistory({ action, collectionPath, documentPath, documentId, data = {}, extra = {} } = {}) {
  try {
    if (!collectionPath || !shouldRecordHistory(collectionPath)) return;

    const entityType = topCollection(collectionPath);
    const actor = actorSnapshot();
    const snapshot = safeSnapshot(data || {});
    const changedFields = Object.keys(data || {}).filter((field) => field !== "updatedAt" && field !== "createdAt");
    const targetName = targetNameFromData(snapshot, documentId);

    const timelinePayload = {
      action,
      eventType: action,
      entityType,
      collectionPath,
      documentPath: documentPath || "",
      documentId: documentId || "",
      targetId: documentId || "",
      targetName,
      targetDisplayName: targetName,
      targetCollection: entityType,
      companyId: snapshot.companyId || (entityType === "companies" ? documentId : ""),
      companyName: snapshot.companyName || snapshot.name || "",
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      actorRole: actor.role,
      changedFields,
      snapshot,
      notes: `${action} ${entityType} record`,
      createdAt: serverTimestamp(),
      ...extra
    };

    const auditPayload = {
      action,
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      actorRole: actor.role,
      targetUserId: entityType === "users" ? documentId || snapshot.uid || "" : "",
      targetUserName: entityType === "users" ? targetName : "",
      targetCompanyId: entityType === "companies" ? documentId || "" : snapshot.companyId || "",
      targetCompanyName: entityType === "companies" ? targetName : snapshot.companyName || "",
      targetCollection: entityType,
      targetDocumentId: documentId || "",
      changedFields,
      notes: `${action} ${entityType} record`,
      createdAt: serverTimestamp(),
      ...extra
    };

    await Promise.all([
      firebaseAddDoc(collection(db, "history_timeline"), timelinePayload),
      firebaseAddDoc(collection(db, "audit_logs"), auditPayload)
    ]);
  } catch (error) {
    console.warn("History timeline write skipped:", error);
  }
}

export async function addDoc(collectionRef, data) {
  const createdRef = await firebaseAddDoc(collectionRef, data);

  await recordFirestoreHistory({
    action: `${topCollection(collectionRef?.path)}_created`,
    collectionPath: collectionRef?.path || "",
    documentPath: createdRef?.path || "",
    documentId: createdRef?.id || "",
    data,
    extra: {
      operation: "create"
    }
  });

  return createdRef;
}

export async function setDoc(docRef, data, options) {
  if (options) await firebaseSetDoc(docRef, data, options);
  else await firebaseSetDoc(docRef, data);

  const collectionPath = documentCollectionPath(docRef);

  await recordFirestoreHistory({
    action: options?.merge ? `${topCollection(collectionPath)}_merged` : `${topCollection(collectionPath)}_set`,
    collectionPath,
    documentPath: docRef?.path || "",
    documentId: docRef?.id || "",
    data,
    extra: {
      operation: options?.merge ? "merge" : "set"
    }
  });
}

export async function updateDoc(docRef, data) {
  await firebaseUpdateDoc(docRef, data);

  const collectionPath = documentCollectionPath(docRef);

  await recordFirestoreHistory({
    action: `${topCollection(collectionPath)}_updated`,
    collectionPath,
    documentPath: docRef?.path || "",
    documentId: docRef?.id || "",
    data,
    extra: {
      operation: "update"
    }
  });
}

export async function deleteDoc(docRef) {
  const collectionPath = documentCollectionPath(docRef);
  const documentPath = docRef?.path || "";
  const documentId = docRef?.id || "";

  await firebaseDeleteDoc(docRef);

  await recordFirestoreHistory({
    action: `${topCollection(collectionPath)}_deleted`,
    collectionPath,
    documentPath,
    documentId,
    data: {
      id: documentId
    },
    extra: {
      operation: "delete"
    }
  });
}

export async function showGlobalLoader() {
  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad({
      title: "Loading Evaraos",
      subtitle: "Preparing your secure session."
    });
    return;
  }

  document.body?.classList.add("app-loading");
  document.body?.classList.remove("app-ready");
}

export function hideGlobalLoader() {
  document.documentElement.classList.remove("auth-pending", "boot-pending");
  document.body?.classList.remove("auth-pending", "app-loading");
  document.body?.classList.add("app-ready");

  if (window.EvaraLoader?.markAppReady) {
    window.EvaraLoader.markAppReady();
  }

  dispatchSessionReady();
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

export function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (value === "tech") return "technician";
  if (value === "sales_rep") return "sales";
  if (value === "super_admin") return "owner";
  if (value === "operations_manager") return "manager";
  if (value === "operations_coordinator") return "manager";
  return value || "customer";
}

export function roleLabelFromRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (value === "owner") return "Executive Access";
  if (value === "super_admin") return "Executive Access";
  if (value === "admin") return "Admin Access";
  if (value === "manager") return "Manager Access";
  if (value === "operations_manager") return "Operations Manager Access";
  if (value === "operations_coordinator") return "Operations Access";
  if (value === "sales") return "Sales Access";
  if (value === "sales_rep") return "Sales Access";
  if (value === "technician") return "Technician Access";
  if (value === "tech") return "Technician Access";
  if (value === "hr") return "HR Access";
  if (value === "customer") return "Customer Access";
  return "Customer Access";
}

export function applyUserToUi(userData = {}) {
  const displayName = userData.displayName || userData.fullName || userData.name || userData.username || userData.email || "User";
  const email = userData.email || "";
  const role = userData.role || "customer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const roleText = roleLabelFromRole(role);

  document.querySelectorAll("[data-user-name]").forEach((el) => { el.textContent = displayName; });
  document.querySelectorAll("[data-user-email]").forEach((el) => { el.textContent = email; });
  document.querySelectorAll("[data-user-avatar]").forEach((el) => { el.textContent = initial; });
  document.querySelectorAll("[data-user-role]").forEach((el) => { el.textContent = roleText; });

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
    id: user.uid || "",
    email: user.email || "",
    displayName: extras.displayName || user.displayName || user.email || "",
    fullName: extras.fullName || extras.displayName || user.displayName || "",
    name: extras.name || extras.fullName || extras.displayName || user.displayName || "",
    username: extras.username || "",
    role: role || "customer",
    companyId: extras.companyId || "",
    companyName: extras.companyName || "",
    approvalStatus: extras.approvalStatus || "",
    status: extras.status || "active"
  };

  saveUserRole(profile.role);
  saveUserProfile(profile);
  applyUserToUi(profile);

  dispatchSessionReady({ authenticated: true, role: profile.role });
}

export function requireRole(allowedRoles = [], fallbackPath = "./login.html") {
  const allowed = allowedRoles.map((role) => normalizeRole(role));

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader(fallbackPath, {
        title: "Secure Area",
        subtitle: "Please sign in to continue."
      }, true);
      return;
    }

    currentUser = user;
    const savedRole = normalizeRole(getSavedUserRole());

    if (allowed.length && !allowed.includes(savedRole)) {
      navigateWithLoader("./dashboard.html", {
        title: "Redirecting",
        subtitle: "Opening your dashboard."
      }, true);
    }
  });
}

export async function hydrateUserProfile(user = auth.currentUser) {
  if (!user) return null;

  const cached = getSavedUserProfile();

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    const role = data.role || cached?.role || getSavedUserRole() || "customer";

    const profile = {
      uid: user.uid,
      id: user.uid,
      email: user.email || data.email || cached?.email || "",
      displayName: data.displayName || data.fullName || cached?.displayName || user.displayName || user.email || "",
      fullName: data.fullName || data.displayName || cached?.fullName || cached?.displayName || user.displayName || "",
      name: data.name || data.fullName || data.displayName || cached?.name || cached?.fullName || cached?.displayName || user.displayName || "",
      username: data.username || cached?.username || "",
      role,
      companyId: data.companyId || cached?.companyId || "",
      companyName: data.companyName || cached?.companyName || "",
      approvalStatus: data.approvalStatus || cached?.approvalStatus || "",
      status: data.status || cached?.status || "active"
    };

    saveUserRole(role);
    saveUserProfile(profile);
    applyUserToUi(profile);
    dispatchSessionReady({ authenticated: true, role });
    return profile;
  } catch (error) {
    console.warn("User profile hydration skipped:", error);
    if (cached) applyUserToUi(cached);
    dispatchSessionReady({ authenticated: true, role: cached?.role || getSavedUserRole() });
    return cached;
  }
}

export function startGlobalAuthSync() {
    if (globalAuthSyncStarted) return;
    globalAuthSyncStarted = true;

    document.documentElement.classList.add("auth-pending");
    document.body?.classList.add("auth-pending", "app-loading");

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;

      if (!user) {
        clearSavedUserRole();
        clearSavedUserProfile();
        hideGlobalLoader();
        dispatchSessionReady({ authenticated: false });
        return;
      }

      await hydrateUserProfile(user);
      hideGlobalLoader();
    });
}

startGlobalAuthSync();
