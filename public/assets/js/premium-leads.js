import { db, collection, getDocs } from "./firebase.js";

const state = {
  companies: new Map(),
  users: new Map(),
  ready: false
};

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.slice(0, 2).map((part) => part[0]).join("") : "U").toUpperCase();
}

function displayName(user = {}) {
  return user.fullName || user.displayName || user.name || user.username || user.email || "Team Member";
}

function roleLabel(role = "") {
  const value = normalize(role).replaceAll("_", " ");
  if (!value) return "Staff";
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function companyName(company = {}) {
  return company.name || company.companyName || company.brand || company.title || "Evaraos Company";
}

function companyPrimary(company = {}) {
  return company.primaryColor || company.brandPrimary || company.colorPrimary || company.themePrimary || company.color || "#ff2f57";
}

function companySecondary(company = {}) {
  return company.secondaryColor || company.brandSecondary || company.colorSecondary || company.themeSecondary || "#141917";
}

function userCompany(user = {}) {
  const companyId = user.companyId || "";
  return state.companies.get(companyId) || null;
}

function companyForLeadCard(card) {
  const companyText = card?.querySelector(".lead-crud-meta span")?.textContent?.trim() || "";
  if (!companyText) return null;
  return Array.from(state.companies.values()).find((company) => normalize(companyName(company)) === normalize(companyText)) || null;
}

async function loadPremiumData() {
  try {
    const [companySnap, userSnap] = await Promise.all([
      getDocs(collection(db, "companies")),
      getDocs(collection(db, "users"))
    ]);

    companySnap.docs.forEach((item) => {
      state.companies.set(item.id, { id: item.id, ...item.data() });
    });

    userSnap.docs.forEach((item) => {
      const data = { id: item.id, ...item.data() };
      state.users.set(item.id, data);
      if (data.uid) state.users.set(data.uid, data);
    });

    state.ready = true;
  } catch (error) {
    console.warn("Premium lead data skipped:", error);
  }
}

function personCardHtml(user = {}, checked = false) {
  const company = userCompany(user);
  const primary = company ? companyPrimary(company) : "#ff2f57";
  const secondary = company ? companySecondary(company) : "#141917";
  const name = displayName(user);
  const role = roleLabel(user.role || "staff");
  const companyLabel = company ? companyName(company) : (user.companyName || "No company assigned");

  return `
    <span class="premium-person-avatar" style="--person-accent:${escapeHtml(primary)};--person-secondary:${escapeHtml(secondary)};">${escapeHtml(initials(name))}</span>
    <span class="premium-person-copy">
      <span class="premium-person-name">${escapeHtml(name)}</span>
      <span class="premium-person-meta">${escapeHtml(companyLabel)} • ${escapeHtml(role)}</span>
    </span>
    <input type="checkbox" name="assignedTo" value="${escapeHtml(user.id || user.uid || "")}" ${checked ? "checked" : ""}>
  `;
}

function enhanceAssignedTeamBox() {
  const box = document.getElementById("leadAssignedTeamBox");
  if (!box || box.dataset.premiumEnhanced === "true") return;

  const labels = Array.from(box.querySelectorAll("label.lead-crud-check"));
  if (!labels.length) return;

  labels.forEach((label) => {
    const input = label.querySelector("input[name='assignedTo']");
    if (!input) return;
    const user = state.users.get(input.value) || { id: input.value, name: label.textContent.trim(), role: "staff" };
    const checked = input.checked;
    label.classList.add("premium-person-card");
    label.style.setProperty("--person-accent", companyPrimary(userCompany(user) || {}));
    label.innerHTML = personCardHtml(user, checked);
  });

  box.dataset.premiumEnhanced = "true";
}

function companyPillHtml(company = null, label = "No company assigned") {
  const primary = company ? companyPrimary(company) : "#7d8790";
  const secondary = company ? companySecondary(company) : "#2b2f33";
  return `<span class="lead-company-color-pill" style="--company-primary:${escapeHtml(primary)};--company-secondary:${escapeHtml(secondary)};">${escapeHtml(label)}</span>`;
}

function enhanceLeadCards() {
  document.querySelectorAll(".lead-crud-item").forEach((card) => {
    if (card.dataset.premiumCard === "true") return;
    const meta = card.querySelector(".lead-crud-meta");
    const first = meta?.querySelector("span");
    if (!meta || !first) return;
    const label = first.textContent.trim();
    const company = companyForLeadCard(card);
    first.outerHTML = companyPillHtml(company, label);
    card.dataset.premiumCard = "true";
  });
}

function syncCompanySelectStyle() {
  const select = document.getElementById("leadCompanyInput");
  const card = document.querySelector(".lead-crud-card");
  if (!select || !card) return;
  const company = state.companies.get(select.value);
  card.style.setProperty("--company-primary", companyPrimary(company || {}));
  card.style.setProperty("--company-secondary", companySecondary(company || {}));
}

function observeEnhancements() {
  const run = () => {
    enhanceAssignedTeamBox();
    enhanceLeadCards();
    syncCompanySelectStyle();
  };

  run();
  document.addEventListener("change", (event) => {
    if (event.target?.id === "leadCompanyInput") syncCompanySelectStyle();
  });

  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
}

async function init() {
  await loadPremiumData();
  observeEnhancements();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

window.EvaraPremiumLeads = { enhanceAssignedTeamBox, enhanceLeadCards };
