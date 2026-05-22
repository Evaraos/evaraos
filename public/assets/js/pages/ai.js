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

function cleanupGlobalLoader() {
  [
    "#evaraLoader",
    "#evaraPageLoader",
    "#evaraRouteLoader",
    "#evaPageTransition",
    "#evaraFastLoader"
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });

  document.documentElement.classList.remove(
    "eva-transitioning",
    "eva-route-loading",
    "eva-loading"
  );

  document.body.classList.remove(
    "app-loading",
    "eva-route-loading",
    "eva-loading"
  );

  document.body.classList.add("app-ready");
}

function markReady() {
  cleanupGlobalLoader();
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

function showThinking() {
  removeThinking();
  thinkingCard = appendMessage("assistant", "Thinking...");
}

function removeThinking() {
  thinkingCard?.remove?.();
  thinkingCard = null;
}

function fakeAiResponse(prompt = "") {
  return "I’m ready. Tell me what part of Evaraos you want to build, fix, or improve next.";
}

function setBusy(isBusy) {
  submitLock = Boolean(isBusy);
  form?.classList.toggle("is-busy", submitLock);
}

function submitPrompt(promptText) {
  if (submitLock) return;
  const value = String(promptText || input?.value || "").trim();
  if (!value) return;

  setBusy(true);
  appendMessage("user", value);

  if (input) {
    input.value = "";
    autoGrow();
  }

  showThinking();

  window.setTimeout(() => {
    removeThinking();
    appendMessage("assistant", fakeAiResponse(value));
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

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitPrompt();
});

input?.addEventListener("input", autoGrow, { passive: true });
input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitPrompt();
  }
});

newChat?.addEventListener("click", resetChat);
plusButton?.addEventListener("click", () => imageInput?.click());

window.addEventListener("pageshow", markReady, { once: true });
window.addEventListener("load", markReady, { once: true });

autoGrow();
markReady();