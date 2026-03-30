export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  operations_coordinator: "Operations Coordinator",
  hr: "HR",
  sales_rep: "Sales Rep",
  technician: "Technician",
  customer: "Customer"
};

export const ROLE_ACCESS = {
  super_admin: [
    "overview",
    "users",
    "leads",
    "sales_reps",
    "companies",
    "jobs",
    "customers",
    "settings",
    "audit"
  ],
  admin: [
    "overview",
    "users",
    "leads",
    "sales_reps",
    "companies",
    "jobs",
    "customers",
    "settings"
  ],
  manager: [
    "overview",
    "users",
    "leads",
    "sales_reps",
    "jobs",
    "customers"
  ],
  operations_coordinator: [
    "overview",
    "jobs",
    "customers"
  ],
  hr: [
    "overview",
    "users"
  ],
  sales_rep: [
    "overview",
    "leads"
  ],
  technician: [
    "overview",
    "jobs"
  ],
  customer: [
    "overview"
  ]
};

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function userIdentifiers(user = {}) {
  return new Set(
    [
      user.id,
      user.uid,
      user.email,
      user.username,
      user.handle,
      user.name
    ]
      .filter(Boolean)
      .map(normalize)
  );
}

export function getRoleLabel(role = "") {
  return ROLE_LABELS[role] || "User";
}

export function getAllowedSections(role = "") {
  return ROLE_ACCESS[role] || [];
}

export function canAccess(role = "", section = "") {
  if (!role || !section) return false;
  const allowed = ROLE_ACCESS[role] || [];
  return allowed.includes(section);
}

export function filterLeadsForUser(user, leads = []) {
  if (!user) return [];
  if (user.role === "super_admin" || user.role === "admin" || user.role === "manager") {
    return leads;
  }

  if (user.role === "sales_rep") {
    const ids = userIdentifiers(user);
    return leads.filter((lead) => {
      const values = [
        lead.assignedRep,
        lead.createdBy,
        lead.repId,
        lead.ownerId,
        lead.ownerEmail
      ]
        .filter(Boolean)
        .map(normalize);

      return values.some((value) => ids.has(value));
    });
  }

  if (user.role === "customer") {
    const ids = userIdentifiers(user);
    return leads.filter((lead) => {
      const values = [
        lead.customerId,
        lead.userId,
        lead.email,
        lead.customerEmail
      ]
        .filter(Boolean)
        .map(normalize);

      return values.some((value) => ids.has(value));
    });
  }

  return [];
}

export function filterJobsForUser(user, jobs = []) {
  if (!user) return [];
  if (
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "manager" ||
    user.role === "operations_coordinator"
  ) {
    return jobs;
  }

  if (user.role === "technician") {
    const ids = userIdentifiers(user);
    return jobs.filter((job) => {
      const directValues = [
        job.assignedTechnician,
        job.technicianId
      ]
        .filter(Boolean)
        .map(normalize);

      const crewValues = Array.isArray(job.assignedCrewIds)
        ? job.assignedCrewIds.map(normalize)
        : [];

      return [...directValues, ...crewValues].some((value) => ids.has(value));
    });
  }

  if (user.role === "customer") {
    const ids = userIdentifiers(user);
    return jobs.filter((job) => {
      const values = [
        job.customerId,
        job.userId,
        job.customerEmail,
        job.email
      ]
        .filter(Boolean)
        .map(normalize);

      return values.some((value) => ids.has(value));
    });
  }

  return [];
}

export function filterUsersForUser(user, users = []) {
  if (!user) return [];
  if (user.role === "super_admin" || user.role === "admin") {
    return users;
  }

  if (user.role === "manager" || user.role === "operations_coordinator" || user.role === "hr") {
    const companyId = normalize(user.companyId);
    return users.filter((candidate) => normalize(candidate.companyId) === companyId);
  }

  if (user.role === "sales_rep" || user.role === "technician" || user.role === "customer") {
    return users.filter((candidate) => candidate.id === user.id || candidate.uid === user.uid);
  }

  return [];
}