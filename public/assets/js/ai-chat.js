import { functions, httpsCallable } from "./firebase.js";
import { iconSvg } from "./ui/icons.js";

const STORAGE_KEY = "evaraos-ai-thread";
const aiCommand = httpsCallable(functions, "aiCommand");
let messages = loadMessages();
let sending = false;

function clean(value = "") {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function loadMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveMessages() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch {}
}

function thread() { return document.getElementById("evaraAiThread"); }
function input() { return document.getElementById("evaraAiInput"); }
function sendButton() { return document.getElementById("evaraAiSend"); }
function status(message = "") { const node = document.getElementById("evaraAiStatus"); if (node) node.textContent = message; }

function renderEmpty() {
  return `<section class="evara-ai-empty"><div class="evara-ai-empty-inner"><div class="evara-ai-mark">${iconSvg("ai")}</div><h2>How can Evaraos help?</h2><p>Ask about your workspace, leads, jobs, companies, operations, or anything else you need help with.</p><div class="evara-ai-suggestions"><button class="evara-ai-suggestion" type="button" data-ai-prompt="Summarize what I should focus on today.">Today’s focus</button><button class="evara-ai-suggestion" type="button" data-ai-prompt="Help me organize my leads pipeline.">Organize leads</button><button class="evara-ai-suggestion" type="button" data-ai-prompt="What should I review before assigning jobs?">Review jobs</button></div></div></section>`;
}

function renderMessage(message) {
  const role = message.role === "user" ? "user" : "assistant";
  return `<article class="evara-ai-message ${role}"><div class="evara-ai-message-role">${role === "user" ? "You" : "Evaraos AI"}</div><div class="evara-ai-bubble">${clean(message.content)}</div></article>`;
}

function render() {
  const node = thread();
  if (!node) return;
  node.innerHTML = messages.length ? messages.map(renderMessage).join("") : renderEmpty();
  requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
}

function setSending(value) {
  sending = value;
  const button = sendButton();
  if (button) button.disabled = value;
  if (value) status("Evaraos AI is thinking…");
  else status("");
}

async function submitPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text || sending) return;

  messages.push({ role: "user", content: text, at: Date.now() });
  saveMessages();
  render();
  setSending(true);

  try {
    const response = await aiCommand({
      prompt: text,
      context: {
        pathname: window.location.pathname,
        history: messages.slice(-8).map(({ role, content }) => ({ role, content }))
      }
    });
    const data = response?.data || {};
    messages.push({ role: "assistant", content: data.message || "I could not generate a response.", at: Date.now() });
    saveMessages();
    render();
    if (data.action?.type === "navigate" && data.action.route) {
      status(`Suggested page: ${data.action.title || data.action.route}`);
    }
  } catch (error) {
    console.error("Evaraos AI request failed:", error);
    messages.push({ role: "assistant", content: error?.message || "Evaraos AI is temporarily unavailable.", at: Date.now() });
    saveMessages();
    render();
  } finally {
    setSending(false);
  }
}

function autoResize() {
  const node = input();
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${Math.min(180, node.scrollHeight)}px`;
}

function bind() {
  document.getElementById("evaraAiForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const node = input();
    const value = node?.value || "";
    if (node) { node.value = ""; autoResize(); }
    submitPrompt(value);
  });
  input()?.addEventListener("input", autoResize);
  input()?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      document.getElementById("evaraAiForm")?.requestSubmit();
    }
  });
  document.addEventListener("click", (event) => {
    const suggestion = event.target.closest("[data-ai-prompt]");
    if (suggestion) submitPrompt(suggestion.dataset.aiPrompt);
  });
  document.getElementById("evaraAiClear")?.addEventListener("click", () => {
    messages = [];
    saveMessages();
    render();
    input()?.focus();
  });
}

function init() {
  render();
  bind();
  autoResize();
  document.body.classList.remove("app-loading");
  document.body.classList.add("app-ready");
  window.EvaraLoader?.markAppReady?.();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
