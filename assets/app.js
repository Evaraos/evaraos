import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";
import { listenAuth, logout } from "./auth.js";
import { canAccess, getAllowedSections, getRoleLabel } from "./roles.js";

export const SERVICE_LIBRARY = {
  exterior: [
    { id: "driveway_cleaning", label: "Driveway Cleaning", rate: 0.20, unit: "sqft" },
    { id: "sidewalk_cleaning", label: "Sidewalk Cleaning", rate: 0.12, unit: "sqft" },
    { id: "patio_cleaning", label: "Patio Cleaning", rate: 0.18, unit: "sqft" },
    { id: "deck_cleaning", label: "Deck Cleaning", rate: 0.20, unit: "sqft" },
    { id: "house_wash", label: "House Wash", rate: 0.25, unit: "sqft" },
    { id: "fence_cleaning", label: "Fence Cleaning", rate: 12, unit: "panel" }
  ],
  trash_bin: [
    { id: "one_bin_monthly", label: "1 Bin Monthly", flat: 25 },
    { id: "two_bins_monthly", label: "2 Bins Monthly", flat: 45 },
    { id: "three_plus_bins_monthly", label: "3+ Bins Monthly", flat: 60 },
    { id: "one_time_bin_cleaning", label: "One-Time Bin Cleaning", flat: 30 }
  ],
  bundle: [
    { id: "driveway_sidewalk_bundle", label: "Driveway + Sidewalk Bundle", rate: 0.28, unit: "sqft" },
    { id: "full_exterior_bundle", label: "Full Exterior Package", rate: 0.38, unit: "sqft" },
    { id: "house_driveway_patio_bundle", label: "House + Driveway + Patio Bundle", rate: 0.42, unit: "sqft" }
  ]
};

export const ADD_ONS = [
  { id: "deodorizing", label: "Deodorizing", flat: 10 },
  { id: "rust_removal", label: "Rust Removal", flat: 25 },
  { id: "oil_stain_removal", label: "Oil Stain Removal", flat: 35 },
  { id: "mold_treatment", label: "Mold Treatment", flat: 20 },
  { id: "sealing", label: "Sealing", flat: 60 }
];

export function getRoleDefaults(role) {
  const map = {
    super_admin: { organizationLevel: 1, permissions: ["all"], companyAccessLevel: "parent" },
    admin: { organizationLevel: 2, permissions: ["manage_users", "approve", "full_company"], companyAccessLevel: "subsidiary" },
    manager: { organizationLevel: 3, permissions: ["leads", "jobs", "customers"], companyAccessLevel: "subsidiary" },
    operations_coordinator: { organizationLevel: 3, permissions: ["jobs", "customers"], companyAccessLevel: "subsidiary" },
    hr: { organizationLevel: 3, permissions: ["users", "staff"], companyAccessLevel: "subsidiary" },
    sales_rep: { organizationLevel: 4, permissions: ["leads", "convert"], companyAccessLevel: "subsidiary" },
    technician: { organizationLevel: 5, permissions: ["jobs"], companyAccessLevel: "subsidiary" },
    customer: { organizationLevel: 6, permissions: ["self"], companyAccessLevel: "subsidiary" }
  };
  return map[role] || map.customer;
}

export function calculateLeadEstimate(serviceCategory, serviceType, quantity, addOns = []) {
  const qty = Number(quantity || 0);
  const service = (SERVICE_LIBRARY[serviceCategory] || []).find((s) => s.id === serviceType);

  let total = 0;
  if (service?.rate) total += qty * service.rate;
  if (service?.flat) total += service.flat;

  addOns.forEach((addonId) => {
    const addon = ADD_ONS.find((a) => a.id === addonId);
    if (addon?.flat) total += addon.flat;
  });

  return Number(total.toFixed(2));
}

