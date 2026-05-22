const form = document.getElementById("evaAiPageForm");
const input = document.getElementById("evaAiPageInput");
const thread = document.getElementById("evaAiThread");
const suggestions = document.querySelectorAll("[data-ai-prompt]");
const newChat = document.getElementById("evaAiNewChat");
const plusButton = document.getElementById("evaAiPlus");
const imageInput = document.getElementById("evaAiImageInput");

let thinkingCard = null;
let submitLock = false;
let pendingImages = [];
let growRaf = 0;
let scrollRaf = 0;

function markReady() {
  document.body?.classList.remove("app-loading");
  document.body?.classList.add("app-ready");
  window.EvaraLoader?.markAppReady?.();
}

function autoGrow() {
  if (!input) return;
  cancelAnimationFrame(growRaf);
  growRaf = requestAnimationFrame(() => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  });
}

function scrollToBottom(behavior = "auto") {
  if (!thread) return;
  cancelAnimationFrame(scrollRaf);
  scrollRaf = requestAnimationFrame(() => {
    try {
      thread.scrollTo({ top: thread.scrollHeight, behavior });
    } catch {
      thread.scrollTop = thread.scrollHeight;
    }
  });
}

function buildMessage(role, text) {
  const card = document.createElement("article");
  card.className = `eva-ai-message-card ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "eva-ai-avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "eva-ai-bubble";

  const p = document.createElement("p");
  p.textContent = text;

  bubble.appendChild(p);
  card.appendChild(avatar);
  card.appendChild(bubble);
  return card;
}

function appendMessage(role, text, options = {}) {
  if (!thread || !String(text || "").trim()) return null;
  const card = buildMessage(role, text);
  thread.appendChild(card);
  scrollToBottom(options.smooth ? "smooth" : "auto");
  return card;
}

function appendImageMessage(files = []) {
  if (!thread || !files.length) return null;

  const card = document.createElement("article");
  card.className = "eva-ai-message-card user has-attachments";

  const avatar = document.createElement("div");
  avatar.className = "eva-ai-avatar";
  avatar.textContent = "You";

  const bubble = document.createElement("div");
  bubble.className = "eva-ai-bubble eva-ai-attachment-bubble";

  const label = document.createElement("p");
  label.textContent = files.length === 1 ? "Image added" : "Images added";

  const grid = document.createElement("div");
  grid.className = "eva-ai-attachment-grid";

  files.forEach((file) => {
    const item = document.createElement("figure");
    item.className = "eva-ai-attachment-card";

    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.alt = file.name || "Uploaded image";
    img.src = url;
    img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    img.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });

    const cap = document.createElement("figcaption");
    cap.textContent = file.name || "Image";

    item.appendChild(img);
    item.appendChild(cap);
    grid.appendChild(item);
  });

  bubble.appendChild(label);
  bubble.appendChild(grid);
  card.appendChild(bubble);
  card.appendChild(avatar);
  thread.appendChild(card);
  scrollToBottom("smooth");
  return card;
}

function showThinking() {
  removeThinking();
  thinkingCard = appendMessage("assistant", "Thinking...");
}

function removeThinking() {
  thinkingCard?.remove?.();
  thinkingCard = null;
}

function fakeAiResponse(prompt = "") {
  const normalized = String(prompt || "").toLowerCase();
  if (normalized.includes("build")) return "Next build priority: finalize dashboards, connect Firebase live data, and add AI actions.";
  if (normalized.includes("ui")) return "For UI polish, prioritize stable nav spacing and shared shell layouts.";
  if (pendingImages.length) return "I received the image preview. Next step is connecting this to real multimodal AI analysis and storage.";
  return "I’m ready. Tell me what part of Evaraos you want to build, fix, or improve next.";
}

function setBusy(isBusy) {
  submitLock = Boolean(isBusy);
  form?.classList.toggle("is-busy", submitLock);
}

function submitPrompt(promptText) {
  if (submitLock) return;
  const value = String(promptText || input?.value || "").trim();
  if (!value && !pendingImages.length) return;

  setBusy(true);
  if (value) appendMessage("user", value);
  if (input) {
    input.value = "";
    autoGrow();
  }

  showThinking();
  window.setTimeout(() => {
    removeThinking();
    appendMessage("assistant", fakeAiResponse(value));
    pendingImages = [];
    setBusy(false);
  }, 260);
}

function resetChat() {
  if (!thread) return;
  removeThinking();
  setBusy(false);
  pendingImages = [];
  thread.innerHTML = "";
  thread.scrollTop = 0;
  appendMessage("assistant", "Fresh workspace opened. What do you want to build or fix next?");
}

function openImagePicker() {
  imageInput?.click();
}

function handleImageSelection(event) {
  const files = Array.from(event.target?.files || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;
  pendingImages = files;
  appendImageMessage(files);
  if (input && !input.value.trim()) input.placeholder = "Ask Evaraos AI about this image...";
  event.target.value = "";
}

function restoreTopOnFreshOpen(event) {
  if (event?.persisted) return;
  if (thread) thread.scrollTop = 0;
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitPrompt();
});

input?.addEventListener("input", autoGrow, { passive: true });
input?.addEventListener("focus", () => document.body?.classList.add("ai-keyboard-active"));
input?.addEventListener("blur", () => window.setTimeout(() => document.body?.classList.remove("ai-keyboard-active"), 120));
input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitPrompt();
  }
});

suggestions.forEach((button) => button.addEventListener("click", () => submitPrompt(button.dataset.aiPrompt || "")));
newChat?.addEventListener("click", resetChat);
plusButton?.addEventListener("click", openImagePicker);
imageInput?.addEventListener("change", handleImageSelection);

window.addEventListener("pageshow", (event) => {
  restoreTopOnFreshOpen(event);
  markReady();
}, { once: true });
window.addEventListener("load", markReady, { once: true });

autoGrow();
markReady();