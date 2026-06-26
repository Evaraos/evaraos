import { VALID_MODES, getAppearance, saveAppearance, resetAppearance, applyAppearance, setText, setMessage, markSettingsReady } from "./settings-shared.js";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_STORED_LENGTH = 3_600_000;
let draft = cleanDraft(getAppearance());

function cleanDraft(value = {}) {
  return {
    mode: VALID_MODES.includes(value.mode) ? value.mode : "light",
    imageTheme: value.imageTheme === "light" ? "light" : "dark",
    imageUrl: String(value.imageUrl || ""),
    imagePosition: value.imagePosition || "center center",
    imageOverlay: Number.isFinite(Number(value.imageOverlay)) ? Number(value.imageOverlay) : 0.36,
    updatedAt: value.updatedAt || null
  };
}

function label(mode) { return mode === "dark" ? "Dark" : mode === "system" ? "System" : mode === "image" ? "Image" : "Light"; }
function sourceSheet(open) {
  const sheet = document.getElementById("appearanceSourceSheet");
  if (!sheet) return;
  sheet.hidden = !open;
  sheet.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("appearance-source-open", open);
}
function savePanel(open, message = "Unsaved appearance changes.") {
  const panel = document.getElementById("appearanceSavePanel");
  if (!panel) return;
  panel.hidden = !open;
  panel.classList.toggle("is-visible", open);
  setMessage("appearanceSaveMessage", message);
}
function preview() {
  const node = document.getElementById("appearanceImagePreview");
  if (!node) return;
  node.style.backgroundImage = draft.imageUrl ? `linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),url(${JSON.stringify(draft.imageUrl)})` : "linear-gradient(145deg,#dbeafe,#111827)";
  node.style.backgroundPosition = draft.imagePosition;
}
function sync() {
  draft = cleanDraft(draft);
  setText("appearanceModeLabel", label(draft.mode));
  document.querySelectorAll("[data-appearance-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.appearanceMode === draft.mode));
  document.querySelectorAll("[data-image-theme]").forEach((button) => button.classList.toggle("is-active", button.dataset.imageTheme === draft.imageTheme));
  const panel = document.getElementById("appearanceImagePanel");
  if (panel) panel.hidden = draft.mode !== "image";
  const position = document.getElementById("appearanceImagePosition");
  if (position) position.value = draft.imagePosition;
  const overlay = document.getElementById("appearanceImageOverlay");
  if (overlay) overlay.value = String(Math.round(draft.imageOverlay * 100));
  setText("appearanceImageOverlayValue", `${Math.round(draft.imageOverlay * 100)}%`);
  preview();
  applyAppearance(draft);
}
function change(patch) {
  draft = cleanDraft({ ...draft, ...patch, updatedAt: new Date().toISOString() });
  sync();
  savePanel(true);
}
function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("The image could not be read.")); reader.readAsDataURL(file); }); }
function loadImage(source) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Choose a readable image.")); image.src = source; }); }
function compress(image, max, quality) {
  const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", quality);
}
async function prepare(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 12 MB.");
  const image = await loadImage(await readFile(file));
  let output = compress(image, 1920, .84);
  if (output.length > MAX_STORED_LENGTH) output = compress(image, 1440, .74);
  if (output.length > MAX_STORED_LENGTH) output = compress(image, 1080, .66);
  if (output.length > MAX_STORED_LENGTH) throw new Error("Choose a smaller image.");
  return output;
}
async function consume(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try { sourceSheet(false); savePanel(true, "Preparing image..."); change({ mode: "image", imageUrl: await prepare(file) }); }
  catch (error) { savePanel(true, error.message || "Unable to use this image."); }
  finally { input.value = ""; }
}
function bind() {
  document.querySelectorAll("[data-appearance-mode]").forEach((button) => button.addEventListener("click", () => {
    change({ mode: button.dataset.appearanceMode });
    if (button.dataset.appearanceMode === "image" && !draft.imageUrl) sourceSheet(true);
  }));
  document.querySelectorAll("[data-image-theme]").forEach((button) => button.addEventListener("click", () => change({ mode: "image", imageTheme: button.dataset.imageTheme })));
  const photo = document.getElementById("appearancePhotoInput");
  const camera = document.getElementById("appearanceCameraInput");
  const files = document.getElementById("appearanceFileInput");
  [photo, camera, files].forEach((input) => input?.addEventListener("change", () => consume(input)));
  document.getElementById("openAppearanceSourceBtn")?.addEventListener("click", () => sourceSheet(true));
  document.getElementById("appearanceSourceClose")?.addEventListener("click", () => sourceSheet(false));
  document.getElementById("appearanceSourceBackdrop")?.addEventListener("click", () => sourceSheet(false));
  document.querySelector("[data-source-action='photos']")?.addEventListener("click", () => photo?.click());
  document.querySelector("[data-source-action='camera']")?.addEventListener("click", () => camera?.click());
  document.querySelector("[data-source-action='files']")?.addEventListener("click", () => files?.click());
  document.getElementById("appearanceImagePosition")?.addEventListener("change", (event) => change({ imagePosition: event.target.value }));
  document.getElementById("appearanceImageOverlay")?.addEventListener("input", (event) => change({ imageOverlay: Number(event.target.value) / 100 }));
  document.getElementById("clearAppearanceImageBtn")?.addEventListener("click", () => { change({ imageUrl: "" }); sourceSheet(true); });
  document.getElementById("saveAppearanceBtn")?.addEventListener("click", () => {
    if (draft.mode === "image" && !draft.imageUrl) return sourceSheet(true);
    draft = saveAppearance(draft);
    sync();
    savePanel(true, "Appearance saved.");
    window.setTimeout(() => savePanel(false), 1100);
  });
  document.getElementById("resetAppearanceBtn")?.addEventListener("click", () => { draft = resetAppearance(); sync(); savePanel(false); sourceSheet(false); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") sourceSheet(false); });
}

function init() { bind(); sync(); savePanel(false); markSettingsReady(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
