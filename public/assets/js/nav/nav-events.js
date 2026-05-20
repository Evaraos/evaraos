import { buildHref, getAppearanceTheme, setTheme, syncThemeLabel, getBrandBlock } from "./nav-utils.js";
import { closeMenu, openMenu, toggleMenu } from "./nav-menu.js";
import { navigateWithLoader } from "./nav-navigation.js";
import { logoutAndRedirect, functions, httpsCallable } from "../firebase.js";
import { searchApps } from "../navigation/app-registry.js";

const BOUND = "data-evara-clean-bound";

const GROUP_FALLBACK_ROUTES = Object.freeze({
  operations: "/jobs.html",
  organizations: "/companies.html",
  finance: "/revenue.html",
  customer: "/customer_dashboard.html",
  intelligence: "/dashboard.html",
  system: "/settings.html"
});

const COMMAND_ALIASES = Object.freeze({
  home: "/index.html",
  dashboard: "/dashboard.html",
  command: "/dashboard.html",
  executive: "/dashboard.html",
  map: "/operations_map.html",
  operations: "/jobs.html",
  jobs: "/jobs.html",
  job: "/jobs.html",
  leads: "/leads.html",
  lead: "/leads.html",
  companies: "/companies.html",
  company: "/companies.html",
  organizations: "/companies.html",
  organization: "/org.html",
  users: "/users.html",
  people: "/users.html",
  applications: "/applications.html",
  applicants: "/applications.html",
  settings: "/settings.html",
  profile: "/settings.html",
  system: "/settings.html",
  alerts: "/notifications.html",
  notifications: "/notifications.html",
  customer: "/customer_dashboard.html",
  customers: "/customer_dashboard.html",
  apply: "/staff_application.html",
  login: "/login.html",
  signup: "/signup.html"
});

function stop(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

function once(node, eventName, handler) {
  if (!node) return;
  const key = `${BOUND}-${eventName}`;
  if (node.getAttribute(key) === "true") return;
  node.setAttribute(key, "true");
  node.addEventListener(eventName, handler, { passive: false });
}

function syncThemeButtonVisual(theme = getAppearanceTheme()) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle, [data-theme-label]").forEach((button) => {
    button.setAttribute("data-theme-mode", safeTheme);
    button.setAttribute("aria-label", safeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    const icon = button.querySelector(".eva-theme-nav-icon");
    if (icon) icon.textContent = safeTheme === "dark" ? "☾" : "☀";
  });
}

function esc(value = "") {
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

function normalizeCommand(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(open|go to|show|take me to|launch|view)\s+/, "")
    .replace(/\s+/g, " ");
}

function role() {
  return document.getElementById("evaLinks")?.dataset?.navRole || localStorage.getItem("evaraos-role") || "customer";
}

function normalizeHref(href = "") {
  const value = String(href || "").trim();
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("/")) return value;
  return buildHref(value);
}

function openHref(href, title = "Loading page", subtitle = "Preparing your next screen.") {
  const route = normalizeHref(href);
  if (!route) return;
  closeMenu(false);
  navigateWithLoader(route, { title, subtitle, theme: getAppearanceTheme() });
}

function score(app, query = "") {
  const q = normalizeCommand(query);
  const title = String(app.title || "").toLowerCase();
  const id = String(app.id || "").toLowerCase();
  const category = String(app.category || "").toLowerCase();
  const route = String(app.route || "").toLowerCase();
  if (!q) return 1;
  if (title === q) return 100;
  if (id === q) return 95;
  if (COMMAND_ALIASES[q] && COMMAND_ALIASES[q] === app.route) return 92;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 65;
  if (id.includes(q)) return 45;
  if (route.includes(q.replaceAll(" ", "_"))) return 38;
  if (route.includes(q.replaceAll(" ", "-"))) return 36;
  if (category.includes(q)) return 25;
  return 0;
}

