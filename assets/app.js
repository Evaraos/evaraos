import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, COMPANY_ID } from "./firebase.js";
import { listenAuth, logout } from "./auth.js";
import { canAccess, getAllowedSections, getRoleLabel } from "./roles.js";

export async function loadBrandSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "app"));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export function getDashboardPath(role) {
  return role === "customer" ? "customer_dashboard.html" : "dashboard.html";
}

export async function bindTopbar(user = null) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const settings = await loadBrandSettings();
  const homeHref = "index.html";
  const dashboardHref = user ? getDashboardPath(user.role) : "dashboard.html";

  topbar.innerHTML = `
    <div class="app-topbar-inner">
      <a class="app-brand" href="${homeHref}">
        <img src="${settings?.logoUrl || "../assets/img/evaraos_logo.png"}" alt="logo">
        <div>
          <div>${settings?.platformName || "Evaraos Inc"}</div>
          <div class="muted">${settings?.companyName || "Supreme TrueClean"}</div>
        </div>
      </a>
      <div style="display:flex;gap:10px;align-items:center;">
        <a class="btn secondary" href="${dashboardHref}">Dashboard</a>
        <button class="btn secondary" id="logoutBtn">Logout</button>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").onclick = async () => {
    await logout();
    window.location.href = "login.html";
  };
}

export function requireAuth(renderFn) {
  listenAuth((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (user.approvalStatus !== "approved") {
      document.body.innerHTML = `
        <div class="auth-shell">
          <div class="auth-card">
            <h2>Waiting for approval</h2>
            <p class="muted">Your account is pending approval.</p>
          </div>
        </div>
      `;
      return;
    }

    renderFn(user);
  });
}

export async function fetchCompanyCollection(name) {
  const q = query(collection(db, name), where("companyId", "==", COMPANY_ID));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function renderSidebar(role, active = "overview") {
  const links = [
    { key: "overview", label: "Overview", href: role === "customer" ? "customer_dashboard.html" : "dashboard.html" },
    { key: "leads", label: "Leads", href: "leads.html" },
    { key: "sales_reps", label: "Sales Reps", href: "sales_reps.html" },
    { key: "customers", label: "Customers", href: "#" },
    { key: "jobs", label: "Jobs", href: "#" },
    { key: "admin", label: "Admin", href: "#" },
    { key: "settings", label: "Settings", href: "#" }
  ];

  return links
    .filter((link) => canAccess(role, link.key))
    .map(
      (link) =>
        `<a class="${active === link.key ? "active" : ""}" href="${link.href}">${link.label}</a>`
    )
    .join("");
}

export function renderRoleSummary(user) {
  const sections = getAllowedSections(user.role);
  const prettyRole = getRoleLabel(user.role);

  return `
    <strong>${user.name || user.email}</strong><br>
    Role: ${prettyRole}<br>
    Company: ${user.companyId}<br>
    Access: ${sections.join(", ")}
  `;
}

export function roleGuard(user, requiredSection) {
  return canAccess(user.role, requiredSection);
}

// Leads
export async function createLead(data, user) {
  return addDoc(collection(db, "leads"), {
    companyId: COMPANY_ID,
    fullName: data.fullName || "",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    serviceInterest: data.serviceInterest || "",
    leadSource: data.leadSource || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedSqFt: Number(data.estimatedSqFt || 0),
    assignedRep: data.assignedRep || "",
    status: data.status || "new",
    notes: data.notes || "",
    appointmentDate: data.appointmentDate || "",
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateLead(leadId, data) {
  return updateDoc(doc(db, "leads", leadId), {
    fullName: data.fullName || "",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    serviceInterest: data.serviceInterest || "",
    leadSource: data.leadSource || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedSqFt: Number(data.estimatedSqFt || 0),
    assignedRep: data.assignedRep || "",
    status: data.status || "new",
    notes: data.notes || "",
    appointmentDate: data.appointmentDate || "",
    updatedAt: serverTimestamp()
  });
}

// Sales reps
export async function createSalesRep(data, user) {
  return addDoc(collection(db, "sales_reps"), {
    companyId: COMPANY_ID,
    fullName: data.fullName || "",
    email: data.email || "",
    phone: data.phone || "",
    status: data.status || "active",
    notes: data.notes || "",
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateSalesRep(repId, data) {
  return updateDoc(doc(db, "sales_reps", repId), {
    fullName: data.fullName || "",
    email: data.email || "",
    phone: data.phone || "",
    status: data.status || "active",
    notes: data.notes || "",
    updatedAt: serverTimestamp()
  });
}

export async function fetchActiveSalesReps() {
  const q = query(
    collection(db, "sales_reps"),
    where("companyId", "==", COMPANY_ID),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}