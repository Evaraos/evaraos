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

function applyAvatar(photoURL, displayName = "Evaraos User") {
  const initial = (String(displayName).trim().charAt(0) || "E").toUpperCase();
  document.querySelectorAll(".eva-profile-trigger, .eva-drawer-avatar").forEach((node) => {
    node.innerHTML = photoURL
      ? `<img src="${photoURL}" alt="${String(displayName).replace(/[<>]/g, "")}" />`
      : `<span>${initial}</span>`;
  });
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