function bestLocalCommand(prompt = "") {
  const query = normalizeCommand(prompt);
  if (!query) return null;

  const aliasRoute = COMMAND_ALIASES[query];
  if (aliasRoute) return { title: label(query), route: aliasRoute };

  const items = searchApps(query, role())
    .map((app) => ({ ...app, score: score(app, query) }))
    .filter((app) => app.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return items[0] || null;
}

function renderResults(root, items = [], query = "") {
  if (!root) return;
  const normalized = normalizeCommand(query);
  if (!normalized) {
    root.classList.remove("active");
    root.innerHTML = "";
    return;
  }
  if (!items.length) {
    root.classList.add("active");
    root.innerHTML = '<div class="eva-search-empty">Press Enter to ask Evaraos AI.</div>';
    return;
  }
  root.classList.add("active");
  root.innerHTML = items.map((app) => (
    '<button type="button" class="eva-search-result" data-search-link="' + esc(app.route) + '">' +
    '<strong>' + esc(app.title) + '</strong>' +
    '<span>' + esc(label(app.category || "App")) + ' • ' + esc(app.route) + '</span>' +
    '</button>'
  )).join("");
}

function renderMessage(root, message = "", mode = "ai") {
  if (!root) return;
  root.classList.add("active");
  root.innerHTML = '<div class="eva-ai-message" data-ai-mode="' + esc(mode) + '">' + esc(message || "Evaraos AI is ready.") + '</div>';
}

async function askBackend(prompt, resultsRoot) {
  renderMessage(resultsRoot, "Thinking through your Evaraos command...", "loading");
  const ask = httpsCallable(functions, "aiCommand");
  const response = await ask({ prompt, context: { path: window.location.pathname, role: role(), theme: getAppearanceTheme() } });
  const data = response?.data || {};
  if (data?.action?.type === "navigate" && data.action.route) {
    renderMessage(resultsRoot, data.message || `Opening ${data.action.title || "page"}.`, "action");
    openHref(data.action.route, data.action.title ? `Opening ${data.action.title}` : "Opening Evaraos", data.message || "Launching from Evaraos AI.");
    return;
  }
  renderMessage(resultsRoot, data.message || "Evaraos AI received your command.", data.mode || "ai");
}

async function runPrompt(input, resultsRoot) {
  const prompt = input?.value?.trim() || "";
  if (!prompt) {
    renderMessage(resultsRoot, "Type or speak a command first.", "error");
    input?.focus?.();
    return;
  }

  const directHref = resultsRoot?.querySelector("[data-search-link]")?.getAttribute("data-search-link");
  if (directHref) {
    openHref(directHref, "Opening result", "Launching your selected Evaraos app.");
    return;
  }

  const local = bestLocalCommand(prompt);
  if (local?.route) {
    renderMessage(resultsRoot, `Opening ${local.title || "Evaraos"}.`, "action");
    openHref(local.route, `Opening ${local.title || "Evaraos"}`, "Launching from Evaraos command.");
    return;
  }

  try {
    await askBackend(prompt, resultsRoot);
  } catch (error) {
    console.warn("Evaraos AI command failed:", error);
    renderMessage(resultsRoot, "Evaraos AI could not connect. Local app search still works.", "error");
  }
}

function parseGroupApps(button) {
  try {
    const apps = JSON.parse(button.getAttribute("data-group-apps") || "[]");
    return Array.isArray(apps) ? apps.filter((app) => app && app.route) : [];
  } catch {
    return [];
  }
}

function preferredGroupApp(button) {
  const category = String(button.getAttribute("data-nav-group") || "").trim();
  const apps = parseGroupApps(button);
  const fallback = GROUP_FALLBACK_ROUTES[category] || "";

  return (
    apps.find((app) => app.route === fallback) ||
    apps.find((app) => String(app.id || "").includes(category)) ||
    apps[0] ||
    (fallback ? { title: label(category || "Evaraos"), route: fallback } : null)
  );
}

function makeNavRowsAccessible() {
  document.querySelectorAll("[data-nav-group]").forEach((button) => {
    const app = preferredGroupApp(button);
    if (!app?.route) return;
    button.dataset.groupHref = app.route;
    button.setAttribute("role", "link");
    button.setAttribute("aria-label", `Open ${app.title || label(button.dataset.navGroup || "section")}`);
  });
}

function focusCommandInput() {
  const input = document.getElementById("evaSearchInput");
  if (!input) return;
  openMenu?.();
  window.setTimeout(() => {
    input.focus({ preventScroll: true });
    input.select?.();
  }, 80);
}

export function bindBrandHome() {
  const brand = getBrandBlock();
  once(brand, "click", (event) => {
    stop(event);
    openHref(brand?.getAttribute("data-home-link") || buildHref("index.html"), "Opening Home", "Loading Evaraos home.");
  });
}

export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    once(link, "click", (event) => {
      stop(event);
      openHref(link.getAttribute("data-menu-link") || link.getAttribute("href"), "Opening page", "Loading your selected Evaraos screen.");
    });
  });

  makeNavRowsAccessible();

  document.querySelectorAll("[data-nav-group]").forEach((button) => {
    const openGroup = (event) => {
      stop(event);
      const app = preferredGroupApp(button);
      if (app?.route) {
        openHref(app.route, `Opening ${app.title || label(button.dataset.navGroup || "section")}`, "Launching this Evaraos operating-system area.");
      }
    };

    once(button, "click", openGroup);
    once(button, "pointerup", (event) => {
      if (event.pointerType === "mouse") return;
      openGroup(event);
    });
    once(button, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      openGroup(event);
    });
  });

  const logoutBtn = document.getElementById("evaLogoutBtn");
  once(logoutBtn, "click", async (event) => {
    stop(event);
    closeMenu(false);
    await logoutAndRedirect(buildHref("login.html"));
  });
}

