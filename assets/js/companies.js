import {
  bindTopbar,
  requireAuth,
  fetchAllCollection,
  fetchCompanyCollection,
  createCompany,
  updateCompany
} from "./app.js";

import { canAccess } from "./roles.js";

const companyState = {
  user: null,
  companies: [],
  editingId: null
};

function showToast(message, variant = "success") {
  let container = document.getElementById("companiesToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "companiesToastContainer";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.padding = "14px 16px";
  toast.style.borderRadius = "16px";
  toast.style.background = variant === "error" ? "rgba(180,40,40,.94)" : "rgba(25,110,55,.94)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

function injectStyles() {
  if (document.getElementById("companiesUpgradeStyles")) return;

  const style = document.createElement("style");
  style.id = "companiesUpgradeStyles";
  style.textContent = `
    .page-main{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .card-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;
    }
    .company-card{
      border-radius:24px;
      padding:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .company-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:8px;
    }
    .muted{
      color:#aeb8c8;
      font-size:13px;
    }
    .modal-backdrop{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      backdrop-filter:blur(8px);
      display:none;
      align-items:center;
      justify-content:center;
      z-index:9998;
      padding:18px;
    }
    .modal-backdrop.open{
      display:flex;
    }
    .modal-card{
      width:min(760px,100%);
      max-height:90vh;
      overflow:auto;
      border-radius:28px;
      background:rgba(14,16,24,.96);
      border:1px solid rgba(255,255,255,.08);
      padding:22px;
      box-shadow:0 25px 60px rgba(0,0,0,.35);
    }
    .form-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
      margin-top:16px;
    }
    .full{
      grid-column:1/-1;
    }
    .field{
      display:flex;
      flex-direction:column;
      gap:8px;
    }
    .field label{
      font-size:13px;
      color:#b4bfd0;
    }
    .field input,
    .field select,
    .field textarea{
      width:100%;
      padding:14px 16px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      color:#fff;
      outline:none;
    }
    .top-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }
    .empty-state{
      color:#aeb8c8;
      padding:12px 0 4px;
    }
    .chip{
      display:inline-flex;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      margin:6px 8px 0 0;
      text-transform:capitalize;
    }
    @media (max-width: 700px){
      .card-grid{ grid-template-columns:1fr; }
      .form-grid{ grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(style);
}

async function loadCompanies(user) {
  companyState.user = user;

  if (user.role === "super_admin") {
    companyState.companies = await fetchAllCollection("companies");
  } else {
    companyState.companies = await fetchCompanyCollection("companies", user.companyId).catch(() => []);
    if (!companyState.companies.length) {
      const all = await fetchAllCollection("companies");
      companyState.companies = all.filter((item) => item.id === user.companyId || item.companyId === user.companyId);
    }
  }
}

function openCompanyModal(company = null) {
  companyState.editingId = company?.id || null;
  document.getElementById("companyModal").classList.add("open");
  document.getElementById("companyModalTitle").textContent = company ? "Edit Company" : "Add Company";

  document.getElementById("companyName").value = company?.name || "";
  document.getElementById("companySlug").value = company?.slug || "";
  document.getElementById("companyCity").value = company?.city || "";
  document.getElementById("companyStateField").value = company?.state || "";
  document.getElementById("companyPhone").value = company?.phone || "";
  document.getElementById("companyEmail").value = company?.email || "";
  document.getElementById("companyStatus").value = company?.status || "active";
  document.getElementById("companyBrandColor").value = company?.brandColor || "#E30613";
  document.getElementById("companyOwnerName").value = company?.ownerName || "";
  document.getElementById("companyOwnerEmail").value = company?.ownerEmail || "";
  document.getElementById("companyNotes").value = company?.notes || "";
}

function closeCompanyModal() {
  document.getElementById("companyModal").classList.remove("open");
  companyState.editingId = null;
}

function renderPage() {
  const root = document.getElementById("companiesRoot");
  root.innerHTML = `
    <main class="page-main">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">Companies</h1>
            <p class="muted" style="margin:10px 0 0;">Create, edit, and manage company records.</p>
          </div>
          <div class="top-actions">
            <button class="btn" id="openCompanyModalBtn">Add Company</button>
          </div>
        </div>
      </section>

      <section class="glass-card">
        <div class="section-title-row">
          <h2>Companies List</h2>
          <div class="muted">${companyState.companies.length} company record(s)</div>
        </div>

        ${
          !companyState.companies.length
            ? `<div class="empty-state">No companies found.</div>`
            : `
              <div class="card-grid" style="margin-top:14px;">
                ${companyState.companies
                  .map(
                    (company) => `
                      <div class="company-card">
                        <div>
                          <strong>${company.name || company.id || "Unnamed Company"}</strong>
                          <div class="muted" style="margin-top:6px;">${company.city || "—"} ${company.state || ""}</div>
                        </div>

                        <div>
                          <span class="chip">${company.status || "active"}</span>
                          <span class="chip">${company.slug || company.id || "no-slug"}</span>
                        </div>

                        <div class="muted">
                          Owner: ${company.ownerName || "—"}<br>
                          Email: ${company.ownerEmail || company.email || "—"}<br>
                          Phone: ${company.phone || "—"}
                        </div>

                        <div class="company-actions">
                          <button class="btn secondary edit-company-btn" data-id="${company.id}">Edit</button>
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
        }
      </section>
    </main>
  `;

  document.getElementById("openCompanyModalBtn")?.addEventListener("click", () => openCompanyModal());

  document.querySelectorAll(".edit-company-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const company = companyState.companies.find((item) => item.id === btn.dataset.id);
      openCompanyModal(company);
    });
  });
}

async function saveCompany(e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById("companyName").value.trim(),
    slug: document.getElementById("companySlug").value.trim(),
    city: document.getElementById("companyCity").value.trim(),
    state: document.getElementById("companyStateField").value.trim(),
    phone: document.getElementById("companyPhone").value.trim(),
    email: document.getElementById("companyEmail").value.trim(),
    status: document.getElementById("companyStatus").value,
    brandColor: document.getElementById("companyBrandColor").value.trim(),
    ownerName: document.getElementById("companyOwnerName").value.trim(),
    ownerEmail: document.getElementById("companyOwnerEmail").value.trim(),
    notes: document.getElementById("companyNotes").value.trim()
  };

  if (!payload.name) {
    showToast("Company name is required.", "error");
    return;
  }

  if (companyState.editingId) {
    await updateCompany(companyState.editingId, payload);
    showToast("Company updated.");
  } else {
    await createCompany(
      {
        ...payload,
        companyId: payload.slug || payload.name
      },
      companyState.user
    );
    showToast("Company created.");
  }

  closeCompanyModal();
  await loadCompanies(companyState.user);
  renderPage();
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  if (!canAccess(user.role, "companies")) {
    document.getElementById("companiesRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Access denied for companies.</section>`;
    return;
  }

  const topSidebar = document.getElementById("sidebar");
  if (topSidebar) {
    topSidebar.innerHTML = "";
  }

  const root = document.getElementById("companiesRoot");
  root.innerHTML = `<section class="glass-card" style="margin:22px;">Loading companies...</section>`;

  try {
    await loadCompanies(user);
    renderPage();
  } catch (e) {
    root.innerHTML = `<section class="glass-card" style="margin:22px;">Companies page failed: ${e.message || e}</section>`;
  }

  document.getElementById("companyModalCloseBtn")?.addEventListener("click", closeCompanyModal);
  document.getElementById("companyModalCancelBtn")?.addEventListener("click", closeCompanyModal);
  document.getElementById("companyForm")?.addEventListener("submit", saveCompany);
});
