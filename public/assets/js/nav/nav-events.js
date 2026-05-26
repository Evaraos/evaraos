import {
  buildHref,
  getAppearanceTheme,
  setTheme,
  syncThemeLabel,
  getBrandBlock
} from "./nav-utils.js";

import { closeMenu } from "./nav-menu.js";
import { navigateWithLoader } from "./nav-navigation.js";
import { logoutAndRedirect, functions, httpsCallable } from "../firebase.js";
import { searchApps } from "../navigation/app-registry.js";

const BOUND_ATTR = "data-evara-nav-bound";

function stopEvent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

function clean(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function bindOnce(node, key, handler, options) {
  if (!node) return false;
  const attr = `${BOUND_ATTR}-${key}`;
  if (node.getAttribute(attr) === "true") return false;
  node.setAttribute(attr, "true");
  node.addEventListener(key, handler, options);
  return true;
}

export function clearPressTimer() {}
export function endCompactPress() {}
export function togglePill() {}
export function startCompactPress() {}
export function bindTapToggle() {}

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand || brand.dataset.brandHomeBound === "true") return;
  brand.dataset.brandHomeBound = "true";

  function openHome(event) {
    stopEvent(event);
    const href = brand.getAttribute("data-home-link") || buildHref("index.html");
    navigateWithLoader(href, {
      title: "Opening Home",
      subtitle: "Loading the Evaraos home experience."
    });
  }

  brand.addEventListener("click", openHome);
  brand.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") openHome(event);
  });
}

function openNavHref(href, options = {}) {
  if (!href) return;
  closeMenu(false);
  navigateWithLoader(href, {
    title: options.title || "Loading page",
    subtitle: options.subtitle || "Preparing your next screen."
  });
}

function openGroupPrimary(button) {
  if (!button) return;
  const stack = button.closest(".eva-control-row-stack");
  if (!stack) return;

  const existing = stack.querySelector(".eva-group-viewer");
  if (existing && existing.dataset.owner === button.getAttribute("data-nav-group")) {
    existing.remove();
    button.classList.remove("is-expanded");
    return;
  }

  stack.querySelectorAll(".eva-group-viewer").forEach((node) => node.remove());
  stack.querySelectorAll("[data-nav-group].is-expanded").forEach((node) => node.classList.remove("is-expanded"));

  try {
    const apps = JSON.parse(button.getAttribute("data-group-apps") || "[]");
    if (!apps.length) return;

    const viewer = document.createElement("div");
    viewer.className = "eva-group-viewer glass-card";
    viewer.dataset.owner = button.getAttribute("data-nav-group") || "";
    viewer.innerHTML = `
      <div class="eva-group-viewer-head">
        <strong>Quick Viewer</strong>
        <button type="button" class="eva-group-live-btn" data-group-live>Live View</button>
      </div>
      <div class="eva-group-viewer-links">
        ${apps.slice(0, 4).map((app) => `<button type="button" data-group-route="${clean(app.route)}">${clean(app.title)}</button>`).join("")}
      </div>
    `;

    button.insertAdjacentElement("afterend", viewer);
    button.classList.add("is-expanded");

    viewer.querySelectorAll("[data-group-route]").forEach((node) => {
      node.addEventListener("click", (event) => {
        stopEvent(event);
        openNavHref(node.getAttribute("data-group-route"), {
          title: "Opening tool",
          subtitle: "Launching from quick viewer."
        });
      });
    });

    const liveBtn = viewer.querySelector("[data-group-live]");
    liveBtn?.addEventListener("click", (event) => {
      stopEvent(event);
      const first = apps.find((app) => app.route);
      if (!first?.route) return;
      openNavHref(first.route, { title: "Opening Live View", subtitle: "Launching full page view." });
    });
  } catch (error) {
    console.warn("Unable to open nav group:", error);
  }
}