async function toggleTheme() {
  const current = getAppearanceTheme();
  const next = current === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("evaraos-theme", next);
    const raw = localStorage.getItem("evaraos-appearance");
    const appearance = raw ? JSON.parse(raw) : {};
    appearance.mode = next;
    appearance.baseFamily = next;
    appearance.updatedAt = new Date().toISOString();
    localStorage.setItem("evaraos-appearance", JSON.stringify(appearance));
  } catch {}

  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  document.documentElement.classList.toggle("dark", next === "dark");
  if (document.body) {
    document.body.dataset.theme = next;
    document.body.classList.toggle("dark", next === "dark");
  }

  setTheme(next);
  syncThemeLabel();
  syncThemeButtonVisual(next);
  window.EvaraLoader?.syncTheme?.(next);
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { mode: next, theme: next, baseFamily: next } }));
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme: next } }));
}

export function bindThemeToggle() {
  once(document.getElementById("evaThemeToggle"), "click", async (event) => {
    stop(event);
    await toggleTheme();
  });
  syncThemeButtonVisual();
  window.addEventListener("evara:theme-applied", (event) => syncThemeButtonVisual(event.detail?.theme));
  window.addEventListener("evara:appearance-updated", (event) => syncThemeButtonVisual(event.detail?.mode || event.detail?.theme));
}

export function bindSearch() {
  const input = document.getElementById("evaSearchInput");
  const form = document.getElementById("evaAiPromptForm");
  const results = document.getElementById("evaSearchResults");
  const mic = document.getElementById("evaAiMicBtn");
  if (!input) return;
  once(input, "input", () => {
    const query = input.value.trim();
    const items = searchApps(normalizeCommand(query), role()).map((app) => ({ ...app, score: score(app, query) })).filter((app) => !query || app.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8);
    renderResults(results, items, query);
  });
  once(input, "keydown", async (event) => {
    if (event.key === "Escape") {
      stop(event);
      input.value = "";
      renderResults(results, [], "");
      closeMenu(true);
      return;
    }
    if (event.key !== "Enter") return;
    stop(event);
    await runPrompt(input, results);
  });
  once(form, "submit", async (event) => {
    stop(event);
    await runPrompt(input, results);
  });
  once(results, "click", (event) => {
    const target = event.target.closest("[data-search-link]");
    if (!target) return;
    stop(event);
    openHref(target.getAttribute("data-search-link"), "Opening result", "Launching your selected Evaraos app.");
  });
  once(mic, "click", (event) => {
    stop(event);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      renderMessage(results, "Speech input is not supported in this browser yet.", "error");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    mic.dataset.listening = "true";
    renderMessage(results, "Listening...", "loading");
    recognition.onresult = (speechEvent) => {
      input.value = speechEvent.results?.[0]?.[0]?.transcript || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    recognition.onerror = () => renderMessage(results, "Speech input failed. Type your command instead.", "error");
    recognition.onend = () => { mic.dataset.listening = "false"; };
    recognition.start();
  });
}

function bindKeyboardCommands() {
  once(document, "keydown", (event) => {
    const target = event.target;
    const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    const comboK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    const slash = event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey;
    const escape = event.key === "Escape";

    if (comboK || slash) {
      stop(event);
      focusCommandInput();
      return;
    }

    if (escape && document.body.classList.contains("nav-menu-open")) {
      stop(event);
      closeMenu(true);
    }
  });
}

function bindMenuBasics() {
  once(document.getElementById("evaMenuBtn"), "click", (event) => { stop(event); toggleMenu(); });
  once(document.getElementById("evaBackdrop"), "click", (event) => { stop(event); closeMenu(true); });
}

export function clearPressTimer() {}
export function endCompactPress() {}
export function togglePill() {}
export function startCompactPress() {}
export function bindTapToggle() {}

export function bindAllNavEvents() {
  bindMenuBasics();
  bindBrandHome();
  bindLinks();
  bindThemeToggle();
  bindSearch();
  bindKeyboardCommands();
  syncThemeLabel();
  syncThemeButtonVisual();
  makeNavRowsAccessible();
}
