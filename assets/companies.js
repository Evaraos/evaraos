import {
  bindTopbar,
  requireAuth,
  fetchAllCollection,
  renderSidebar,
  roleGuard,
  createCompany,
  updateCompany
} from "./app.js";

let currentUser = null;
let editingCompanyId = null;

function formatDate(value) {
  if (!value) return "—";
  try {
    if (value.toDate) return value.toDate().toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function getCompanyFormData() {
  return {
    name: document.getElementById("companyName").value.trim(),
    slug: document.getElementById("companySlug").value.trim().toLowerCase(),
    city: document.getElementById("companyCity").value.trim(),
    state: document.getElementById("companyState").value,
    phone: document.getElementById("companyPhone").value.trim(),
    email: document.getElementById("companyEmail").value.trim(),
    status: document.getElementById("companyStatus").value,
    notes: document.getElementById("companyNotes").value.trim()
  };
}

function fillCompanyForm(company) {
  document.getElementById("companyName").value = company.name || "";
  document.getElementById("companySlug").value = company.slug || "";
  document.getElementById("companyCity").value = company.city || "";
  document.getElementById("companyState").value = company.state || "";
  document.getElementById("companyPhone").value = company.phone || "";
  document.getElementById("companyEmail").value = company.email || "";
  document.getElementById("companyStatus").value = company.status || "active";
  document.getElementById("companyNotes").value = company.notes || "";
}

function clearCompanyForm() {
  editingCompanyId = null;
  document.getElementById("companyName").value = "";
  document.getElementById("companySlug").value = "";
  document.getElementById("companyCity").value = "";
  document.getElementById("companyState").value = "";
  document.getElementById("companyPhone").value = "";
  document.getElementById("companyEmail").value = "";
  document.getElementById("companyStatus").value = "active";
  document.getElementById("companyNotes").value = "";
  document.getElementById("cancelCompanyEditBtn").style.display = "none";
  document.getElementById("companyMsg").textContent = "";
}

function sortCompanies(companies) {
  return [...companies].sort((a, b) => {
    if ((a.slug || "") === "supreme-trueclean") return -1;
    if ((b.slug || "") === "supreme-trueclean") return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
}

async function renderCompanies() {
  const companies = sortCompanies(await fetchAllCollection("companies"));
  const companiesList = document.getElementById("companiesList");

  if (!companies.length) {
    companiesList.innerHTML = `<div class="muted">No companies yet.</div>`;
    return;
  }

  companiesList.innerHTML = companies.map((company) => `
    <div class="row">
      <div>
        <strong>${company.name || "Unnamed Company"}</strong><br>
        <span class="muted">${company.slug || "No slug"}</span>
      </div>
      <div>
        ${company.city || "No city"}<br>
        <span class="muted">${company.state || "No state"}</span>
      </div>
      <div>
        ${company.phone || "No phone"}<br>
        <span class="muted">${company.email || "No email"}</span>
      </div>
      <div>
        <button class="btn secondary edit-company-btn" data-id="${company.id}">Edit</button>
        <div class="meta-line">
          Status: ${company.status || "active"}<br>
          Updated: ${formatDate(company.updatedAt)}
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-company-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedCompany = companies.find((company) => company.id === btn.dataset.id);
      if (!selectedCompany) return;

      editingCompanyId = selectedCompany.id;
      fillCompanyForm(selectedCompany);
      document.getElementById("cancelCompanyEditBtn").style.display = "inline-flex";
      document.getElementById("companyMsg").textContent = `Editing ${selectedCompany.name || "company"}`;
      openModal("companyModal");
    });
  });
}

requireAuth(async (user) => {
  currentUser = user;

  if (!roleGuard(user, "companies")) {
    document.body.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <h2>Access denied</h2>
          <p class="muted">Only the owner can manage companies.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "companies");

  await renderCompanies();

  document.getElementById("openCompanyModalBtn").addEventListener("click", () => {
    clearCompanyForm();
    openModal("companyModal");
  });

  document.getElementById("closeCompanyModalBtn").addEventListener("click", () => closeModal("companyModal"));
  document.getElementById("cancelCompanyEditBtn").addEventListener("click", () => {
    clearCompanyForm();
    closeModal("companyModal");
  });

  document.getElementById("saveCompanyBtn").addEventListener("click", async () => {
    const msg = document.getElementById("companyMsg");
    const data = getCompanyFormData();

    if (!data.name || !data.slug) {
      msg.textContent = "Company name and slug are required.";
      return;
    }

    try {
      const existingCompanies = await fetchAllCollection("companies");
      const duplicateSlug = existingCompanies.find(
        (company) => company.slug === data.slug && company.id !== editingCompanyId
      );

      if (duplicateSlug) {
        msg.textContent = "That company slug already exists. Edit the existing company instead.";
        return;
      }

      if (editingCompanyId) {
        await updateCompany(editingCompanyId, data);
        msg.textContent = "Company updated successfully.";
      } else {
        await createCompany(data, currentUser);
        msg.textContent = "Company created successfully.";
      }

      await renderCompanies();
      clearCompanyForm();
      closeModal("companyModal");
    } catch (e) {
      msg.textContent = e.message || "Failed to save company.";
    }
  });
});