import { getSavedUserProfile } from "./firebase.js";
import { rememberStaffDevice, forgetStaffDevice, isStaffRole, getTrustedStaffDevice } from "./device-trust.js";

let handled = false;

function checked() {
  return !!document.getElementById("rememberDevice")?.checked;
}

function toast(title, message, tone = "info") {
  window.dispatchEvent(new CustomEvent("evara:notify", { detail: { title, message, tone } }));
}

function applyGate() {
  const profile = getSavedUserProfile?.() || {};
  const role = String(profile.role || "").toLowerCase();
  const trust = getTrustedStaffDevice();

  if (window.location.pathname.endsWith("/login.html") && profile.uid && !handled) {
    handled = true;
    if (isStaffRole(role) && checked()) {
      rememberStaffDevice(profile);
      toast("Device remembered", "Offline staff tools are enabled on this device.", "success");
    } else if (isStaffRole(role)) {
      forgetStaffDevice();
      toast("Offline disabled", "Check Remember this device next login to enable offline tools.", "warning");
    }
  }

  if (profile.uid && trust?.uid === profile.uid && isStaffRole(profile.role)) {
    document.documentElement.setAttribute("data-offline-staff-ready", "true");
  } else {
    document.documentElement.removeAttribute("data-offline-staff-ready");
  }
}

window.addEventListener("evara:session-ready", applyGate);
window.addEventListener("pageshow", applyGate);
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyGate, { once: true });
} else {
  applyGate();
}

window.EvaraOfflineStaffGate = { applyGate };
