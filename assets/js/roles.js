const ROLE_PERMISSIONS = {
  owner: ["all"],
  admin: ["dashboard", "companies", "users", "sales_reps", "leads", "jobs", "audit", "org", "performance"],
  manager: ["dashboard", "users", "sales_reps", "leads", "jobs", "performance"],
  sales_rep: ["dashboard", "leads"],
  tech: ["dashboard", "jobs"],
  customer: ["customer_dashboard"],
  guest: []
};

function getRole() {
  return localStorage.getItem("evaraos_role") || "guest";
}

function hasPermission(section) {
  const role = getRole();
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("all") || permissions.includes(section);
}

function protectPage(section) {
  if (hasPermission(section)) return;

  const role = getRole();

  alert("You do not have access to this page.");

  if (role === "customer") {
    window.location.href = "/evaraos/customer_dashboard.html";
    return;
  }

  if (role === "guest") {
    window.location.href = "/evaraos/login.html";
    return;
  }

  window.location.href = "/evaraos/index.html";
}