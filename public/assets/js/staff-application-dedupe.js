function dedupeId(id) {
  const nodes = Array.from(document.querySelectorAll(`#${CSS.escape(id)}`));
  nodes.slice(1).forEach((node) => {
    const field = node.closest(".application-field");
    (field || node).remove();
  });
}

function cleanStaffApplicationDuplicates() {
  if (!document.body?.classList.contains("staff-application-page")) return;
  [
    "appPathway",
    "appCompanyCategory",
    "appDriversNumber",
    "appDriversExpiration",
    "appEmergencyEmail"
  ].forEach(dedupeId);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(cleanStaffApplicationDuplicates);
  }, { once: true });
} else {
  requestAnimationFrame(cleanStaffApplicationDuplicates);
}
