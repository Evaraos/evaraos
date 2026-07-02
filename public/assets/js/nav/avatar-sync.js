import { auth, db } from "../firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let syncing = false;

function readStoredProfile() {
  try {
    const raw = localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredProfile(profile) {
  const storage = localStorage.getItem("evaraos-user") ? localStorage : sessionStorage;
  try { storage.setItem("evaraos-user", JSON.stringify(profile)); } catch {}
}

function safe(value = "") {
  return String(value || "").replace(/[<>"']/g, "");
}

function userIcon(className) {
  return window.EvaraIcons?.iconSvg?.("account", className)
    || `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.6-4 4.1-6 7.5-6s5.9 2 7.5 6"/></svg>`;
}

function applyTopAvatar(node, photoURL, displayName) {
  if (photoURL) {
    node.classList.add("has-avatar");
    node.innerHTML = `<img class="eva-top-avatar" src="${safe(photoURL)}" alt="${safe(displayName)}" />`;
    const image = node.querySelector("img");
    image?.addEventListener("error", () => {
      node.classList.remove("has-avatar");
      node.innerHTML = userIcon("eva-top-action-icon");
    }, { once: true });
  } else {
    node.classList.remove("has-avatar");
    node.innerHTML = userIcon("eva-top-action-icon");
  }
}

function applyDrawerAvatar(node, photoURL, displayName) {
  if (photoURL) {
    node.innerHTML = `<img src="${safe(photoURL)}" alt="${safe(displayName)}" />`;
    const image = node.querySelector("img");
    image?.addEventListener("error", () => {
      node.innerHTML = userIcon("eva-drawer-avatar-icon");
    }, { once: true });
  } else {
    node.innerHTML = userIcon("eva-drawer-avatar-icon");
  }
}

function applyAvatar(photoURL, displayName = "Evaraos User") {
  document.querySelectorAll(".eva-profile-trigger").forEach((node) => applyTopAvatar(node, photoURL, displayName));
  document.querySelectorAll(".eva-drawer-avatar").forEach((node) => applyDrawerAvatar(node, photoURL, displayName));
}

export async function syncUniversalAvatar() {
  if (syncing) return;
  syncing = true;
  try {
    const stored = readStoredProfile();
    const user = auth.currentUser;
    const uid = user?.uid || stored.uid || stored.id || "";
    let profile = stored;

    if (uid) {
      const snapshot = await getDoc(doc(db, "users", uid));
      if (snapshot.exists()) profile = { ...stored, ...snapshot.data(), uid, id: uid };
    }

    const photoURL = profile.photoURL || profile.profilePhoto || profile.profilePhotoUrl || "";
    const displayName = profile.displayName || profile.fullName || profile.name || profile.username || user?.displayName || user?.email || "Evaraos User";
    writeStoredProfile({ ...profile, photoURL, displayName });
    applyAvatar(photoURL, displayName);
  } catch (error) {
    console.warn("Universal avatar sync skipped:", error);
    const stored = readStoredProfile();
    applyAvatar(stored.photoURL || "", stored.displayName || stored.fullName || stored.name || "Evaraos User");
  } finally {
    syncing = false;
  }
}

function start() {
  syncUniversalAvatar();
  window.addEventListener("evara:session-ready", syncUniversalAvatar);
  window.addEventListener("pageshow", syncUniversalAvatar);
  window.addEventListener("storage", (event) => {
    if (event.key === "evaraos-user") syncUniversalAvatar();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
