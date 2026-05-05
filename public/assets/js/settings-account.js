import {
  setMessage,
  markSettingsReady
} from "./settings-shared.js";

import {
  auth,
  db,
  syncUserSession
} from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function byId(id) {
  return document.getElementById(id);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function getLocalUser() {
  try {
    const raw =
      localStorage.getItem("evaraos-user") ||
      sessionStorage.getItem("evaraos-user");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setValue(id, value) {
  const el = byId(id);
  if (!el) return;
  el.value = value || "";
}

async function loadAccount() {
  const localUser = getLocalUser();
  const firebaseUser = auth.currentUser;
  const uid = firebaseUser?.uid || localUser?.uid;

  if (!uid) {
    setMessage("accountSaveMessage", "No active account session found.");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : {};

    setValue("accountDisplayName", data.displayName || data.fullName || firebaseUser?.displayName || localUser?.displayName || "");
    setValue("accountUsername", data.username || localUser?.username || "");
    setValue("accountEmail", data.email || firebaseUser?.email || localUser?.email || "");
    setValue("accountRole", data.role || localUser?.role || "owner");

    setMessage("accountSaveMessage", "Account loaded.");
  } catch (error) {
    console.error("Account load failed:", error);
    setMessage("accountSaveMessage", "Could not load account details.");
  }
}

async function saveAccount() {
  const localUser = getLocalUser();
  const firebaseUser = auth.currentUser;
  const uid = firebaseUser?.uid || localUser?.uid;

  if (!uid) {
    setMessage("accountSaveMessage", "No active account session found.");
    return;
  }

  const displayName = byId("accountDisplayName")?.value?.trim() || "";
  const username = byId("accountUsername")?.value?.trim() || "";
  const email = byId("accountEmail")?.value?.trim() || firebaseUser?.email || localUser?.email || "";
  const role = byId("accountRole")?.value?.trim() || localUser?.role || "owner";

  if (!displayName || !username) {
    setMessage("accountSaveMessage", "Display name and username are required.");
    return;
  }

  try {
    setMessage("accountSaveMessage", "Saving account...");

    const patch = {
      uid,
      displayName,
      fullName: displayName,
      username,
      usernameLower: normalizeUsername(username),
      email,
      role,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, "users", uid), patch, { merge: true });

    if (firebaseUser) {
      syncUserSession(firebaseUser, role, {
        displayName,
        fullName: displayName,
        username
      });
    }

    setMessage("accountSaveMessage", "Account saved.");
  } catch (error) {
    console.error("Account save failed:", error);
    setMessage("accountSaveMessage", "Could not save account.");
  }
}

function bindAccount() {
  const saveBtn = byId("saveAccountBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveAccount);
}

function init() {
  bindAccount();
  loadAccount().finally(markSettingsReady);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
