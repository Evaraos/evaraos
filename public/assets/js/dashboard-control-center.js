import { getSavedUserProfile, normalizeRole } from "./firebase.js";

const ROLE_CONTROLS = {
  owner: [
    ["Companies", "/companies.html", "⌂"], ["Users", "/users.html", "◉"], ["Finance", "/enterprise-finance-dashboard.html", "◍"], ["Dispatch", "/dispatch.html", "⌁"], ["AI Command", "/ai_command.html", "✦"], ["Settings", "/settings.html", "⚙"]
  ],
  admin: [
    ["Users", "/users.html", "◉"], ["Leads", "/leads.html", "◎"], ["Jobs", "/jobs.html", "◇"], ["Dispatch", "/dispatch.html", "⌁"], ["Applications", "/applications.html", "◐"], ["Settings", "/settings.html", "⚙"]
  ],
  hr: [
    ["Users", "/users.html", "◉"], ["Applications", "/applications.html", "◐"], ["Onboarding", "/onboarding.html", "＋"], ["Payroll", "/payroll.html", "◍"], ["Messages", "/messages.html", "◌"], ["Settings", "/settings.html", "⚙"]
  ],
  staff: [
    ["My Jobs", "/jobs.html", "◇"], ["My Leads", "/leads.html", "◎"], ["Schedule", "/schedule.html", "◫"], ["Field", "/field.html", "⌁"], ["Messages", "/messages.html", "◌"], ["Settings", "/settings.html", "⚙"]
  ],
  customer: [
    ["My Services", "/customer_dashboard.html", "⌂"], ["Bills", "/customer_bills.html", "◍"], ["History", "/customer-service-history.html", "◫"], ["Messages", "/customer-messaging.html", "◌"], ["Notifications", "/notifications_center.html", "◎"], ["Settings", "/settings.html", "⚙"]
  ]
};

function roleBucket() {
  const profile = getSavedUserProfile() || {};
  const role = normalizeRole(profile.role || "customer");
  if (["owner", "super_admin"].includes(role)) return "owner";
  if (["admin", "manager", "operations_manager", "operations_coordinator"].includes(role)) return "admin";
  if (["hr", "hr_manager"].includes(role)) return "hr";
  if (["technician", "cleaner", "staff", "field_staff", "crew_lead", "sales", "sales_rep", "customer_support", "quality_control"].includes(role)) return "staff";
  return "customer";
}

function mountControlCenter() {
  if (document.getElementById("dashboardControlCenter")) return;
  const hero = document.getElementById("overviewSection");
  if (!hero) return;
  const role = roleBucket();
  const controls = ROLE_CONTROLS[role] || ROLE_CONTROLS.customer;
  const section = document.createElement("section");
  section.id = "dashboardControlCenter";
  section.className = "dashboard-control-center glass-card";
  section.innerHTML = `<div class="dashboard-section-head"><div><p class="dashboard-section-kicker">Control Center</p><h2>${role === "owner" ? "Executive Controls" : role === "admin" ? "Administration Controls" : role === "hr" ? "People Operations" : role === "staff" ? "My Work Center" : "Customer Center"}</h2></div><button id="dashboardEditToggle" type="button" class="btn btn-theme-secondary">Customize</button></div><div class="dashboard-control-grid">${controls.map(([label,href,icon])=>`<a class="dashboard-control-tile glass-card" href="${href}" data-control-id="${label.toLowerCase().replace(/\s+/g,"-")}"><span>${icon}</span><strong>${label}</strong><small>Open</small></a>`).join("")}</div>`;
  hero.insertAdjacentElement("afterend", section);
  bindCustomize(section, role);
}

function bindCustomize(section, role) {
  const key = `evaraos-dashboard-hidden-${role}`;
  const hidden = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  section.querySelectorAll("[data-control-id]").forEach((tile) => tile.hidden = hidden.has(tile.dataset.controlId));
  section.querySelector("#dashboardEditToggle")?.addEventListener("click", (event) => {
    const editing = section.classList.toggle("is-editing");
    event.currentTarget.textContent = editing ? "Done" : "Customize";
    section.querySelectorAll("[data-control-id]").forEach((tile) => {
      tile.hidden = false;
      tile.onclick = editing ? (click) => {
        click.preventDefault();
        tile.classList.toggle("is-disabled");
        if (tile.classList.contains("is-disabled")) hidden.add(tile.dataset.controlId); else hidden.delete(tile.dataset.controlId);
        localStorage.setItem(key, JSON.stringify([...hidden]));
      } : null;
      if (!editing) tile.hidden = hidden.has(tile.dataset.controlId);
    });
  });
}

function injectStyles() {
  if (document.getElementById("dashboardControlCenterStyles")) return;
  const style = document.createElement("style");
  style.id = "dashboardControlCenterStyles";
  style.textContent = `.dashboard-control-center{padding:20px;border-radius:30px;display:grid;gap:16px}.dashboard-control-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.dashboard-control-tile{min-height:128px;padding:16px;border-radius:24px;display:grid;align-content:space-between;text-decoration:none;color:var(--text-primary)}.dashboard-control-tile>span{font-size:1.6rem}.dashboard-control-tile strong{font-size:.94rem}.dashboard-control-tile small{color:var(--text-secondary)}.dashboard-control-center.is-editing .dashboard-control-tile{outline:1px dashed var(--accent-blue)}.dashboard-control-center.is-editing .dashboard-control-tile::after{content:"Tap to show/hide";font-size:.68rem;color:var(--text-secondary)}.dashboard-control-tile.is-disabled{opacity:.38}@media(max-width:980px){.dashboard-control-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.dashboard-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-control-tile{min-height:112px}}`;
  document.head.appendChild(style);
}

function init() { injectStyles(); mountControlCenter(); window.addEventListener("evara:session-ready", mountControlCenter); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
