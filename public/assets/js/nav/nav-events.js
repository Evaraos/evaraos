import { buildHref, getAppearanceTheme, setTheme, syncThemeLabel, getBrandBlock, getSystemTheme } from "./nav-utils.js";
import { closeMenu, openMenu, toggleMenu } from "./nav-menu.js";
import { navigateWithLoader } from "./nav-navigation.js";
import { logoutAndRedirect, functions, httpsCallable } from "../firebase.js";
import { searchApps, normalizeQuery } from "../navigation/app-registry.js";

const BOUND = "data-evara-clean-bound";
const APPEARANCE_KEY = "evaraos-appearance";

const GROUP_FALLBACK_ROUTES = Object.freeze({ operations: "/jobs.html", organizations: "/companies.html", finance: "/revenue.html", customer: "/customer_dashboard.html", intelligence: "/dashboard.html", system: "/settings.html" });

function stop(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }
function once(node, eventName, handler) { if (!node) return; const key = `${BOUND}-${eventName}`; if (node.getAttribute(key) === "true") return; node.setAttribute(key, "true"); node.addEventListener(eventName, handler, { passive: false }); }
function getStoredAppearance() { try { return JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}"); } catch { return {}; } }
function normalizeMode(mode = "system") { return ["system", "light", "dark", "custom"].includes(mode) ? mode : "system"; }
function getAppearanceMode() { return normalizeMode(getStoredAppearance().mode || "system"); }
function resolvedThemeFromMode(mode = getAppearanceMode()) { if (mode === "light") return "light"; if (mode === "dark") return "dark"; if (mode === "custom") return getAppearanceTheme(); return getSystemTheme(); }
function nextAppearanceMode(mode = getAppearanceMode()) { if (mode === "system") return "light"; if (mode === "light") return "dark"; return "system"; }

function applyThemeDom(theme, mode) {
  const resolved = theme === "dark" ? "dark" : "light";
  const safeMode = normalizeMode(mode);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-appearance-mode", safeMode);
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  if (document.body) {
    document.body.setAttribute("data-theme", resolved);
    document.body.setAttribute("data-appearance-mode", safeMode);
    document.body.classList.toggle("dark", resolved === "dark");
  }
  try { document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#000000" : "#f7f8fa"); } catch {}
}

function saveAppearanceMode(mode) {
  const safeMode = normalizeMode(mode);
  const previous = getStoredAppearance();
  const resolved = resolvedThemeFromMode(safeMode);
  const next = { ...previous, mode: safeMode, baseFamily: safeMode === "custom" ? previous.baseFamily || resolved : safeMode, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); localStorage.setItem("evaraos-theme", resolved); } catch {}
  applyThemeDom(resolved, safeMode);
  setTheme(resolved);
  window.EvaraLoader?.syncTheme?.(resolved);
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { ...next, mode: safeMode, theme: resolved, resolvedTheme: resolved } }));
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme: resolved, mode: safeMode } }));
  syncThemeLabel();
  syncThemeButtonVisual();
}

function syncThemeButtonVisual() {
  const mode = getAppearanceMode();
  const resolved = resolvedThemeFromMode(mode);
  const icon = mode === "system" ? "◐" : resolved === "dark" ? "☾" : "☀";
  const label = mode === "system" ? `System (${resolved})` : resolved === "dark" ? "Dark" : "Light";
  document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle, [data-theme-label]").forEach((button) => {
    button.setAttribute("data-theme-mode", resolved);
    button.setAttribute("data-appearance-mode", mode);
    button.setAttribute("aria-label", `Theme: ${label}. Tap to change.`);
    const iconNode = button.querySelector(".eva-theme-nav-icon");
    if (iconNode) iconNode.textContent = icon;
  });
}

