import {
  auth,
  db,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

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

function notify(title, message, tone = "info") {
  window.dispatchEvent(new CustomEvent("evara:notify", { detail: { title, message, tone } }));
}

function companyName(company = {}) {
  return company.name || company.companyName || company.brand || company.title || "Company";
}

function companyPrimary(company = {}) {
  return company.primaryColor || company.brandPrimary || company.colorPrimary || company.themePrimary || company.color || "#ff2f57";
}

function companySecondary(company = {}) {
  return company.secondaryColor || company.brandSecondary || company.colorSecondary || company.themeSecondary || "#141917";
}

function companyStates(company = {}) {
  const raw = company.serviceStates || company.states || company.operatingStates || company.coverageStates || company.markets || [];
  if (Array.isArray(raw)) return raw.map((item) => normalize(item));
  if (typeof raw === "string") return raw.split(",").map((item) => normalize(item));
  return [];
}

function companyCities(company = {}) {
  const raw = company.serviceCities || company.cities || company.operatingCities || company.coverageCities || [];
  if (Array.isArray(raw)) return raw.map((item) => normalize(item));
  if (typeof raw === "string") return raw.split(",").map((item) => normalize(item));
  return [];
}

function isCompanyAvailable(company = {}, request = {}) {
  const states = companyStates(company);
  const cities = companyCities(company);
  const status = normalize(company.status || company.health || "active");
  const stateMatch = !states.length || states.includes(normalize(request.state));
  const cityMatch = !cities.length || !request.city || cities.includes(normalize(request.city));
  return !["inactive", "archived", "deleted", "paused"].includes(status) && stateMatch && cityMatch;
}

function currentUserProfile() {
  const saved = getSavedUserProfile?.() || {};
  const user = auth.currentUser || {};
  return {
    uid: user.uid || saved.uid || "",
    email: user.email || saved.email || "",
    displayName: saved.displayName || saved.fullName || saved.name || user.displayName || user.email || "Customer",
    role: saved.role || "customer",
    companyId: saved.companyId || "",
    companyName: saved.companyName || ""
  };
}

async function loadCompanies() {
  const snap = await getDocs(collection(db, "companies"));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function requestCardHtml() {
  return `
    <section class="glass-card aurora-card active-glow beam-target customer-lead-request-card" id="customerLeadRequestCard">
      <div class="section-title-row">
        <div>
          <p class="customer-kicker">REQUEST SERVICE</p>
          <h2 style="margin:0;">Create a new service request</h2>
          <p class="muted" style="margin:8px 0 0;max-width:720px;">
            Tell us what you need and Evaraos will route the request to the matching company in your area.
          </p>
        </div>
      </div>

      <form id="customerLeadRequestForm" class="customer-request-grid" novalidate>
        <div class="customer-request-field">
          <label for="customerLeadName">Full Name</label>
          <input id="customerLeadName" name="fullName" type="text" autocomplete="name" required>
        </div>

        <div class="customer-request-field">
          <label for="customerLeadPhone">Phone</label>
          <input id="customerLeadPhone" name="phone" type="tel" autocomplete="tel" required>
        </div>

        <div class="customer-request-field">
          <label for="customerLeadEmail">Email</label>
          <input id="customerLeadEmail" name="email" type="email" autocomplete="email">
        </div>

        <div class="customer-request-field">
          <label for="customerLeadService">Service Needed</label>
          <select id="customerLeadService" name="serviceCategory" required>
            <option value="trash_bin">Trash Bin Cleaning</option>
            <option value="pressure_washing">Pressure Washing</option>
            <option value="house_washing">House Washing</option>
            <option value="interior_cleaning">Interior Cleaning</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="customer-request-field full">
          <label for="customerLeadAddress">Street Address</label>
          <input id="customerLeadAddress" name="address" type="text" autocomplete="street-address" placeholder="Street address, apartment, gate code, etc." required>
        </div>

        <div class="customer-request-field">
          <label for="customerLeadCity">City</label>
          <input id="customerLeadCity" name="city" type="text" autocomplete="address-level2" required>
        </div>

        <div class="customer-request-field">
          <label for="customerLeadState">State</label>
          <select id="customerLeadState" name="state" autocomplete="address-level1" required>
            <option value="FL">Florida</option>
            <option value="CA">California</option>
            <option value="AZ">Arizona</option>
            <option value="TX">Texas</option>
            <option value="GA">Georgia</option>
            <option value="NC">North Carolina</option>
            <option value="SC">South Carolina</option>
          </select>
        </div>

        <div class="customer-request-field">
          <label for="customerLeadZip">Zip</label>
          <input id="customerLeadZip" name="zip" type="text" autocomplete="postal-code" required>
        </div>

        <div class="customer-request-field">
          <label for="customerLeadBudget">Budget / Estimate</label>
          <input id="customerLeadBudget" name="estimatedPrice" type="number" min="0" step="1" placeholder="Optional">
        </div>

        <div class="customer-request-field full">
          <label>Available Companies</label>
          <div id="customerCompanyOptions" class="customer-company-options">
            <div class="empty-state">Pick your state to load matching companies.</div>
          </div>
        </div>

        <div class="customer-request-field full">
          <label for="customerLeadNotes">Notes</label>
          <textarea id="customerLeadNotes" name="notes" rows="4" placeholder="Tell us details, preferred day/time, bins count, surface type, pets, access, etc."></textarea>
        </div>

        <div class="customer-request-field full">
          <button type="submit" class="btn btn-theme-primary beam-target" id="customerLeadSubmitBtn">Submit Request</button>
          <p id="customerLeadRequestMessage" class="muted" style="margin:10px 0 0;"></p>
        </div>
      </form>
    </section>
  `;
}

function readRequestForm() {
  const ids = ["Name", "Phone", "Email", "Service", "Address", "City", "State", "Zip", "Budget", "Notes"];
  const get = (suffix) => String(document.getElementById(`customerLead${suffix}`)?.value || "").trim();
  return {
    fullName: get("Name"),
    phone: get("Phone"),
    email: get("Email"),
    serviceCategory: get("Service"),
    address: get("Address"),
    city: get("City"),
    state: get("State"),
    zip: get("Zip"),
    estimatedPrice: Number(get("Budget") || 0),
    notes: get("Notes")
  };
}

function renderCompanyOptions(companies = [], request = {}) {
  const root = document.getElementById("customerCompanyOptions");
  if (!root) return;

  const matches = companies.filter((company) => isCompanyAvailable(company, request));

  if (!matches.length) {
    root.innerHTML = `<div class="empty-state">No live company is configured for ${escapeHtml(request.state || "this state")} yet. Evaraos will place this request in dispatch review.</div>`;
    return;
  }

  root.innerHTML = matches.map((company, index) => `
    <label class="customer-company-option" style="--company-primary:${escapeHtml(companyPrimary(company))};--company-secondary:${escapeHtml(companySecondary(company))};">
      <span class="evara-company-pill" style="--company-primary:${escapeHtml(companyPrimary(company))};--company-secondary:${escapeHtml(companySecondary(company))};">${escapeHtml(companyName(company))}</span>
      <span>
        <strong>${escapeHtml(companyName(company))}</strong>
        <span>${escapeHtml((company.serviceCities || company.markets || company.serviceStates || "Local service area").toString())}</span>
      </span>
      <input type="radio" name="customerCompanyChoice" value="${escapeHtml(company.id)}" ${index === 0 ? "checked" : ""}>
    </label>
  `).join("");
}

function chosenCompany(companies = []) {
  const selected = document.querySelector("input[name='customerCompanyChoice']:checked")?.value || "";
  return companies.find((company) => company.id === selected) || null;
}

async function submitCustomerLead(companies = []) {
  const message = document.getElementById("customerLeadRequestMessage");
  const button = document.getElementById("customerLeadSubmitBtn");
  const profile = currentUserProfile();
  const request = readRequestForm();
  const company = chosenCompany(companies);

  if (!request.fullName || !request.phone || !request.address || !request.city || !request.state || !request.zip) {
    if (message) message.textContent = "Please fill out name, phone, address, city, state, and zip.";
    notify("Missing details", "Fill out the required request fields before submitting.", "warning");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Submitting...";
    }

    const payload = {
      ...request,
      name: request.fullName,
      customerName: request.fullName,
      leadSource: "customer_portal",
      source: "customer_portal",
      status: company ? "new" : "dispatch_review",
      priority: "normal",
      companyId: company?.id || "",
      companyName: company ? companyName(company) : "Dispatch Review",
      customerUid: profile.uid,
      customerEmail: profile.email,
      createdBy: profile.uid,
      createdByUid: profile.uid,
      createdByName: profile.displayName,
      createdByRole: "customer",
      customerSubmitted: true,
      automationStatus: company ? "company_routed" : "needs_dispatch_review",
      routingState: request.state,
      routingCity: request.city,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      searchText: [request.fullName, request.phone, request.email, request.address, request.city, request.state, request.zip, request.serviceCategory, request.notes, company ? companyName(company) : "dispatch review"].join(" ").toLowerCase()
    };

    await addDoc(collection(db, "leads"), payload);

    if (message) message.textContent = company ? `Request sent to ${companyName(company)}.` : "Request submitted for dispatch review.";
    notify("Request submitted", company ? `${companyName(company)} was routed this lead.` : "Evaraos dispatch will review this lead.", "success");
    document.getElementById("customerLeadRequestForm")?.reset();
    renderCompanyOptions(companies, readRequestForm());
  } catch (error) {
    console.error("Customer lead request failed:", error);
    if (message) message.textContent = error.message || "Could not submit request.";
    notify("Request failed", "The request could not be submitted. Check permissions or connection.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Submit Request";
    }
  }
}

async function init() {
  const mountAfter = document.querySelector(".customer-page-wrap .customer-grid") || document.querySelector(".customer-page-wrap section:last-of-type");
  if (!mountAfter || document.getElementById("customerLeadRequestCard")) return;

  mountAfter.insertAdjacentHTML("afterend", requestCardHtml());

  const profile = currentUserProfile();
  const nameInput = document.getElementById("customerLeadName");
  const phoneInput = document.getElementById("customerLeadPhone");
  const emailInput = document.getElementById("customerLeadEmail");
  if (nameInput) nameInput.value = profile.displayName || "";
  if (emailInput) emailInput.value = profile.email || "";

  const companies = await loadCompanies().catch((error) => {
    console.warn("Could not load companies for customer request:", error);
    return [];
  });

  const updateMatches = () => renderCompanyOptions(companies, readRequestForm());
  updateMatches();
  ["customerLeadState", "customerLeadCity"].forEach((id) => document.getElementById(id)?.addEventListener("input", updateMatches));
  document.getElementById("customerLeadRequestForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitCustomerLead(companies);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
