const TRUST_KEY = "evaraos-trusted-staff-device-v1";
const STAFF_ROLES = new Set([
  "owner",
  "super_admin",
  "admin",
  "manager",
  "operations_coordinator",
  "sales",
  "sales_rep",
  "technician",
  "cleaner",
  "staff",
  "hr"
]);

function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (value === "tech") return "technician";
  if (value === "super admin") return "super_admin";
  if (value === "sales rep") return "sales_rep";
  if (value === "operations coordinator") return "operations_coordinator";
  return value;
}

function readTrust() {
  try {
    const raw = localStorage.getItem(TRUST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTrust(data) {
  try {
    localStorage.setItem(TRUST_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function isStaffRole(role = "") {
  return STAFF_ROLES.has(normalizeRole(role));
}

export function rememberStaffDevice(profile = {}) {
  const role = normalizeRole(profile.role || "");
  if (!profile.uid || !isStaffRole(role)) return false;

  return writeTrust({
    uid: profile.uid,
    email: profile.email || "",
    role,
    companyId: profile.companyId || "",
    companyName: profile.companyName || "",
    rememberedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  });
}

export function forgetStaffDevice() {
  try {
    localStorage.removeItem(TRUST_KEY);
  } catch {}
}

export function getTrustedStaffDevice() {
  const trust = readTrust();
  if (!trust?.uid || !trust?.expiresAt) return null;

  if (Date.parse(trust.expiresAt) <= Date.now()) {
    forgetStaffDevice();
    return null;
  }

  if (!isStaffRole(trust.role)) return null;
  return trust;
}

export function canUseOfflineStaffTools(profile = {}) {
  const trust = getTrustedStaffDevice();
  if (!trust || !profile?.uid) return false;
  return trust.uid === profile.uid && isStaffRole(profile.role);
}

export function trustedStaffSummary() {
  const trust = getTrustedStaffDevice();
  return trust ? { ...trust, trusted: true } : { trusted: false };
}

window.EvaraDeviceTrust = {
  isStaffRole,
  rememberStaffDevice,
  forgetStaffDevice,
  getTrustedStaffDevice,
  canUseOfflineStaffTools,
  trustedStaffSummary
};
