import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  fetchAllCollection,
  createDocument,
  updateDocument
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

function sanitizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadCompanies(user) {
  companyState.user = user;
  companyState.companies = await fetchAllCollection("companies", {
    orderByField: "name",
    orderDirection: "asc",
    max: 500
  });
}

function openCompanyModal(company = null) {
  companyState.editingId = company?.id || null;
  document.getElementById("companyModal")?.classList.add("open");
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
  document.getElementById("companyModal")?.classList.remove("open");
  companyState.editingId = null;
}

function renderCompanies() {
  const root = document.getElementById("companiesRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">Company Records</h2>
          <p class="muted" style="margin:8px 0 0;">Create, edit, and manage company records.</p>
        </div>
        <div class="top-actions">
          <button class="btn" id="openCompanyModalBtn" type="button">Add Company</button>
        </div>
      </div>

      ${
        !companyState.companies.length
          ? `<div class="muted" style="padding-top:16px;">No companies found.</div>`
          : `
            <div class="quick-links-grid" style="margin-top:18px;">
              ${companyState.companies.map(company => `
                <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
                  <div>
                    <strong>${company.name || company.id || "Unnamed Company"}</strong>
                    <div class="muted" style="margin-top:8px;">
                      ${company.city || "—"} ${company.state || ""}<br>
                      Owner: ${company.ownerName || "—"}<br>
                      Email: ${company.ownerEmail || company.email || "—"}<br>
                      Phone: ${company.phone || "—"}
                    </div>
                  </div>

                  <div style="margin-top:12px;">
                    <span class="chip">${company.status || "active"}</span>
                    <span class="chip">${company.slug || company.id || "no-slug"}</span>
                  </div>

                  <div class="top-actions" style="margin-top:14px;">
                    <button class="btn btn-secondary edit-company-btn" data-id="${company.id}" type="button">Edit</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `
      }
    </section>
  `;

  document.getElementById("openCompanyModalBtn")?.addEventListener("click", () => openCompanyModal());

  document.querySelectorAll(".edit-company-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const company = companyState.companies.find(item => item.id === btn.dataset.id);
      openCompanyModal(company);
    });
  });
}

async function saveCompany(e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById("companyName").value.trim(),
    slug: sanitizeSlug(document.getElementById("companySlug").value || document.getElementById("companyName").value),
    city: document.getElementById("companyCity").value.trim(),
    state: document.getElementById("companyStateField").value.trim(),
    phone: document.getElementById("companyPhone").value.trim(),
    email: document.getElementById("companyEmail").value.trim().toLowerCase(),
    status: document.getElementById("companyStatus").value,
    brandColor: document.getElementById("companyBrandColor").value.trim(),
    ownerName: document.getElementById("companyOwnerName").value.trim(),
    ownerEmail: document.getElementById("companyOwnerEmail").value.trim().toLowerCase(),
    notes: document.getElementById("companyNotes").value.trim(),
    companyId: sanitizeSlug(document.getElementById("companySlug").value || document.getElementById("companyName").value)
  };

  if (!payload.name) {
    showToast("Company name is required.", "error");
    return;
  }

  try {
    if (companyState.editingId) {
      await updateDocument("companies", companyState.editingId, payload);
      showToast("Company updated.");
    } else {
      await createDocument("companies", payload);
      showToast("Company created.");
    }

    closeCompanyModal();
    await loadCompanies(companyState.user);
    renderCompanies();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save company.", "error");
  }
}

requireAuth(async (user) => {
  await bindTopbar(user, "Companies");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "companies");
  }

  if (!canAccess(user.role, "companies")) {
    document.getElementById("companiesRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  document.getElementById("companiesRoot").innerHTML =
    `<section class="glass-card aurora-card shine-border">Loading companies...</section>`;

  try {
    await loadCompanies(user);
    renderCompanies();
  } catch (error) {
    console.error(error);
    document.getElementById("companiesRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Companies page failed: ${error.message || error}</section>`;
  }

  document.getElementById("companyModalCloseBtn")?.addEventListener("click", closeCompanyModal);
  document.getElementById("companyModalCancelBtn")?.addEventListener("click", closeCompanyModal);
  document.getElementById("companyForm")?.addEventListener("submit", saveCompany);
});