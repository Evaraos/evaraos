import {
  functions,
  httpsCallable
} from "./firebase.js";

const STAFF_ROLES = [
  ["hr", "HR"],
  ["hr_manager", "HR Manager"],
  ["operations_manager", "Operations Manager"],
  ["operations_coordinator", "Operations Coordinator"],
  ["dispatcher", "Dispatcher"],
  ["field_manager", "Field Manager"],
  ["sales_manager", "Sales Manager"],
  ["customer_support", "Customer Support"],
  ["quality_control", "Quality Control"],
  ["sales", "Sales"],
  ["sales_rep", "Sales Rep"],
  ["technician", "Technician"],
  ["lead_technician", "Lead Technician"],
  ["cleaner", "Cleaner"],
  ["lead_cleaner", "Lead Cleaner"],
  ["staff", "General Staff"],
  ["field_staff", "Field Staff"],
  ["crew_lead", "Crew Lead"]
];

const COMPANY_OPTIONS = [
  ["", "Select company"],
  ["supreme-true-clean|Supreme True Clean", "Supreme True Clean"],
  ["oneofone-cleaning|OneofOne Cleaning", "OneofOne Cleaning"],
  ["evaraos|Evaraos Inc", "Evaraos Inc"]
];

const reviewStaffApplication = httpsCallable(functions, "reviewStaffApplication");

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleAllowed(role = "") {
  return STAFF_ROLES.some(([value]) => value === normalize(role));
}

function roleLabel(role = "") {
  return STAFF_ROLES.find(([value]) => value === normalize(role))?.[1] || role || "Staff";
}

function roleOptions(selected = "") {
  const active = normalize(selected || "staff");
  return STAFF_ROLES.map(([value, label]) => (
    `<option value="${escapeHtml(value)}" ${active === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function companyOptions() {
  return COMPANY_OPTIONS.map(([value, label]) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
  )).join("");
}

function enhanceReviewBox(card) {
  if (!card || card.dataset.hrEnhanced === "true") return;

  const id = card.dataset.applicationId;
  const reviewBox = card.querySelector(".review-box");
  if (!id || !reviewBox) return;

  const currentRoleText = card.querySelector(".pill-row .pill:nth-child(3)")?.textContent || "";
  const guessedRole = STAFF_ROLES.find(([, label]) => currentRoleText.toLowerCase().includes(label.toLowerCase()))?.[0] || "staff";

  if (!reviewBox.querySelector("[data-final-role-choice]")) {
    const roleSelect = document.createElement("select");
    roleSelect.dataset.finalRoleChoice = id;
    roleSelect.setAttribute("aria-label", "Final approved role");
    roleSelect.innerHTML = roleOptions(guessedRole);
    reviewBox.insertBefore(roleSelect, reviewBox.firstChild);
  }

  const companySelect = reviewBox.querySelector(`[data-company-choice="${CSS.escape(id)}"]`);
  if (companySelect) {
    companySelect.innerHTML = companyOptions();
    companySelect.setAttribute("aria-label", "Assigned company");
  }

  card.dataset.hrEnhanced = "true";
}

function enhanceAllCards() {
  document.querySelectorAll(".application-card[data-application-id]").forEach(enhanceReviewBox);
}

function companySelection(id) {
  const raw = document.querySelector(`[data-company-choice="${CSS.escape(id)}"]`)?.value || "";
  if (!raw) return { companyId: "", companyName: "" };
  const [companyId, companyName] = raw.split("|");
  return {
    companyId: String(companyId || "").trim(),
    companyName: String(companyName || companyId || "").trim()
  };
}

function finalRoleSelection(id) {
  return normalize(document.querySelector(`[data-final-role-choice="${CSS.escape(id)}"]`)?.value || "staff");
}

function reviewNotes(id) {
  return String(document.querySelector(`[data-review-notes="${CSS.escape(id)}"]`)?.value || "").trim();
}

function readableError(error) {
  const message = String(error?.message || "Application review failed.");
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "");
}

async function submitDecision(id, decision) {
  const company = companySelection(id);
  const finalRole = finalRoleSelection(id);

  if (decision === "approved") {
    if (!roleAllowed(finalRole)) {
      throw new Error("Select a valid final role before approving.");
    }
    if (!company.companyId) {
      throw new Error("Select a company before approving this applicant.");
    }

    const approved = window.confirm(`Approve this applicant as ${roleLabel(finalRole)} for ${company.companyName}?`);
    if (!approved) return false;
  } else if (decision === "rejected") {
    if (!window.confirm("Reject this staff application?")) return false;
  }

  await reviewStaffApplication({
    applicationId: id,
    decision,
    reviewNotes: reviewNotes(id),
    companyId: decision === "approved" ? company.companyId : "",
    companyName: decision === "approved" ? company.companyName : "",
    finalRole: decision === "approved" ? finalRole : ""
  });

  return true;
}

function decisionFromButton(button) {
  if (button.matches("[data-approve]")) return "approved";
  if (button.matches("[data-more-info]")) return "needs_more_info";
  if (button.matches("[data-reject]")) return "rejected";
  return "";
}

function applicationIdFromButton(button) {
  return button.getAttribute("data-approve")
    || button.getAttribute("data-more-info")
    || button.getAttribute("data-reject")
    || "";
}

function bindTrustedReviewHandler() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-approve], [data-more-info], [data-reject]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const decision = decisionFromButton(button);
    const applicationId = applicationIdFromButton(button);
    if (!decision || !applicationId) return;

    button.disabled = true;
    const original = button.textContent;
    button.textContent = decision === "approved"
      ? "Approving..."
      : decision === "rejected"
        ? "Rejecting..."
        : "Saving...";

    try {
      const completed = await submitDecision(applicationId, decision);
      if (!completed) {
        button.disabled = false;
        button.textContent = original;
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error("Trusted staff application review failed:", error);
      alert(readableError(error));
      button.disabled = false;
      button.textContent = original;
    }
  }, true);
}

function init() {
  enhanceAllCards();
  bindTrustedReviewHandler();

  const list = document.getElementById("applicationsList");
  if (list) {
    new MutationObserver(enhanceAllCards).observe(list, { childList: true, subtree: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
