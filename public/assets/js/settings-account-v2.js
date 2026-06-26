import { setMessage, markSettingsReady } from "./settings-shared.js";
import { auth, db, syncUserSession } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let photoURL = "";
let timer = 0;
const byId = (id) => document.getElementById(id);

function localUser() {
  try { return JSON.parse(localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user") || "null") || {}; }
  catch { return {}; }
}

function identity() {
  const saved = localUser();
  return { saved, user: auth.currentUser, uid: auth.currentUser?.uid || saved.uid || saved.id || "" };
}

function ensureProfileUi() {
  if (!document.querySelector('link[href*="account-profile.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/pages/account-profile.css?v=2";
    document.head.appendChild(link);
  }
  if (byId("accountPhotoPreview")) return;
  const details = document.querySelector(".settings-block");
  if (!details) return;
  const section = document.createElement("section");
  section.className = "settings-block glass-card account-profile-card";
  section.innerHTML = `<div class="account-photo-wrap"><div id="accountPhotoPreview" class="account-photo-preview"><span>E</span></div><div class="account-photo-actions"><button id="chooseAccountPhotoBtn" type="button" class="btn btn-theme-secondary">Choose Photo</button><button id="removeAccountPhotoBtn" type="button" class="btn btn-theme-secondary">Remove</button></div><input id="accountPhotoInput" class="account-photo-input" type="file" accept="image/*"></div><div class="account-profile-meta"><div class="settings-head"><p class="settings-kicker">Profile Picture</p><h2>Your universal identity</h2><p>Drag the image to reposition it, then use the zoom slider. Changes save automatically.</p></div><label class="settings-range-head" for="accountPhotoZoom"><span>Photo zoom</span><strong id="accountPhotoZoomValue">100%</strong></label><input id="accountPhotoZoom" type="range" min="100" max="180" value="100"><div class="account-autosave-status"><span class="account-autosave-dot"></span><span id="accountPhotoMessage">Profile image saves automatically.</span></div></div>`;
  details.parentNode.insertBefore(section, details);
}

function renderPhoto(name = "Evaraos User") {
  const preview = byId("accountPhotoPreview");
  if (!preview) return;
  const zoom = Number(byId("accountPhotoZoom")?.value || 100);
  if (photoURL) preview.innerHTML = `<img src="${photoURL}" alt="${String(name).replace(/[<>]/g, "")}" style="transform:scale(${zoom / 100});transform-origin:center center">`;
  else preview.innerHTML = `<span>${(String(name).trim().charAt(0) || "E").toUpperCase()}</span>`;
  if (byId("accountPhotoZoomValue")) byId("accountPhotoZoomValue").textContent = `${zoom}%`;
}

function updateSession(patch) {
  const current = localUser();
  const next = { ...current, ...patch, photoURL: patch.photoURL ?? current.photoURL ?? "" };
  const storage = localStorage.getItem("evaraos-user") ? localStorage : sessionStorage;
  storage.setItem("evaraos-user", JSON.stringify(next));
  if (auth.currentUser) syncUserSession(auth.currentUser, next.role || "customer", next);
  window.dispatchEvent(new CustomEvent("evara:session-ready", { detail: { source: "account-settings", profile: next } }));
}

function compressFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) return reject(new Error("Choose an image file."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Choose an image smaller than 8 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The image could not be opened."));
      image.onload = () => {
        const size = 512;
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { alpha: false });
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/webp", .76));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

async function persist(statusId = "accountSaveMessage") {
  const { saved, user, uid } = identity();
  if (!uid) return setMessage(statusId, "No active account session found.");
  const displayName = byId("accountDisplayName")?.value?.trim() || saved.displayName || "";
  const username = byId("accountUsername")?.value?.trim() || saved.username || "";
  if (!displayName || !username) return setMessage(statusId, "Display name and username are required.");
  const patch = {
    displayName,
    fullName: displayName,
    username,
    usernameLower: username.toLowerCase(),
    photoURL,
    updatedAt: new Date().toISOString()
  };
  try {
    setMessage(statusId, "Saving...");
    await setDoc(doc(db, "users", uid), patch, { merge: true });
    updateSession({ ...patch, email: user?.email || saved.email || "", role: saved.role || "customer" });
    renderPhoto(displayName);
    setMessage(statusId, "Saved automatically.");
  } catch (error) {
    console.error("Profile save failed:", error);
    setMessage(statusId, error?.code === "permission-denied" ? "Profile save is blocked by Firestore permissions." : "Could not save profile changes.");
  }
}

function schedule() {
  clearTimeout(timer);
  setMessage("accountSaveMessage", "Saving changes...");
  timer = window.setTimeout(() => persist(), 550);
}

async function load() {
  ensureProfileUi();
  const { saved, user, uid } = identity();
  if (!uid) return setMessage("accountSaveMessage", "No active account session found.");
  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    const data = snapshot.exists() ? snapshot.data() : {};
    const name = data.displayName || data.fullName || user?.displayName || saved.displayName || "";
    photoURL = data.photoURL || saved.photoURL || saved.profilePhoto || "";
    if (byId("accountDisplayName")) byId("accountDisplayName").value = name;
    if (byId("accountUsername")) byId("accountUsername").value = data.username || saved.username || "";
    if (byId("accountEmail")) byId("accountEmail").value = data.email || user?.email || saved.email || "";
    if (byId("accountRole")) byId("accountRole").value = data.role || saved.role || "customer";
    renderPhoto(name);
    updateSession({ ...data, photoURL });
    setMessage("accountSaveMessage", "Loaded. Changes save automatically.");
  } catch (error) {
    console.error("Profile load failed:", error);
    setMessage("accountSaveMessage", "Could not load account details.");
  }
}

function bind() {
  ensureProfileUi();
  ["accountDisplayName", "accountUsername"].forEach((id) => byId(id)?.addEventListener("input", schedule));
  byId("saveAccountBtn")?.addEventListener("click", () => persist());
  byId("chooseAccountPhotoBtn")?.addEventListener("click", () => byId("accountPhotoInput")?.click());
  byId("accountPhotoInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setMessage("accountPhotoMessage", "Preparing image...");
      photoURL = await compressFile(file);
      renderPhoto(byId("accountDisplayName")?.value || "Evaraos User");
      await persist("accountPhotoMessage");
    } catch (error) { setMessage("accountPhotoMessage", error.message || "Could not use this image."); }
    event.target.value = "";
  });
  byId("removeAccountPhotoBtn")?.addEventListener("click", async () => { photoURL = ""; renderPhoto(byId("accountDisplayName")?.value || "Evaraos User"); await persist("accountPhotoMessage"); });
  byId("accountPhotoZoom")?.addEventListener("input", () => renderPhoto(byId("accountDisplayName")?.value || "Evaraos User"));
}

function init() { bind(); load().finally(markSettingsReady); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
