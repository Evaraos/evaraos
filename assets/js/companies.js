import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const companiesSearch = document.getElementById("companiesSearch");
const companiesList = document.getElementById("companiesList");
const companiesFeed = document.getElementById("companiesFeed");

const companiesHeroTitle = document.getElementById("companiesHeroTitle");
const companiesHeroText = document.getElementById("companiesHeroText");

const companiesStatTotal = document.getElementById("companiesStatTotal");
const companiesStatHealthy = document.getElementById("companiesStatHealthy");
const companiesStatReview = document.getElementById("companiesStatReview");
const companiesStatFiltered = document.getElementById("companiesStatFiltered");

const companiesRefreshBtnTop = document.getElementById("companiesRefreshBtnTop");
const companiesRefreshBtnSide = document.getElementById("companiesRefreshBtnSide");
const companiesSortBtn = document.getElementById("companiesSortBtn");

let companiesData = [];
let sortAsc = true;
let isLoadingCompanies = false;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let currentFirebaseUser = null;
let editingCompanyId = null;

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => {
    window.location.assign(url);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function companyName(company = {}) {
  return (
    company.name ||
    company.companyName ||
    company.title ||
    company.brand ||
    "Untitled Company"
  );
}

function companyStatus(company = {}) {
  return (
    company.status ||
    company.health ||
    company.state ||
    "active"
  );
}

function companyDescription(company = {}) {
  return (
    company.description ||
    company.summary ||
    company.notes ||
    "No company summary provided."
  );
}

function companyCategory(company = {}) {
  return company.category || company.industry || company.type || "General";
}

function companyLocation(company = {}) {
  const cityState = [company.city, company.state].filter(Boolean).join(", ");
  return company.location || company.market || cityState || "No location set";
}

function companyContact(company = {}) {
  return company.email || company.phone || company.website || "No contact set";
}

function companyPillClass(status = "") {
  const value = normalizeStatus(status);
  if (["active", "healthy", "live", "approved"].includes(value)) return "success";
  if (["review", "pending", "draft"].includes(value)) return "working";
  if (["inactive", "paused", "archived"].includes(value)) return "empty";
  return "warning";
}

function currentActor() {
  const profile = getSavedUserProfile() || {};
  return {
    uid: currentFirebaseUser?.uid || profile.uid || "",
    email: currentFirebaseUser?.email || profile.email || "",
    displayName:
      profile.displayName ||
      profile.fullName ||
      profile.name ||
      currentFirebaseUser?.displayName ||
      currentFirebaseUser?.email ||
      "Unknown User"
  };
}

function setButtonLoading(isLoading) {
  [companiesRefreshBtnTop, companiesRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Refreshing..." : "Refresh";
  });
}

function showMessage(message = "", tone = "") {
  const messageEl = document.getElementById("companyCrudMessage");
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.dataset.tone = tone;
}

