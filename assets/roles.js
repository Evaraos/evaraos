export const ROLE_CONFIG = {
  super_admin: {
    label: "Super Admin",
    scope: "global",
    sections: ["overview", "users", "leads", "sales_reps", "companies", "jobs", "customers", "settings", "audit"],
    actions: ["all"]
  },
  admin: {
    label: "Admin",
    scope: "company",
    sections: ["overview", "users", "leads", "sales_reps", "companies", "jobs", "customers", "settings"],
    actions: [
      "view_all_company_data",
      "create_lead",
      "edit_any_company_lead",
      "assign_lead",
      "archive_lead",
      "request_delete_lead",
      "approve_delete_lead",
      "convert_lead",
      "view_jobs",
      "edit_jobs",
      "view_users"
    ]
  },
  manager: {
    label: "Manager",
    scope: "company",
    sections: ["overview", "leads", "sales_reps", "jobs", "customers"],
    actions: [
      "create_lead",
      "edit_any_company_lead",
      "assign_lead",
      "archive_lead",
      "request_delete_lead",
      "convert_lead",
      "view_jobs",
      "edit_jobs"
    ]
  },
  operations_coordinator: {
    label: "Operations Coordinator",
    scope: "company",
    sections: ["overview", "jobs", "customers"],
    actions: ["view_jobs", "edit_jobs"]
  },
  sales_rep: {
    label: "Sales Rep",
    scope: "self",
    sections: ["overview", "leads", "customers"],
    actions: [
      "create_lead",
      "edit_own_lead",
      "archive_own_lead",
      "request_delete_own_lead",
      "convert_own_lead"
    ]
  },
  technician: {
    label: "Technician",
    scope: "assigned_jobs",
    sections: ["overview", "jobs"],
    actions: ["view_assigned_jobs", "edit_assigned_jobs"]
  },
  hr: {
    label: "HR",
    scope: "company",
    sections: ["overview", "users"],
    actions: ["view_users"]
  },
  customer: {
    label: "Customer",
    scope: "self",
    sections: ["overview"],
    actions: ["view_self"]
  }
};

export function getRoleConfig(role) {
  return ROLE_CONFIG[role] || ROLE_CONFIG.customer;
}

export function getRoleLabel(role) {
  return getRoleConfig(role).label;
}

export function getAllowedSections(role) {
  return getRoleConfig(role).sections;
}

export function canAccess(role, section) {
  return getAllowedSections(role).includes(section);
}

export function canPerform(userOrRole, action) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  const actions = getRoleConfig(role).actions || [];
  return actions.includes("all") || actions.includes(action);
}

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function userMatchSet(user) {
  return new Set([
    normalizeValue(user?.id),
    normalizeValue(user?.uid),
    normalizeValue(user?.email),
    normalizeValue(user?.username),
    normalizeValue(user?.handle),
    normalizeValue(user?.name)
  ]);
}

function recordFieldValues(record) {
  return [
    normalizeValue(record?.assignedRep),
    normalizeValue(record?.createdBy),
    normalizeValue(record?.repId),
    normalizeValue(record?.ownerId),
    normalizeValue(record?.ownerEmail)
  ];
}

export function recordMatchesUser(record, user) {
  const userSet = userMatchSet(user);
  return recordFieldValues(record).some((value) => value && userSet.has(value));
}

export function jobMatchesTechnician(job, user) {
  const userSet = userMatchSet(user);
  const direct = [
    normalizeValue(job?.assignedTechnician),
    normalizeValue(job?.technicianId)
  ];
  const crew = Array.isArray(job?.assignedCrewIds) ? job.assignedCrewIds.map(normalizeValue) : [];
  return [...direct, ...crew].some((value) => value && userSet.has(value));
}

export function canSeeLead(user, lead) {
  if (!user || !lead) return false;
  if (user.role === "super_admin") return true;

  const sameCompany = normalizeValue(user.companyId) === normalizeValue(lead.companyId);

  if (user.role === "admin" || user.role === "manager") return sameCompany;
  if (user.role === "sales_rep") return sameCompany && recordMatchesUser(lead, user);

  return false;
}

export function canEditLead(user, lead) {
  if (!user || !lead) return false;
  if (canPerform(user, "all")) return true;
  if (user.role === "admin" || user.role === "manager") {
    return normalizeValue(user.companyId) === normalizeValue(lead.companyId);
  }
  if (user.role === "sales_rep") {
    return canPerform(user, "edit_own_lead") && canSeeLead(user, lead);
  }
  return false;
}

export function canAssignLead(user) {
  return canPerform(user, "assign_lead");
}

export function canArchiveLead(user, lead) {
  if (!user || !lead) return false;
  if (user.role === "admin" || user.role === "manager") return canSeeLead(user, lead);
  if (user.role === "sales_rep") return canPerform(user, "archive_own_lead") && canSeeLead(user, lead);
  return false;
}

export function canRequestLeadDelete(user, lead) {
  if (!user || !lead) return false;
  if (user.role === "admin" || user.role === "manager") return canSeeLead(user, lead);
  if (user.role === "sales_rep") return canPerform(user, "request_delete_own_lead") && canSeeLead(user, lead);
  return false;
}

export function canApproveLeadDelete(user) {
  return canPerform(user, "approve_delete_lead");
}

export function canConvertLead(user, lead) {
  if (!user || !lead) return false;
  if (user.role === "admin" || user.role === "manager") return canSeeLead(user, lead);
  if (user.role === "sales_rep") return canPerform(user, "convert_own_lead") && canSeeLead(user, lead);
  return false;
}

export function canSeeJob(user, job) {
  if (!user || !job) return false;
  if (user.role === "super_admin") return true;

  const sameCompany = normalizeValue(user.companyId) === normalizeValue(job.companyId);

  if (user.role === "admin" || user.role === "manager" || user.role === "operations_coordinator") {
    return sameCompany;
  }
  if (user.role === "sales_rep") {
    return sameCompany && recordMatchesUser(job, user);
  }
  if (user.role === "technician") {
    return sameCompany && jobMatchesTechnician(job, user);
  }

  return false;
}

export function canEditJob(user, job) {
  if (!user || !job) return false;
  if (user.role === "admin" || user.role === "manager" || user.role === "operations_coordinator") {
    return canSeeJob(user, job);
  }
  if (user.role === "technician") {
    return canPerform(user, "edit_assigned_jobs") && canSeeJob(user, job);
  }
  return false;
}

export function canSeeUserRecord(user, record) {
  if (!user || !record) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "admin" || user.role === "hr") {
    return normalizeValue(user.companyId) === normalizeValue(record.companyId);
  }
  return normalizeValue(user.id || user.uid) === normalizeValue(record.id || record.uid);
}

export function filterLeadsForUser(user, leads = []) {
  return leads.filter((lead) => canSeeLead(user, lead));
}

export function filterJobsForUser(user, jobs = []) {
  return jobs.filter((job) => canSeeJob(user, job));
}

export function filterUsersForUser(user, users = []) {
  return users.filter((record) => canSeeUserRecord(user, record));
}