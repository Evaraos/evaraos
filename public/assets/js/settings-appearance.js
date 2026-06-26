import {
  VALID_MODES,
  getAppearance,
  saveAppearance,
  resetAppearance,
  applyAppearance,
  setText,
  setMessage,
  markSettingsReady
} from "./settings-shared.js";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_STORED_LENGTH = 3_600_000;
let draft = getAppearance();
let sourceSheetShownForSession = false;

function normalizeMode(mode) {
  return VALID_MODES.includes(mode) ? mode : "light";
}

function modeLabel(mode) {
  if (mode === "dark") return "Dark";
  if (mode === "system") return "System";
  if (mode === "image") return "Image";
  return "Light";
}

function cleanDraft(value = {}) {
  return {
    mode: normalizeMode(value.mode),
    imageUrl: String(value.imageUrl || ""),
    imagePosition: value.imagePosition || "center center",
    imageOverlay: Number.isFinite(Number(value.imageOverlay)) ? Number(value.imageOverlay) : 0.36,
    updatedAt: value.updatedAt || null
  };
}

function setPreviewImage(imageUrl) {
  const preview = document.getElementById("appearanceImagePreview");
  if (!preview) return;

  preview.style.backgroundImage = imageUrl
    ? `linear-gradient(rgba(3,6,11,.18), rgba(3,6,11,.18)), url(${JSON.stringify(imageUrl)})`
    : "radial-gradient(circle at 22% 18%, rgba(255,255,255,.16), transparent 38%), linear-gradient(145deg, #28282b, #09090b)";
  preview.style.backgroundPosition = draft.imagePosition;
}

function sourceSheet(open) {
  const sheet = document.getElementById("appearanceSourceSheet");
  if (!sheet) return;
  sheet.hidden = !open;
  document.body.classList.toggle("appearance-source-open", open);
  sheet.setAttribute("aria-hidden", open ? "false" : "true");
}

function syncControls() {
  draft = cleanDraft(draft);
  setText("appearanceModeLabel", modeLabel(draft.mode));

  document.querySelectorAll("[data-appearance-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.appearanceMode === draft.mode);
  });

  const imagePanel = document.getElementById("appearanceImagePanel");
  if (imagePanel) imagePanel.hidden = draft.mode !== "image";

  const position = document.getElementById("appearanceImagePosition");
  if (position) position.value = draft.imagePosition;

  const overlay = document.getElementById("appearanceImageOverlay");
  if (overlay) overlay.value = String(Math.round(draft.imageOverlay * 100));
  setText("appearanceImageOverlayValue", `${Math.round(draft.imageOverlay * 100)}%`);

  setPreviewImage(draft.imageUrl);
  applyAppearance(draft);
}

function updateDraft(patch = {}) {
  draft = cleanDraft({ ...draft, ...patch, updatedAt: new Date().toISOString() });
  syncControls();
  setMessage("appearanceSaveMessage", "Unsaved appearance changes.");
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected file is not a readable image."));
    image.src = source;
  });
}

function renderCompressed(image, maxDimension, quality) {
  const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image processing is not available in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

async function prepareImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 12 MB.");

  const source = await readFile(file);
  const image = await loadImage(source);

  let output = renderCompressed(image, 1920, 0.84);
  if (output.length > MAX_STORED_LENGTH) output = renderCompressed(image, 1440, 0.76);
  if (output.length > MAX_STORED_LENGTH) output = renderCompressed(image, 1080, 0.68);
  if (output.length > MAX_STORED_LENGTH) throw new Error("This image is still too large after compression. Choose a smaller image.");
  return output;
}

async function consumeInput(input) {
  const file = input?.files?.[0];
  if (!file) return;

  try {
    sourceSheet(false);
    setMessage("appearanceSaveMessage", "Preparing image...");
    const imageUrl = await prepareImage(file);
    updateDraft({ mode: "image", imageUrl });
    setMessage("appearanceSaveMessage", "Image ready. Save to keep this appearance.");
  } catch (error) {
    setMessage("appearanceSaveMessage", error.message || "Unable to use this image.");
  } finally {
    input.value = "";
  }
}

function activateImageMode() {
  updateDraft({ mode: "image" });
  if (!sourceSheetShownForSession || !draft.imageUrl) {
    sourceSheetShownForSession = true;
    requestAnimationFrame(() => sourceSheet(true));
  }
}

function bindModeButtons() {
  document.querySelectorAll("[data-appearance-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.appearanceMode === "image") activateImageMode();
      else {
        sourceSheet(false);
        updateDraft({ mode: button.dataset.appearanceMode });
      }
    });
  });
}

function bindImageControls() {
  const photoInput = document.getElementById("appearancePhotoInput");
  const cameraInput = document.getElementById("appearanceCameraInput");
  const fileInput = document.getElementById("appearanceFileInput");
  const position = document.getElementById("appearanceImagePosition");
  const overlay = document.getElementById("appearanceImageOverlay");
  const clear = document.getElementById("clearAppearanceImageBtn");

  [photoInput, cameraInput, fileInput].forEach((input) => {
    input?.addEventListener("change", () => consumeInput(input));
  });

  document.getElementById("openAppearanceSourceBtn")?.addEventListener("click", () => sourceSheet(true));
  document.getElementById("appearanceSourceClose")?.addEventListener("click", () => sourceSheet(false));
  document.getElementById("appearanceSourceBackdrop")?.addEventListener("click", () => sourceSheet(false));
  document.querySelector("[data-source-action='photos']")?.addEventListener("click", () => photoInput?.click());
  document.querySelector("[data-source-action='camera']")?.addEventListener("click", () => cameraInput?.click());
  document.querySelector("[data-source-action='files']")?.addEventListener("click", () => fileInput?.click());

  position?.addEventListener("change", () => updateDraft({ imagePosition: position.value }));
  overlay?.addEventListener("input", () => updateDraft({ imageOverlay: Number(overlay.value) / 100 }));
  clear?.addEventListener("click", () => {
    updateDraft({ imageUrl: "" });
    setMessage("appearanceSaveMessage", "Image removed from the draft.");
    sourceSheet(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") sourceSheet(false);
  });
}

function bindActions() {
  document.getElementById("saveAppearanceBtn")?.addEventListener("click", () => {
    if (draft.mode === "image" && !draft.imageUrl) {
      setMessage("appearanceSaveMessage", "Choose an image before saving Image mode.");
      sourceSheet(true);
      return;
    }

    try {
      draft = saveAppearance(cleanDraft(draft));
      syncControls();
      setMessage("appearanceSaveMessage", "Appearance saved.");
    } catch (error) {
      const quota = error?.name === "QuotaExceededError";
      setMessage("appearanceSaveMessage", quota ? "The image is too large for local storage. Choose a smaller image." : "Appearance could not be saved.");
    }
  });

  document.getElementById("resetAppearanceBtn")?.addEventListener("click", () => {
    draft = resetAppearance();
    syncControls();
    sourceSheet(false);
    setMessage("appearanceSaveMessage", "Appearance reset to Light mode.");
  });
}

function init() {
  draft = cleanDraft(getAppearance());
  bindModeButtons();
  bindImageControls();
  bindActions();
  syncControls();
  markSettingsReady();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