function esc(value = "") { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function label(value = "") { return String(value || "").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function role() { return document.getElementById("evaLinks")?.dataset?.navRole || localStorage.getItem("evaraos-role") || "customer"; }
function normalizeHref(href = "") { const value = String(href || "").trim(); if (!value) return ""; if (value.startsWith("http") || value.startsWith("/")) return value; return buildHref(value); }
function openHref(href, title = "Loading page", subtitle = "Preparing your next screen.") { const route = normalizeHref(href); if (!route) return; closeMenu(false); navigateWithLoader(route, { title, subtitle, theme: getAppearanceTheme() }); }
function bestLocalCommand(prompt = "") { const query = normalizeQuery(prompt); if (!query) return null; return searchApps(query, role())[0] || null; }

function renderResults(root, items = [], query = "") {
  if (!root) return;
  const normalized = normalizeQuery(query);
  if (!normalized) { root.classList.remove("active"); root.innerHTML = ""; return; }
  if (!items.length) { root.classList.add("active"); root.innerHTML = '<div class="eva-search-empty">Press Enter to ask Evaraos AI.</div>'; return; }
  root.classList.add("active");
  root.innerHTML = items.map((app) => '<button type="button" class="eva-search-result" data-search-link="' + esc(app.route) + '"><strong>' + esc(app.title) + '</strong><span>' + esc(label(app.category || "App")) + ' • ' + esc(app.route) + '</span></button>').join("");
}
function renderMessage(root, message = "", mode = "ai") { if (!root) return; root.classList.add("active"); root.innerHTML = '<div class="eva-ai-message" data-ai-mode="' + esc(mode) + '">' + esc(message || "Evaraos AI is ready.") + '</div>'; }
async function askBackend(prompt, resultsRoot) { renderMessage(resultsRoot, "Thinking through your Evaraos command...", "loading"); const ask = httpsCallable(functions, "aiCommand"); const response = await ask({ prompt, context: { path: window.location.pathname, role: role(), theme: getAppearanceTheme() } }); const data = response?.data || {}; if (data?.action?.type === "navigate" && data.action.route) { renderMessage(resultsRoot, data.message || `Opening ${data.action.title || "page"}.`, "action"); openHref(data.action.route, data.action.title ? `Opening ${data.action.title}` : "Opening Evaraos", data.message || "Launching from Evaraos AI."); return; } renderMessage(resultsRoot, data.message || "Evaraos AI received your command.", data.mode || "ai"); }
async function runPrompt(input, resultsRoot) { const prompt = input?.value?.trim() || ""; if (!prompt) { renderMessage(resultsRoot, "Type or speak a command first.", "error"); input?.focus?.(); return; } const directHref = resultsRoot?.querySelector("[data-search-link]")?.getAttribute("data-search-link"); if (directHref) { openHref(directHref, "Opening result", "Launching your selected Evaraos app."); return; } const local = bestLocalCommand(prompt); if (local?.route) { renderMessage(resultsRoot, `Opening ${local.title || "Evaraos"}.`, "action"); openHref(local.route, `Opening ${local.title || "Evaraos"}`, "Launching from Evaraos command."); return; } try { await askBackend(prompt, resultsRoot); } catch (error) { console.warn("Evaraos AI command failed:", error); renderMessage(resultsRoot, "Evaraos AI could not connect. Local app search still works.", "error"); } }
function parseGroupApps(button) { try { const apps = JSON.parse(button.getAttribute("data-group-apps") || "[]"); return Array.isArray(apps) ? apps.filter((app) => app && app.route) : []; } catch { return []; } }
function preferredGroupApp(button) { const category = String(button.getAttribute("data-nav-group") || "").trim(); const apps = parseGroupApps(button); const fallback = GROUP_FALLBACK_ROUTES[category] || ""; return apps.find((app) => app.route === fallback) || apps.find((app) => String(app.id || "").includes(category)) || apps[0] || (fallback ? { title: label(category || "Evaraos"), route: fallback } : null); }
function makeNavRowsAccessible() { document.querySelectorAll("[data-nav-group]").forEach((button) => { const app = preferredGroupApp(button); if (!app?.route) return; button.dataset.groupHref = app.route; button.setAttribute("role", "link"); button.setAttribute("aria-label", `Open ${app.title || label(button.dataset.navGroup || "section")}`); }); }
function focusCommandInput() { const input = document.getElementById("evaSearchInput"); if (!input) return; openMenu?.(); window.setTimeout(() => { input.focus({ preventScroll: true }); input.select?.(); }, 80); }

export function bindBrandHome() { const brand = getBrandBlock(); once(brand, "click", (event) => { stop(event); openHref(brand?.getAttribute("data-home-link") || buildHref("index.html"), "Opening Home", "Loading Evaraos home."); }); }
export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => { once(link, "click", (event) => { stop(event); openHref(link.getAttribute("data-menu-link") || link.getAttribute("href"), "Opening page", "Loading your selected Evaraos screen."); }); });
  makeNavRowsAccessible();
  document.querySelectorAll("[data-nav-group]").forEach((button) => { const openGroup = (event) => { stop(event); const app = preferredGroupApp(button); if (app?.route) openHref(app.route, `Opening ${app.title || label(button.dataset.navGroup || "section")}`, "Launching this Evaraos operating-system area."); }; once(button, "click", openGroup); once(button, "pointerup", (event) => { if (event.pointerType === "mouse") return; openGroup(event); }); once(button, "keydown", (event) => { if (event.key !== "Enter" && event.key !== " ") return; openGroup(event); }); });
  const logoutBtn = document.getElementById("evaLogoutBtn"); once(logoutBtn, "click", async (event) => { stop(event); closeMenu(false); await logoutAndRedirect(buildHref("login.html")); });
}

