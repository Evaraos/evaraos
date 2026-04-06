const ROLE_PERMISSIONS = {
  owner: ["all"],
  admin: ["dashboard", "companies", "users", "sales_reps", "leads", "jobs", "audit", "org", "performance"],
  manager: ["dashboard", "users", "sales_reps", "leads", "jobs", "performance"],
  sales_rep: ["dashboard", "leads"],
  tech: ["dashboard", "jobs"],
  customer: ["customer_dashboard"],
  guest: []
};

function hasPermission(section) {
  const role = localStorage.getItem("evaraos_role") || "guest";
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("all") || permissions.includes(section);
}

function protectPage(section) {
  if (!hasPermission(section)) {
    alert("You do not have access to this page.");
    window.location.href = "/evaraos/dashboard.html";
  }
}