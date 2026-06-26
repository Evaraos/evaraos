import { setMessage, markSettingsReady } from "./settings-shared.js";
import { auth, db, syncUserSession } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_STORED_LENGTH = 900_000;
let saveTimer = 0;
let currentProfilePhoto = "";

function byId(id) { return document.getElementById(id); }
function normalizeUsername(value) { return String(value || "").trim().toLowerCase(); }
function getLocalUser() {
  try {
    const raw = localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setValue(id, value) { const el = byId(id); if (el) el.value = value || ""; }
function activeIdentity() {
  const localUser = getLocalUser();
  const firebaseUser = auth.currentUser;
  return { localUser, firebaseUser, uid: firebaseUser?.uid || localUser?.uid || "" };
}
function updateSession(profile) {
  const { firebaseUser, localUser } = activeIdentity();
  const next = { ...(localUser || {}), ...profile };
  const storage = localStorage.getItem("evaraos-user") ? localStorage : sessionStorage;
  storage.setItem("evaraos-user", JSON.stringify(next));
  if (firebaseUser) syncUserSession(firebaseUser, profile.role || next.role || "customer", profile);
  window.dispatchEvent(new CustomEvent("evara:session-ready", { detail: { source: "settings-account", profile: next } }));
}

function ensureProfileUi() {
  if (!document.querySelector('link[href*="account-profile.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/pages/account-profile.css?v=1";
    document.head.appendChild(link);
  }
  if (byId("accountPhotoPreview")) return;
  const details = document.querySelector(".settings-block");
  if (!details) return;
  const section = document.createElement("section");
  section.className = "settings-block glass-card account-profile-card";
  section.innerHTML = `<div class="account-photo-wrap"><div id="accountPhotoPreview" class="account-photo-preview" aria-label="Profile picture preview"><span id="accountPhotoInitial">E</span></div><div class="account-photo-actions"><button id="chooseAccountPhotoBtn" type="button" class="btn btn-theme-secondary">Choose Photo</button><button id="removeAccountPhotoBtn" type="button" class="btn btn-theme-secondary">Remove</button></div><input id="accountPhotoInput" class="account-photo-input" type="file" accept="image/*"></div><div class="account-profile-meta"><div class="settings-head"><p class="settings-kicker">Profile Picture</p><h2>Your universal identity</h2><p>This image appears in the top-left profile control and account drawer.</p></div><div class="account-autosave-status"><span class="account-autosave-dot"></span><span id="accountPhotoMessage">Profile image saves automatically.</span></div></div>`;
  details.parentNode.insertBefore(section, details);
}

function renderPhoto(photo, name = "Evaraos User") {
  const preview = byId("accountPhotoPreview");
  if (!preview) return;
  preview.innerHTML = photo ? `<img src="${photo}" alt="${String(name).replace(/[<>]/g, "")}">` : `<span id="accountPhotoInitial">${(String(name).trim().charAt(0) || "E").toUpperCase()}</span>`;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Choose a readable image."));
    image.src = source;
  });
}
function compress(image, maxDimension = 640, quality = .82) {
  const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", quality);
}
async function preparePhoto(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 8 MB.");
  const image = await loadImage(await readFile(file));
  let output = compress(image, 640, .82);
  if (output.length > MAX_STORED_LENGTH) output = compress(image, 480, .72);
  if (output.length > MAX_STORED_LENGTH) output = compress(image, 360, .66);
  if (output.length > MAX_STORED_LENGTH) throw new Error("Choose a smaller image.");
  return output;
}

async function savePatch(extra = {}, statusId = "accountSaveMessage") {
  const { localUser, firebaseUser, uid } = activeIdentity();
  if (!uid) return setMessage(statusId, "No active account session found.");
  const displayName = byId("accountDisplayName")?.value?.trim() || localUser?.displayName || "";
  const username = byId("accountUsername")?.value?.trim() || localUser?.username || "";
  const email = byId("accountEmail")?.value?.trim() || firebaseUser?.email || localUser?.email || "";
  const role = byId("accountRole")?.value?.trim() || localUser?.role || "customer";
  if (!displayName || !username) return setMessage(statusId, "Display name and username are required.");

  try {
    setMessage(statusId, "Saving automatically...");
    const patch = { uid, displayName, fullName: displayName, username, usernameLower: normalizeUsername(username), email, role, profilePhoto: currentProfilePhoto, profilePhotoUrl: currentProfilePhoto, updatedAt: new Date().toISOString(), ...extra };
    await setDoc(doc(db, "users", uid), patch, { merge: true });
    updateSession(patch);
    renderPhoto(currentProfilePhoto, displayName);
    setMessage(statusId, "Saved automatically.");
  } catch (error) {
    console.error("Account save failed:", error);
    setMessage(statusId, "Could not save account changes.");
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  setMessage("accountSaveMessage", "Changes detected...");
  saveTimer = window.setTimeout(() => savePatch(), 650);
}

async function loadAccount() {
  ensureProfileUi();
  const { localUser, firebaseUser, uid } = activeIdentity();
  if (!uid) return setMessage("accountSaveMessage", "No active account session found.");
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : {};
    const displayName = data.displayName || data.fullName || firebaseUser?.displayName || localUser?.displayName || "";
    currentProfilePhoto = data.profilePhoto || data.profilePhotoUrl || localUser?.profilePhoto || localUser?.profilePhotoUrl || "";
    setValue("accountDisplayName", displayName);
    setValue("accountUsername", data.username || localUser?.username || "");
    setValue("accountEmail", data.email || firebaseUser?.email || localUser?.email || "");
    setValue("accountRole", data.role || localUser?.role || "customer");
    renderPhoto(currentProfilePhoto, displayName);
    updateSession({ ...data, profilePhoto: currentProfilePhoto, profilePhotoUrl: currentProfilePhoto });
    setMessage("accountSaveMessage", "Account loaded. Changes save automatically.");
  } catch (error) {
    console.error("Account load failed:", error);
    setMessage("accountSaveMessage", "Could not load account details.");
  }
}

function bindAccount() {
  ensureProfileUi();
  ["accountDisplayName", "accountUsername"].forEach((id) => byId(id)?.addEventListener("input", scheduleSave));
  byId("saveAccountBtn")?.addEventListener("click", () => savePatch());
  byId("chooseAccountPhotoBtn")?.addEventListener("click", () => byId("accountPhotoInput")?.click());
  byId("accountPhotoInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setMessage("accountPhotoMessage", "Preparing profile image...");
      currentProfilePhoto = await preparePhoto(file);
      renderPhoto(currentProfilePhoto, byId("accountDisplayName")?.value || "Evaraos User");
      await savePatch({ profilePhoto: currentProfilePhoto, profilePhotoUrl: currentProfilePhoto }, "accountPhotoMessage");
    } catch (error) { setMessage("accountPhotoMessage", error.message || "Could not use this image."); }
    finally { event.target.value = ""; }
  });
  byId("removeAccountPhotoBtn")?.addEventListener("click", async () => {
    currentProfilePhoto = "";
    renderPhoto("", byId("accountDisplayName")?.value || "Evaraos User");
    await savePatch({ profilePhoto: "", profilePhotoUrl: "" }, "accountPhotoMessage");
  });
}

function init() { bindAccount(); loadAccount().finally(markSettingsReady); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
