function dedupeId(id) {
  const nodes = Array.from(document.querySelectorAll(`#${CSS.escape(id)}`));
  nodes.slice(1).forEach((node) => {
    const field = node.closest(".application-field");
    (field || node).remove();
  });
}

function dedupeSelector(selector) {
  const nodes = Array.from(document.querySelectorAll(selector));
  nodes.slice(1).forEach((node) => node.remove());
}

function populateCompanySelect() {
  const select = document.getElementById("appDesiredCompany");
  if (!select || select.options.length > 1) return;
  select.innerHTML = `
    <option value="">Select company or pathway</option>
    <optgroup label="Evaraos in-house companies">
      <option value="Supreme True Clean">Supreme True Clean</option>
      <option value="OneofOne Cleaning">OneofOne Cleaning</option>
      <option value="Solar Bright">Solar Bright</option>
      <option value="Evaraos Inc">Evaraos Inc</option>
    </optgroup>
    <optgroup label="Programs and marketplace pathways">
      <option value="Evaraos Independent Service Program">Evaraos Independent Service Program</option>
      <option value="Evaraos Lead Vendor Program">Evaraos Lead Vendor Program</option>
      <option value="Evaraos Service Vendor Program">Evaraos Service Vendor Program</option>
      <option value="Independent Freelancer / Contractor">Independent Freelancer / Contractor</option>
    </optgroup>
    <optgroup label="Established third-party businesses">
      <option value="Third-Party Business — Operations Platform Only">Third-Party Business — Operations Platform Only</option>
      <option value="Third-Party Service Vendor">Third-Party Service Vendor</option>
      <option value="Third-Party Lead Vendor">Third-Party Lead Vendor</option>
    </optgroup>`;
}

function cleanStaffApplication() {
  if (!document.body?.classList.contains("staff-application-page")) return;

  [
    "appPathway",
    "appCompanyCategory",
    "appDriversNumber",
    "appDriversExpiration",
    "appEmergencyEmail",
    "appCampaign",
    "appPreferredCity"
  ].forEach(dedupeId);

  dedupeSelector(".role-explorer");
  dedupeSelector(".site-footer");
  populateCompanySelect();
}

function install() {
  cleanStaffApplication();
  requestAnimationFrame(cleanStaffApplication);
  setTimeout(cleanStaffApplication, 120);
  setTimeout(cleanStaffApplication, 500);

  const observer = new MutationObserver(cleanStaffApplication);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 1800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