function filteredCompanies() {
  const term = String(companiesSearch?.value || "").trim().toLowerCase();
  let rows = [...companiesData];

  if (term) {
    rows = rows.filter((company) => {
      return [
        companyName(company),
        companyDescription(company),
        companyStatus(company),
        companyCategory(company),
        companyLocation(company),
        companyContact(company),
        company.ownerName,
        company.id
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }

  rows.sort((a, b) => {
    const left = companyName(a).toLowerCase();
    const right = companyName(b).toLowerCase();

    if (left < right) return sortAsc ? -1 : 1;
    if (left > right) return sortAsc ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderStats(rows) {
  const healthy = companiesData.filter((row) =>
    ["active", "healthy", "live", "approved"].includes(normalizeStatus(companyStatus(row)))
  ).length;

  const review = companiesData.filter((row) =>
    ["review", "pending", "draft"].includes(normalizeStatus(companyStatus(row)))
  ).length;

  if (companiesStatTotal) companiesStatTotal.textContent = String(companiesData.length);
  if (companiesStatHealthy) companiesStatHealthy.textContent = String(healthy);
  if (companiesStatReview) companiesStatReview.textContent = String(review);
  if (companiesStatFiltered) companiesStatFiltered.textContent = String(rows.length);

  if (companiesHeroTitle) {
    companiesHeroTitle.textContent = companiesData.length
      ? `${companiesData.length} companies connected`
      : "No companies found yet.";
  }

  if (companiesHeroText) {
    companiesHeroText.textContent = companiesData.length
      ? "Firestore company records are live. You can now create, edit, delete, search, and refresh companies."
      : "Create your first company record to start wiring subsidiaries into Evaraos.";
  }
}

function renderLoadingState() {
  if (companiesList) {
    companiesList.innerHTML = `
      <div class="dashboard-skeleton-grid">
        <div class="dashboard-skeleton-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
        <div class="dashboard-skeleton-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
      </div>
    `;
  }

  if (companiesFeed) {
    companiesFeed.innerHTML = `
      <article class="dashboard-state-card loading">
        <strong>Loading portfolio...</strong>
        <span>Pulling Firestore company records and preparing the portfolio feed.</span>
      </article>
    `;
  }

  if (companiesHeroTitle) companiesHeroTitle.textContent = "Loading companies...";
  if (companiesHeroText) companiesHeroText.textContent = "Connecting to Firestore company records.";
}

function renderList(rows) {
  if (!companiesList) return;

  if (!rows.length) {
    companiesList.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No companies found</strong>
        <span>Try another search or add your first company from the Add Company button.</span>
      </article>
    `;
    return;
  }

  companiesList.innerHTML = rows.map((company) => {
    const id = escapeHtml(company.id);
    const name = escapeHtml(companyName(company));
    const status = escapeHtml(companyStatus(company));
    const description = escapeHtml(companyDescription(company));
    const category = escapeHtml(companyCategory(company));
    const location = escapeHtml(companyLocation(company));
    const contact = escapeHtml(companyContact(company));

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target company-crud-item" data-company-id="${id}">
        <div class="company-crud-content">
          <strong>${name}</strong>
          <span>${description}</span>
          <div class="company-crud-meta">
            <span>${category}</span>
            <span>${location}</span>
            <span>${contact}</span>
          </div>
        </div>

        <div class="company-crud-actions">
          <span class="dashboard-status-pill ${companyPillClass(status)}">${status}</span>
          <button type="button" class="btn btn-theme-secondary company-edit-btn" data-company-edit="${id}">Edit</button>
          <button type="button" class="btn btn-theme-secondary company-delete-btn" data-company-delete="${id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!companiesFeed) return;

  if (!rows.length) {
    companiesFeed.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No portfolio activity</strong>
        <span>Company activity will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  companiesFeed.innerHTML = rows.slice(0, 8).map((company) => {
    const name = escapeHtml(companyName(company));
    const status = escapeHtml(companyStatus(company));
    const category = escapeHtml(companyCategory(company));

    return `
      <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
        <strong>${name}</strong>
        <span>${category} • Status: ${status}</span>
      </article>
    `;
  }).join("");
}

function renderCompanies() {
  const rows = filteredCompanies();
  renderStats(rows);
  renderList(rows);
  renderFeed(rows);
}

async function loadCompanies() {
  if (isLoadingCompanies) return;

  isLoadingCompanies = true;
  setButtonLoading(true);
  renderLoadingState();

  try {
    const snap = await getDocs(collection(db, "companies"));
    companiesData = snap.docs.map((companyDoc) => ({
      id: companyDoc.id,
      ...companyDoc.data()
    }));
    renderCompanies();
  } catch (error) {
    console.error("Failed to load companies:", error);

    if (companiesList) {
      companiesList.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Unable to load companies</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }

    if (companiesFeed) {
      companiesFeed.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Load failed</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }
  } finally {
    isLoadingCompanies = false;
    setButtonLoading(false);
  }
}

function injectCrudStyles() {
  if (document.getElementById("companyCrudStyles")) return;

  const style = document.createElement("style");
  style.id = "companyCrudStyles";
  style.textContent = `
    .company-crud-item {
      align-items: flex-start;
      gap: 16px;
    }

    .company-crud-content {
      min-width: 0;
      display: grid;
      gap: 8px;
    }

    .company-crud-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 4px;
    }

    .company-crud-meta span {
      border-radius: 999px;
      padding: 6px 9px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 11px;
      font-weight: 800;
    }

    .company-crud-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 210px;
    }

    .company-crud-actions .btn {
      min-height: 34px;
      padding: 8px 10px;
      font-size: 12px;
    }

    .company-crud-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
      place-items: center;
      padding: 20px;
      background: rgba(0,0,0,0.62);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }

    .company-crud-modal.open { display: grid; }

    .company-crud-card {
      width: min(860px, 100%);
      max-height: min(820px, calc(100vh - 40px));
      overflow: auto;
      border-radius: 28px;
      padding: 22px;
      background: rgba(10, 12, 26, 0.90);
      border: 1px solid rgba(255,255,255,0.16);
      box-shadow: 0 34px 120px rgba(0,0,0,0.46);
    }

    .company-crud-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }

    .company-crud-head h2 {
      margin: 0;
      letter-spacing: -0.04em;
    }

    .company-crud-head p {
      margin: 7px 0 0;
      color: var(--text-muted, rgba(255,255,255,0.68));
      line-height: 1.5;
    }

    .company-crud-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .company-crud-field.full {
      grid-column: 1 / -1;
    }

    .company-crud-field label {
      display: block;
      margin-bottom: 8px;
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .company-crud-field input,
    .company-crud-field select,
    .company-crud-field textarea {
      width: 100%;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.08);
      color: var(--text-primary, #fff);
      padding: 13px 14px;
      outline: none;
      font: inherit;
    }

    .company-crud-field select option {
      color: #111;
    }

    .company-crud-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .company-crud-footer-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    #companyCrudMessage {
      margin: 0;
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 13px;
      font-weight: 800;
    }

    #companyCrudMessage[data-tone="success"] { color: #70ffbd; }
    #companyCrudMessage[data-tone="error"] { color: #ff9b8f; }

    @media (max-width: 760px) {
      .company-crud-item {
        display: grid;
      }

      .company-crud-actions {
        justify-content: flex-start;
        min-width: 0;
      }

      .company-crud-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectCrudUi() {
  injectCrudStyles();

  const heroActions = document.querySelector("#companiesHeroSection .dashboard-hero-actions");
  if (heroActions && !document.getElementById("companyCreateBtn")) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "companyCreateBtn";
    button.className = "btn btn-theme-primary beam-target";
    button.textContent = "Add Company";
    heroActions.prepend(button);
  }

  if (document.getElementById("companyCrudModal")) return;

  const modal = document.createElement("div");
  modal.id = "companyCrudModal";
  modal.className = "company-crud-modal";
  modal.innerHTML = `
    <section class="company-crud-card aurora-card active-glow beam-target" role="dialog" aria-modal="true" aria-labelledby="companyCrudTitle">
      <div class="company-crud-head">
        <div>
          <h2 id="companyCrudTitle">Add Company</h2>
          <p id="companyCrudSubtitle">Create a company record inside the Evaraos companies collection.</p>
        </div>
        <button type="button" class="btn btn-theme-secondary beam-target" id="companyCrudCloseBtn">Close</button>
      </div>

      <form id="companyCrudForm" novalidate>
        <div class="company-crud-grid">
          <div class="company-crud-field">
            <label for="companyNameInput">Company Name</label>
            <input id="companyNameInput" name="name" type="text" placeholder="Supreme True Clean" required />
          </div>

          <div class="company-crud-field">
            <label for="companyBrandInput">Brand / Public Name</label>
            <input id="companyBrandInput" name="brand" type="text" placeholder="Supreme True Clean" />
          </div>

          <div class="company-crud-field">
            <label for="companyCategoryInput">Category</label>
            <input id="companyCategoryInput" name="category" type="text" placeholder="Exterior Cleaning" />
          </div>

          <div class="company-crud-field">
            <label for="companyStatusInput">Status</label>
            <select id="companyStatusInput" name="status">
              <option value="active">Active</option>
              <option value="review">Review</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div class="company-crud-field">
            <label for="companyCityInput">City</label>
            <input id="companyCityInput" name="city" type="text" placeholder="Jacksonville" />
          </div>

          <div class="company-crud-field">
            <label for="companyStateInput">State</label>
            <input id="companyStateInput" name="state" type="text" placeholder="FL" maxlength="24" />
          </div>

          <div class="company-crud-field">
            <label for="companyEmailInput">Email</label>
            <input id="companyEmailInput" name="email" type="email" placeholder="team@example.com" />
          </div>

          <div class="company-crud-field">
            <label for="companyPhoneInput">Phone</label>
            <input id="companyPhoneInput" name="phone" type="tel" placeholder="904-000-0000" />
          </div>

          <div class="company-crud-field full">
            <label for="companyWebsiteInput">Website</label>
            <input id="companyWebsiteInput" name="website" type="url" placeholder="https://example.com" />
          </div>

          <div class="company-crud-field full">
            <label for="companyDescriptionInput">Description</label>
            <textarea id="companyDescriptionInput" name="description" rows="4" placeholder="Describe what this company does..."></textarea>
          </div>

          <div class="company-crud-field full">
            <label for="companyNotesInput">Internal Notes</label>
            <textarea id="companyNotesInput" name="notes" rows="4" placeholder="Internal operating notes..."></textarea>
          </div>
        </div>

        <div class="company-crud-footer">
          <p id="companyCrudMessage" aria-live="polite"></p>
          <div class="company-crud-footer-actions">
            <button type="button" class="btn btn-theme-secondary beam-target" id="companyCrudCancelBtn">Cancel</button>
            <button type="submit" class="btn btn-theme-primary beam-target" id="companyCrudSaveBtn">Save Company</button>
          </div>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);
}

function getModal() {
  return document.getElementById("companyCrudModal");
}

function getForm() {
  return document.getElementById("companyCrudForm");
}

function getCompanyById(id) {
  return companiesData.find((company) => String(company.id) === String(id));
}

function setFormValues(company = {}) {
  const form = getForm();
  if (!form) return;

  form.name.value = companyName(company) === "Untitled Company" ? "" : companyName(company);
  form.brand.value = company.brand || company.companyName || "";
  form.category.value = companyCategory(company) === "General" ? "" : companyCategory(company);
  form.status.value = normalizeStatus(companyStatus(company)) || "active";
  form.city.value = company.city || "";
  form.state.value = company.state || "";
  form.email.value = company.email || "";
  form.phone.value = company.phone || "";
  form.website.value = company.website || "";
  form.description.value = company.description || company.summary || "";
  form.notes.value = company.notes || "";
}

function openCompanyModal(companyId = null) {
  injectCrudUi();

  editingCompanyId = companyId;
  const company = companyId ? getCompanyById(companyId) : null;
  const modal = getModal();
  const form = getForm();
  const title = document.getElementById("companyCrudTitle");
  const subtitle = document.getElementById("companyCrudSubtitle");
  const saveBtn = document.getElementById("companyCrudSaveBtn");

  if (!modal || !form) return;

  form.reset();
  showMessage("");

  if (company) {
    if (title) title.textContent = "Edit Company";
    if (subtitle) subtitle.textContent = `Updating ${companyName(company)} in Firestore.`;
    if (saveBtn) saveBtn.textContent = "Save Changes";
    setFormValues(company);
  } else {
    if (title) title.textContent = "Add Company";
    if (subtitle) subtitle.textContent = "Create a company record inside the Evaraos companies collection.";
    if (saveBtn) saveBtn.textContent = "Create Company";
    setFormValues({ status: "active" });
  }

  modal.classList.add("open");
  document.body.classList.add("company-crud-open");

  setTimeout(() => {
    document.getElementById("companyNameInput")?.focus();
  }, 60);
}

function closeCompanyModal() {
  getModal()?.classList.remove("open");
  document.body.classList.remove("company-crud-open");
  editingCompanyId = null;
  showMessage("");
}

function formToCompanyPayload() {
  const form = getForm();
  if (!form) return null;

  const name = String(form.name.value || "").trim();
  const brand = String(form.brand.value || "").trim();
  const category = String(form.category.value || "").trim();
  const status = String(form.status.value || "active").trim().toLowerCase();
  const city = String(form.city.value || "").trim();
  const state = String(form.state.value || "").trim();
  const email = String(form.email.value || "").trim().toLowerCase();
  const phone = String(form.phone.value || "").trim();
  const website = String(form.website.value || "").trim();
  const description = String(form.description.value || "").trim();
  const notes = String(form.notes.value || "").trim();

  if (!name) {
    throw new Error("Company name is required.");
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const actor = currentActor();

  return {
    name,
    companyName: name,
    brand: brand || name,
    category: category || "General",
    status: status || "active",
    city,
    state,
    location: [city, state].filter(Boolean).join(", "),
    email,
    phone,
    website,
    description,
    notes,
    slug,
    searchText: [name, brand, category, status, city, state, email, phone, website, description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName
  };
}

async function saveCompany(event) {
  event?.preventDefault();

  const saveBtn = document.getElementById("companyCrudSaveBtn");

  try {
    const payload = formToCompanyPayload();
    if (!payload) return;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = editingCompanyId ? "Saving..." : "Creating...";
    }

    if (editingCompanyId) {
      await updateDoc(doc(db, "companies", editingCompanyId), payload);
      showMessage("Company updated successfully.", "success");
    } else {
      const actor = currentActor();
      await addDoc(collection(db, "companies"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
        createdByName: actor.displayName
      });
      showMessage("Company created successfully.", "success");
    }

    await loadCompanies();

    setTimeout(() => {
      closeCompanyModal();
    }, 350);
  } catch (error) {
    console.error("Company save failed:", error);
    showMessage(error.message || "Company save failed.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingCompanyId ? "Save Changes" : "Create Company";
    }
  }
}

async function deleteCompany(companyId) {
  const company = getCompanyById(companyId);
  if (!company) return;

  const confirmed = window.confirm(
    `Delete ${companyName(company)}? This removes the company document from Firestore. This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "companies", companyId));
    companiesData = companiesData.filter((item) => String(item.id) !== String(companyId));
    renderCompanies();
  } catch (error) {
    console.error("Company delete failed:", error);
    alert(error.message || "Unable to delete company.");
  }
}

function bindCrudEvents() {
  injectCrudUi();

  document.getElementById("companyCreateBtn")?.addEventListener("click", () => openCompanyModal());
  document.getElementById("companyCrudCloseBtn")?.addEventListener("click", closeCompanyModal);
  document.getElementById("companyCrudCancelBtn")?.addEventListener("click", closeCompanyModal);
  document.getElementById("companyCrudForm")?.addEventListener("submit", saveCompany);

  getModal()?.addEventListener("click", (event) => {
    if (event.target === getModal()) closeCompanyModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && getModal()?.classList.contains("open")) {
      closeCompanyModal();
    }
  });

  companiesList?.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-company-edit]");
    const deleteBtn = event.target.closest("[data-company-delete]");

    if (editBtn) {
      openCompanyModal(editBtn.getAttribute("data-company-edit"));
      return;
    }

    if (deleteBtn) {
      deleteCompany(deleteBtn.getAttribute("data-company-delete"));
    }
  });
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  injectCrudUi();
  bindCrudEvents();

  companiesSearch?.addEventListener("input", renderCompanies);

  companiesRefreshBtnTop?.addEventListener("click", loadCompanies);
  companiesRefreshBtnSide?.addEventListener("click", loadCompanies);

  companiesSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    companiesSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderCompanies();
  });

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
}

function initCompaniesPage() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader("/evaraos/login.html", {
        title: "Returning to login",
        subtitle: "Your session is not active."
      });
      return;
    }

    currentFirebaseUser = user;
    loadCompanies();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCompaniesPage);
} else {
  initCompaniesPage();
}