export async function loadBrandSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "app"));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function loadCompany(companyId) {
  try {
    if (!companyId) return null;
    const snap = await getDoc(doc(db, "companies", companyId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch {
    return null;
  }
}

export function getDashboardPath(role) {
  return role === "customer" ? "customer_dashboard.html" : "dashboard.html";
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (!Array.isArray(user.permissions)) return false;
  return user.permissions.includes("all") || user.permissions.includes(permission);
}

export async function bindTopbar(user = null) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const settings = await loadBrandSettings();
  const company = user?.companyId ? await loadCompany(user.companyId) : null;
  const homeHref = "index.html";
  const dashboardHref = user ? getDashboardPath(user.role) : "dashboard.html";

  topbar.innerHTML = `
    <div class="app-topbar-inner">
      <a class="app-brand" href="${homeHref}">
        <img src="${settings?.logoUrl || "assets/img/evaraos_logo.png"}" alt="logo">
        <div class="app-brand-text">
          <strong>${settings?.platformName || "Evaraos Inc"}</strong>
          <span>${company?.name || settings?.companyName || "Supreme TrueClean"}</span>
        </div>
      </a>

      <nav class="app-nav">
        <a href="${homeHref}">Home</a>
        <a href="${dashboardHref}" class="active">Dashboard</a>
        <button id="logoutBtn">Logout</button>
      </nav>
    </div>
  `;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      window.location.href = "login.html";
    };
  }
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

export async function fetchCompanyCollection(name, companyId) {
  const q = query(collection(db, name), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchUsersByCompany(companyId) {
  const q = query(collection(db, "users"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchPendingUsersByCompany(companyId, includeAll = false) {
  let qRef;

  if (includeAll) {
    qRef = query(collection(db, "users"), where("approvalStatus", "==", "pending"));
  } else {
    qRef = query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("approvalStatus", "==", "pending")
    );
  }

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActiveSalesReps(companyId) {
  const q = query(
    collection(db, "sales_reps"),
    where("companyId", "==", companyId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActiveTechnicians(companyId) {
  const q = query(
    collection(db, "users"),
    where("companyId", "==", companyId),
    where("role", "==", "technician"),
    where("status", "==", "active"),
    where("approvalStatus", "==", "approved")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function renderSidebar(role, active = "overview") {
  const links = [
    { key: "overview", label: "Overview", href: role === "customer" ? "customer_dashboard.html" : "dashboard.html" },
    { key: "users", label: "Users", href: "users.html" },
    { key: "leads", label: "Leads", href: "leads.html" },
    { key: "sales_reps", label: "Sales Reps", href: "sales_reps.html" },
    { key: "companies", label: "Companies", href: "companies.html" },
    { key: "jobs", label: "Jobs", href: "jobs.html" },
    { key: "customers", label: "Customers", href: "#" },
    { key: "settings", label: "Settings", href: "#" }
  ];

  return links
    .filter((link) => canAccess(role, link.key))
    .map((link) => `<a class="${active === link.key ? "active" : ""}" href="${link.href}">${link.label}</a>`)
    .join("");
}

export function renderRoleSummary(user) {
  const sections = getAllowedSections(user.role);
  const prettyRole = getRoleLabel(user.role);

  return `
    <strong>${user.name || user.email}</strong><br>
    Username: ${user.username || "—"}<br>
    Role: ${prettyRole}<br>
    Company: ${user.companyId}<br>
    Access Level: ${user.companyAccessLevel || "subsidiary"}<br>
    Sections: ${sections.join(", ")}<br>
    Org Level: ${user.organizationLevel || "—"}
  `;
}

export function renderPermissionBadges(user) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (!permissions.length) return `<span class="muted">No permissions found</span>`;
  return permissions.map((item) => `<span class="badge">${item}</span>`).join("");
}

export function roleGuard(user, requiredSection) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return canAccess(user.role, requiredSection);
}

export function groupUsersByRole(users) {
  const order = [
    "super_admin",
    "admin",
    "manager",
    "operations_coordinator",
    "sales_rep",
    "technician",
    "hr",
    "customer"
  ];

  const groups = {};
  order.forEach((role) => {
    groups[role] = users.filter((user) => user.role === role);
  });

  const extras = users.filter((user) => !order.includes(user.role));
  if (extras.length) groups.other = extras;

  return groups;
}

export async function createLead(data, user) {
  return addDoc(collection(db, "leads"), {
    companyId: user.companyId,
    fullName: data.fullName || "",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    serviceCategory: data.serviceCategory || "",
    serviceType: data.serviceType || "",
    serviceInterest: data.serviceLabel || "",
    addOns: data.addOns || [],
    leadSource: data.leadSource || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedSqFt: Number(data.estimatedSqFt || 0),
    estimatedPrice: Number(data.estimatedPrice || 0),
    assignedRep: data.assignedRep || "",
    status: data.status || "new",
    notes: data.notes || "",
    appointmentDate: data.appointmentDate || "",
    isArchived: false,
    deleteRequested: false,
    deleteRequestedBy: "",
    deleteApprovedBy: "",
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
    serviceCategory: data.serviceCategory || "",
    serviceType: data.serviceType || "",
    serviceInterest: data.serviceLabel || "",
    addOns: data.addOns || [],
    leadSource: data.leadSource || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedSqFt: Number(data.estimatedSqFt || 0),
    estimatedPrice: Number(data.estimatedPrice || 0),
    assignedRep: data.assignedRep || "",
    status: data.status || "new",
    notes: data.notes || "",
    appointmentDate: data.appointmentDate || "",
    updatedAt: serverTimestamp()
  });
}

export async function archiveLead(leadId, user) {
  return updateDoc(doc(db, "leads", leadId), {
    isArchived: true,
    archivedBy: user.email || "",
    updatedAt: serverTimestamp()
  });
}

export async function requestDeleteLead(leadId, user) {
  return updateDoc(doc(db, "leads", leadId), {
    deleteRequested: true,
    deleteRequestedBy: user.email || "",
    updatedAt: serverTimestamp()
  });
}

export async function approveDeleteLead(leadId, user) {
  await updateDoc(doc(db, "leads", leadId), {
    deleteApprovedBy: user.email || "",
    updatedAt: serverTimestamp()
  });
  return deleteDoc(doc(db, "leads", leadId));
}

export async function convertLeadToJob(lead, data, user) {
  const jobRef = await addDoc(collection(db, "jobs"), {
    companyId: user.companyId,
    sourceLeadId: lead.id,
    customerName: lead.fullName || "",
    customerPhone: lead.phone || "",
    customerEmail: lead.email || "",
    address: lead.address || "",
    city: lead.city || "",
    state: lead.state || "",
    zip: lead.zip || "",
    serviceType: data.serviceType || lead.serviceInterest || "",
    assignedRep: lead.assignedRep || "",
    assignedTechnician: data.assignedTechnician || "",
    scheduledDate: data.scheduledDate || "",
    scheduledTimeWindow: data.scheduledTimeWindow || "",
    estimatedSqFt: Number(lead.estimatedSqFt || 0),
    estimatedPrice: Number(lead.estimatedPrice || 0),
    status: "scheduled",
    notes: data.notes || lead.notes || "",
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "leads", lead.id), {
    status: "scheduled",
    convertedToJobId: jobRef.id,
    updatedAt: serverTimestamp()
  });

  return jobRef;
}

export async function createSalesRep(data, user) {
  return addDoc(collection(db, "sales_reps"), {
    companyId: user.companyId,
    fullName: data.fullName || "",
    email: data.email || "",
    phone: data.phone || "",
    status: data.status || "active",
    notes: data.notes || "",
    role: data.role || "sales_rep",
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
    role: data.role || "sales_rep",
    updatedAt: serverTimestamp()
  });
}

export async function createCompany(data, user) {
  return addDoc(collection(db, "companies"), {
    name: data.name || "",
    slug: data.slug || "",
    city: data.city || "",
    state: data.state || "",
    phone: data.phone || "",
    email: data.email || "",
    status: data.status || "active",
    notes: data.notes || "",
    ownerCompany: "Evaraos Inc",
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateCompany(companyId, data) {
  return updateDoc(doc(db, "companies", companyId), {
    name: data.name || "",
    slug: data.slug || "",
    city: data.city || "",
    state: data.state || "",
    phone: data.phone || "",
    email: data.email || "",
    status: data.status || "active",
    notes: data.notes || "",
    updatedAt: serverTimestamp()
  });
}

export async function updateUserAdmin(userId, data) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) {
    throw new Error("User not found.");
  }

  const existingUser = existingSnap.data();

  if (existingUser.role === "super_admin") {
    return updateDoc(doc(db, "users", userId), {
      name: data.name,
      username: data.username,
      companyId: data.companyId,
      status: "active",
      phone: data.phone || "",
      address: data.address || "",
      city: data.city || "",
      state: data.state || "",
      zip: data.zip || "",
      role: "super_admin",
      approvalStatus: "approved",
      organizationLevel: 1,
      permissions: ["all"],
      companyAccessLevel: "parent",
      updatedAt: serverTimestamp()
    });
  }

  const defaults = getRoleDefaults(data.role);

  return updateDoc(doc(db, "users", userId), {
    name: data.name,
    username: data.username,
    role: data.role,
    approvalStatus: data.approvalStatus,
    companyId: data.companyId,
    status: data.status,
    phone: data.phone || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    organizationLevel: defaults.organizationLevel,
    permissions: defaults.permissions,
    companyAccessLevel: defaults.companyAccessLevel,
    updatedAt: serverTimestamp()
  });
}

export async function approveUser(userId) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) throw new Error("User not found.");

  const existingUser = existingSnap.data();
  if (existingUser.role === "super_admin") {
    return updateDoc(doc(db, "users", userId), {
      role: "super_admin",
      approvalStatus: "approved",
      status: "active",
      organizationLevel: 1,
      permissions: ["all"],
      companyAccessLevel: "parent",
      updatedAt: serverTimestamp()
    });
  }

  return updateDoc(doc(db, "users", userId), {
    approvalStatus: "approved",
    status: "active",
    updatedAt: serverTimestamp()
  });
}

export async function rejectUser(userId) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) throw new Error("User not found.");

  const existingUser = existingSnap.data();
  if (existingUser.role === "super_admin") {
    throw new Error("Super Admin cannot be rejected.");
  }

  return updateDoc(doc(db, "users", userId), {
    approvalStatus: "rejected",
    status: "inactive",
    updatedAt: serverTimestamp()
  });
}

export async function updateOwnCustomerProfile(userId, data) {
  return updateDoc(doc(db, "users", userId), {
    name: data.name,
    username: data.username,
    email: data.email,
    phone: data.phone || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    photoUrl: data.photoUrl || "",
    preferredContactMethod: data.preferredContactMethod || "",
    updatedAt: serverTimestamp()
  });
}

export async function fetchCustomerServices(user) {
  return [
    {
      id: "trash-bin-monthly",
      name: "Trash Bin Cleaning Subscription",
      status: "active",
      billingType: "monthly",
      cancellationPolicy: "Early cancellation may include termination fees depending on contract terms.",
      canRequestChanges: true
    },
    {
      id: "driveway-cleaning",
      name: "Driveway Cleaning",
      status: "inactive",
      billingType: "one_time",
      cancellationPolicy: "One-time services can be removed before scheduling confirmation.",
      canRequestChanges: true
    }
  ];
}