export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    bindOnce(link, "click", (event) => {
      stopEvent(event);
      openNavHref(link.getAttribute("data-menu-link") || link.getAttribute("href"));
    });
  });

  document.querySelectorAll("[data-nav-group]").forEach((button) => {
    bindOnce(button, "click", (event) => {
      stopEvent(event);
      openGroupPrimary(button);
    });
  });

  const logoutBtn = document.getElementById("evaLogoutBtn");
  bindOnce(logoutBtn, "click", async (event) => {
    stopEvent(event);
    closeMenu(false);
    await logoutAndRedirect(buildHref("login.html"));
  });
}

async function toggleThemeFromEngine() {
  const rawTheme = (() => {
    try {
      const raw = localStorage.getItem("evaraos-appearance");
      return raw ? JSON.parse(raw)?.mode : null;
    } catch {
      return null;
    }
  })();
  const current = rawTheme || (getAppearanceTheme() === "dark" ? "dark" : "light");
  const next = current === "light" ? "dark" : current === "dark" ? "system" : "light";

  try {
    const raw = localStorage.getItem("evaraos-appearance");
    const appearance = raw ? JSON.parse(raw) : {};
    appearance.mode = next;
    appearance.updatedAt = new Date().toISOString();
    delete appearance.baseFamily;
    delete appearance.accent;
    localStorage.setItem("evaraos-appearance", JSON.stringify(appearance));
  } catch {}

  const resolved = next === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light")
    : next;
  setTheme(resolved);
  syncThemeLabel();
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { mode: next } }));
}

export function bindThemeToggle() {
  Array.from(document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle")).forEach((toggle) => {
    bindOnce(toggle, "click", async (event) => {
      stopEvent(event);
      await toggleThemeFromEngine();
    });
  });
}

function currentRole() {
  const nav = document.getElementById("evaLinks");
  return nav?.dataset?.navRole || localStorage.getItem("evaraos-role") || "customer";
}

function scoreSearchItem(app, query = "") {
  const value = String(query || "").toLowerCase();
  const title = String(app.title || "").toLowerCase();
  const id = String(app.id || "").toLowerCase();
  const category = String(app.category || "").toLowerCase();
  const route = String(app.route || "").toLowerCase();

  if (!value) return 1;
  if (title === value) return 100;
  if (title.startsWith(value)) return 80;
  if (title.includes(value)) return 60;
  if (id.includes(value)) return 45;
  if (route.includes(value)) return 35;
  if (category.includes(value)) return 25;
  return 0;
}

function renderSearchResults(root, items = [], query = "") {
  if (!root) return;

  if (!query.trim()) {
    root.innerHTML = '<div class="eva-search-empty">Ask Evaraos AI to open apps, find tools, or route your next action.</div>';
    root.classList.remove("active");
    return;
  }

  if (!items.length) {
    root.innerHTML = '<div class="eva-search-empty">Tap Send to ask Evaraos AI.</div>';
    root.classList.add("active");
    return;
  }

  root.innerHTML = items.map((app) => {
    return '<button type="button" class="eva-search-result" data-search-link="' + clean(app.route) + '"><strong>' + clean(app.title) + '</strong><span>' + clean(label(app.category || 'App')) + ' • ' + clean(app.route) + '</span></button>';
  }).join("");
  root.classList.add("active");
}

function renderAiMessage(root, message = "", mode = "ai") {
  if (!root) return;
  root.innerHTML = '<div class="eva-search-empty eva-ai-message" data-ai-mode="' + clean(mode) + '">' + clean(message || "Evaraos AI is ready.") + '</div>';
  root.classList.add("active");
}

async function askAiCommand(prompt, resultsRoot) {
  const ask = httpsCallable(functions, "aiCommand");
  renderAiMessage(resultsRoot, "Thinking through your Evaraos command...", "loading");

  const response = await ask({
    prompt,
    context: {
      path: window.location.pathname,
      role: currentRole(),
      theme: getAppearanceTheme()
    }
  });

  const data = response?.data || {};

  if (data?.action?.type === "navigate" && data.action.route) {
    renderAiMessage(resultsRoot, data.message || `Opening ${data.action.title || "page"}.`, data.mode || "action");
    openNavHref(data.action.route, {
      title: data.action.title ? `Opening ${data.action.title}` : "Opening Evaraos",
      subtitle: data.message || "Launching from Evaraos AI."
    });
    return;
  }

  renderAiMessage(resultsRoot, data.message || "Evaraos AI received your command.", data.mode || "ai");
}

