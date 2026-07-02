const ENTRY_BODY = ".login-page,.signup-page,.staff-application-page";

const ICONS = {
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21c1-4.2 3.4-6.3 7-6.3s6 2.1 7 6.3"/>',
  email:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  at:'<circle cx="12" cy="12" r="8"/><path d="M15.5 15.5c-1 .8-2.2 1.3-3.5 1.3a4.8 4.8 0 1 1 4.8-4.8v1.7c0 1.1.8 1.8 1.8 1.8 1.5 0 2.4-1.4 2.4-3.5A9 9 0 1 0 18 18.8"/><circle cx="12" cy="12" r="2.5"/>',
  phone:'<path d="M7.2 3.5 10 8l-2.1 2.2c1.4 2.7 3.4 4.8 6.1 6.1l2.2-2.1 4.3 2.8c.4.3.6.8.4 1.3-.6 1.8-2.2 2.9-4 2.7C9.7 20.2 3.8 14.3 3 7.1c-.2-1.8.9-3.4 2.7-4 .5-.2 1 .1 1.5.4Z"/>',
  map:'<path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  briefcase:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6M3 11h18"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  building:'<path d="M4 21V5h10v16M14 9h6v12M7 8h4M7 12h4M7 16h4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>'
};

function svg(name, className="entry-icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.check}</svg>`;
}

function iconFor(input) {
  const id = (input?.id || "").toLowerCase();
  const type = (input?.type || "").toLowerCase();
  if (type === "email" || id.includes("email")) return "email";
  if (type === "password" || id.includes("password")) return "lock";
  if (type === "tel" || id.includes("phone")) return "phone";
  if (type === "date" || id.includes("dob")) return "calendar";
  if (type === "file" || id.includes("resume") || id.includes("idfront") || id.includes("idback")) return "file";
  if (id.includes("username")) return "at";
  if (id.includes("company")) return "building";
  if (id.includes("role") || id.includes("experience") || id.includes("workauth")) return "briefcase";
  if (id.includes("city") || id.includes("state") || id.includes("zip") || id.includes("address") || id.includes("market")) return "map";
  if (id.includes("availability") || id.includes("transportation") || id.includes("license")) return "clock";
  return "user";
}

function enhanceLabels(root) {
  root.querySelectorAll("label[for]").forEach(label => {
    if (label.dataset.entryEnhanced === "true") return;
    const input = document.getElementById(label.htmlFor);
    if (!input) return;
    label.dataset.entryEnhanced = "true";
    label.classList.add("entry-label");
    label.insertAdjacentHTML("afterbegin", svg(iconFor(input), "entry-label-icon"));
  });
}

function addTrustRow(panel, variant) {
  if (!panel || panel.querySelector(".entry-trust-row")) return;
  const subtitle = panel.querySelector(".login-subtitle,.application-copy");
  if (!subtitle) return;
  const items = variant === "apply"
    ? [["shield","Secure review"],["briefcase","Role-based access"],["clock","Application status"]]
    : [["shield","Protected sign-in"],["check","Adaptive access"],["building","One connected workspace"]];
  const row = document.createElement("div");
  row.className = "entry-trust-row";
  row.innerHTML = items.map(([icon,text]) => `<span>${svg(icon,"entry-trust-icon")}<b>${text}</b></span>`).join("");
  subtitle.insertAdjacentElement("afterend", row);
}

function addPasswordStrength() {
  const input = document.getElementById("signupPassword");
  if (!input || document.getElementById("signupPasswordStrength")) return;
  const meter = document.createElement("div");
  meter.id = "signupPasswordStrength";
  meter.className = "password-strength";
  meter.setAttribute("aria-live", "polite");
  meter.innerHTML = '<span class="password-strength-bar"><i></i></span><small>Use 8+ characters with a number and symbol.</small>';
  input.closest(".form-group")?.appendChild(meter);
  const update = () => {
    const value = input.value;
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    meter.dataset.score = String(score);
    const labels = ["Add a stronger password.","Fair start.","Good password.","Strong password.","Excellent password."];
    meter.querySelector("small").textContent = value ? labels[score] : "Use 8+ characters with a number and symbol.";
  };
  input.addEventListener("input", update);
  update();
}

function enhanceFiles(root) {
  root.querySelectorAll('input[type="file"]').forEach(input => {
    if (input.dataset.entryEnhanced === "true") return;
    input.dataset.entryEnhanced = "true";
    const status = document.createElement("small");
    status.className = "entry-file-status";
    status.textContent = "No file selected";
    input.insertAdjacentElement("afterend", status);
    input.addEventListener("change", () => {
      status.textContent = input.files?.length ? Array.from(input.files).map(file => file.name).join(", ") : "No file selected";
      status.classList.toggle("has-file", !!input.files?.length);
    });
  });
}

function enhanceApplicationSections(root) {
  const icons = ["briefcase","user","clock","file","shield"];
  root.querySelectorAll(".form-section-title").forEach((heading,index) => {
    if (heading.dataset.entryEnhanced === "true") return;
    heading.dataset.entryEnhanced = "true";
    heading.innerHTML = `<span class="entry-section-number">${String(index+1).padStart(2,"0")}</span><span class="entry-section-icon">${svg(icons[index] || "check")}</span><span>${heading.textContent.trim()}</span>`;
  });
}

function enhancePage() {
  const body = document.body;
  if (!body?.matches(ENTRY_BODY) || body.dataset.onboardingEnhanced === "true") return;
  body.dataset.onboardingEnhanced = "true";
  enhanceLabels(body);
  if (body.classList.contains("login-page")) addTrustRow(body.querySelector(".login-panel"), "auth");
  if (body.classList.contains("signup-page")) {
    addTrustRow(body.querySelector(".login-panel"), "auth");
    addPasswordStrength();
  }
  if (body.classList.contains("staff-application-page")) {
    addTrustRow(body.querySelector(".application-hero article"), "apply");
    enhanceApplicationSections(body);
    enhanceFiles(body);
  }
}

export function installOnboardingEntry() {
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", enhancePage, { once:true })
    : enhancePage();
}

if (typeof window !== "undefined") installOnboardingEntry();
