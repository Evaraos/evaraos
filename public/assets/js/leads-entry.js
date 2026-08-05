import "./leads.js?v=3";
import "./lead-job-conversion.js?v=2";
import "./dashboard-live-map-card.js?v=2";

function mountTools() {
  if (document.getElementById("leadsUtilityBar")) return true;
  const section = document.getElementById("leadsListSection");
  const head = section?.querySelector(".dashboard-section-head");
  if (!head) return false;

  const bar = document.createElement("div");
  bar.id = "leadsUtilityBar";
  bar.className = "leads-utility-bar glass-card";
  bar.innerHTML = `
    <button type="button" class="btn btn-theme-secondary" data-lead-filter="">All</button>
    <button type="button" class="btn btn-theme-secondary" data-lead-filter="hot">Hot</button>
    <button type="button" class="btn btn-theme-secondary" data-lead-filter="new">New</button>
    <button type="button" class="btn btn-theme-secondary" data-lead-filter="qualified">Qualified</button>
    <button type="button" class="btn btn-theme-secondary" data-lead-filter="won">Won</button>
    <button type="button" class="btn btn-theme-secondary" id="leadsExportBtn">Export CSV</button>
    <button type="button" class="btn btn-theme-primary" id="leadsAddUtilityBtn">Add Lead</button>`;
  head.insertAdjacentElement("afterend", bar);

  bar.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-lead-filter]");
    if (filter) {
      const search = document.getElementById("leadsSearch");
      if (search) {
        search.value = filter.dataset.leadFilter || "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      bar.querySelectorAll("[data-lead-filter]").forEach((node) => node.classList.toggle("is-active", node === filter));
      return;
    }
    if (event.target.closest("#leadsAddUtilityBtn")) {
      document.getElementById("leadCreateBtn")?.click();
      return;
    }
    if (event.target.closest("#leadsExportBtn")) exportVisibleLeads();
  });
  return true;
}

function exportVisibleLeads() {
  const rows = [...document.querySelectorAll("#leadsList [data-lead-id]")].map((card) => {
    const name = card.querySelector("strong")?.textContent?.trim() || "";
    const meta = [...card.querySelectorAll(".lead-crud-meta span")].map((node) => node.textContent.trim());
    const pills = [...card.querySelectorAll(".dashboard-status-pill")].map((node) => node.textContent.trim());
    return [name, ...meta, ...pills];
  });
  const csv = [["Lead", "Company", "Email", "Phone", "Team", "Priority", "Status"], ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `evaraos-leads-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function injectStyles() {
  if (document.getElementById("leadsEntryStyles")) return;
  const style = document.createElement("style");
  style.id = "leadsEntryStyles";
  style.textContent = `.dashboard-sidebar-search{position:sticky;top:0;z-index:4}.dashboard-search-shell{min-height:58px;border-radius:22px;padding:0 14px;display:grid;grid-template-columns:24px 1fr;align-items:center;gap:10px}.dashboard-search-icon{width:20px;height:20px;fill:currentColor;color:var(--text-secondary)}.dashboard-search-input{min-height:54px;border:0!important;background:transparent!important;box-shadow:none!important}.leads-utility-bar{margin:0 0 16px;padding:10px;border-radius:22px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.leads-utility-bar .btn{min-height:40px;padding:0 13px}.leads-utility-bar .is-active{border-color:color-mix(in srgb,var(--accent-blue) 48%,var(--liquid-border));color:var(--text-primary)}#leadsAddUtilityBtn{margin-left:auto}@media(max-width:720px){#leadsAddUtilityBtn{margin-left:0;width:100%}.leads-utility-bar .btn{flex:1 1 auto}}`;
  document.head.appendChild(style);
}

function init() {
  injectStyles();
  if (mountTools()) return;
  const observer = new MutationObserver(() => { if (mountTools()) observer.disconnect(); });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 12000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