async function runAiPrompt(input, resultsRoot) {
  const prompt = input?.value?.trim() || "";
  if (!prompt) {
    renderAiMessage(resultsRoot, "Type or speak a command first.", "error");
    input?.focus?.();
    return;
  }

  const href = resultsRoot?.querySelector("[data-search-link]")?.getAttribute("data-search-link");
  if (href) {
    openNavHref(href, { title: "Opening result", subtitle: "Launching your selected Evaraos app." });
    return;
  }

  try {
    await askAiCommand(prompt, resultsRoot);
  } catch (error) {
    console.warn("Evaraos AI command failed:", error);
    renderAiMessage(resultsRoot, "Evaraos AI could not connect yet. Check Functions/App Check logs if this continues.", "error");
  }
}

function bindSpeech(input, resultsRoot) {
  const mic = document.getElementById("evaAiMicBtn");
  if (!mic || mic.dataset.micBound === "true") return;
  mic.dataset.micBound = "true";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    mic.setAttribute("aria-disabled", "true");
    mic.title = "Speech input is not supported in this browser.";
    return;
  }

  mic.addEventListener("click", (event) => {
    stopEvent(event);
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    mic.dataset.listening = "true";
    renderAiMessage(resultsRoot, "Listening...", "loading");

    recognition.onresult = (speechEvent) => {
      const transcript = speechEvent.results?.[0]?.[0]?.transcript || "";
      input.value = transcript;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      mic.dataset.listening = "false";
    };

    recognition.onerror = () => {
      mic.dataset.listening = "false";
      renderAiMessage(resultsRoot, "Speech input was not available. Type your command instead.", "error");
    };

    recognition.onend = () => {
      mic.dataset.listening = "false";
    };

    recognition.start();
  });
}

export function bindSearch() {
  const input = document.getElementById("evaSearchInput");
  const resultsRoot = document.getElementById("evaSearchResults");
  const form = document.getElementById("evaAiPromptForm");
  const sendBtn = document.getElementById("evaAiSendBtn");
  if (!input || input.dataset.searchBound === "true") return;
  input.dataset.searchBound = "true";

  function applySearch() {
    const value = input.value.trim().toLowerCase();
    const apps = searchApps(value, currentRole());
    const scored = apps
      .map((app) => ({ ...app, score: scoreSearchItem(app, value) }))
      .filter((app) => !value || app.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    renderSearchResults(resultsRoot, scored.slice(0, 8), input.value);
  }

  input.addEventListener("input", applySearch);
  input.addEventListener("focus", applySearch);
  input.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    stopEvent(event);
    await runAiPrompt(input, resultsRoot);
  });

  form?.addEventListener("submit", async (event) => {
    stopEvent(event);
    await runAiPrompt(input, resultsRoot);
  });

  sendBtn?.addEventListener("click", async (event) => {
    stopEvent(event);
    await runAiPrompt(input, resultsRoot);
  });

  bindSpeech(input, resultsRoot);

  resultsRoot?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-link]");
    if (!button) return;
    stopEvent(event);
    openNavHref(button.getAttribute("data-search-link"), {
      title: "Opening result",
      subtitle: "Launching your selected Evaraos app."
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".eva-menu-search")) return;
    resultsRoot?.classList.remove("active");
  });
}

function bindMenuCloseButton() {
  const closeBtn = document.getElementById("evaMenuCloseBtn");
  bindOnce(closeBtn, "click", (event) => {
    stopEvent(event);
    closeMenu(true);
  });
}

export function bindAllNavEvents() {
  bindBrandHome();
  bindLinks();
  bindThemeToggle();
  bindSearch();
  bindMenuCloseButton();
  syncThemeLabel();
}