function toggleTheme() { saveAppearanceMode(nextAppearanceMode()); }
export function bindThemeToggle() {
  const button = document.getElementById("evaThemeToggle");
  if (!button) return;
  const fresh = button.cloneNode(true);
  button.replaceWith(fresh);
  fresh.addEventListener("click", (event) => { stop(event); toggleTheme(); }, { passive: false });
  fresh.addEventListener("pointerup", (event) => { if (event.pointerType === "mouse") return; stop(event); toggleTheme(); }, { passive: false });
  syncThemeButtonVisual();
  if (!window.__evaraThemeVisualEventsBound) {
    window.__evaraThemeVisualEventsBound = true;
    window.addEventListener("evara:theme-applied", () => syncThemeButtonVisual());
    window.addEventListener("evara:appearance-updated", () => syncThemeButtonVisual());
    window.addEventListener("storage", (event) => { if ([APPEARANCE_KEY, "evaraos-theme"].includes(event.key)) syncThemeButtonVisual(); });
  }
}

export function bindSearch() { const input = document.getElementById("evaSearchInput"); const form = document.getElementById("evaAiPromptForm"); const results = document.getElementById("evaSearchResults"); if (!input) return; once(input, "input", () => { const query = input.value.trim(); const items = searchApps(query, role()).slice(0, 8); renderResults(results, items, query); }); once(input, "keydown", async (event) => { if (event.key === "Escape") { stop(event); input.value = ""; renderResults(results, [], ""); closeMenu(true); return; } if (event.key !== "Enter") return; stop(event); await runPrompt(input, results); }); once(form, "submit", async (event) => { stop(event); await runPrompt(input, results); }); once(results, "click", (event) => { const target = event.target.closest("[data-search-link]"); if (!target) return; stop(event); openHref(target.getAttribute("data-search-link"), "Opening result", "Launching your selected Evaraos app."); }); }
function bindKeyboardCommands() { once(document, "keydown", (event) => { const target = event.target; const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName); const comboK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"; const slash = event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey; const escape = event.key === "Escape"; if (comboK || slash) { stop(event); focusCommandInput(); return; } if (escape && document.body.classList.contains("nav-menu-open")) { stop(event); closeMenu(true); } }); }
function bindMenuBasics() { once(document.getElementById("evaMenuBtn"), "click", (event) => { stop(event); toggleMenu(); }); once(document.getElementById("evaBackdrop"), "click", (event) => { stop(event); closeMenu(true); }); }
export function clearPressTimer() {} export function endCompactPress() {} export function togglePill() {} export function startCompactPress() {} export function bindTapToggle() {}
export function bindAllNavEvents() { bindMenuBasics(); bindBrandHome(); bindLinks(); bindThemeToggle(); bindSearch(); bindKeyboardCommands(); syncThemeLabel(); syncThemeButtonVisual(); makeNavRowsAccessible(); }
