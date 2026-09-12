#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const browserRoot = path.join(repoRoot, "public", "assets", "js");
const functionsRoot = path.join(repoRoot, "functions");
const applicationsPath = path.join(browserRoot, "applications.js");
const approvalFunctionPath = path.join(functionsRoot, "staff-approval.js");
const rulesPath = path.join(repoRoot, "firebase", "firestore.rules");

const failures = [];

function relative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    failures.push(`Missing canonical file: ${relative(filePath)}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) return "";
  return source.slice(start, end);
}

const browserFiles = walk(browserRoot).filter((file) => file.endsWith(".js"));
const functionFiles = walk(functionsRoot).filter((file) => file.endsWith(".js"));
const browserSources = browserFiles.map((file) => ({ file, source: read(file) }));
const functionSources = functionFiles.map((file) => ({ file, source: read(file) }));

const applications = read(applicationsPath);
const approvalFunction = read(approvalFunctionPath);
const rules = read(rulesPath);

const obsoleteRuntimes = browserFiles.filter((file) => path.basename(file) === "applications-approval.js");
assert(
  obsoleteRuntimes.length === 0,
  `Obsolete duplicate staff-approval runtime exists: ${obsoleteRuntimes.map(relative).join(", ")}`
);

const browserCallableRuntimes = browserSources.filter(({ source }) => (
  /httpsCallable\s*\(\s*functions\s*,\s*["']reviewStaffApplication["']\s*\)/.test(source)
));
assert(
  browserCallableRuntimes.length === 1 && relative(browserCallableRuntimes[0]?.file || "") === "public/assets/js/applications.js",
  `Expected exactly one canonical browser review runtime at public/assets/js/applications.js; found: ${browserCallableRuntimes.map(({ file }) => relative(file)).join(", ") || "none"}`
);

const backendDefinitions = functionSources.filter(({ source }) => (
  /\bexports\.reviewStaffApplication\s*=\s*onCall\s*\(/.test(source)
));
assert(
  backendDefinitions.length === 1 && relative(backendDefinitions[0]?.file || "") === "functions/staff-approval.js",
  `Expected exactly one reviewStaffApplication callable definition at functions/staff-approval.js; found: ${backendDefinitions.map(({ file }) => relative(file)).join(", ") || "none"}`
);

const backendEntrypointWiring = functionSources.filter(({ source }) => (
  /\bexports\.reviewStaffApplication\s*=\s*require\(["']\.\/staff-approval["']\)\.reviewStaffApplication\s*;/.test(source)
));
assert(
  backendEntrypointWiring.length === 1 && relative(backendEntrypointWiring[0]?.file || "") === "functions/index-stats.js",
  `Expected exactly one reviewStaffApplication entrypoint wiring at functions/index-stats.js; found: ${backendEntrypointWiring.map(({ file }) => relative(file)).join(", ") || "none"}`
);

assert(
  /const reviewStaffApplication = httpsCallable\s*\(\s*functions\s*,\s*["']reviewStaffApplication["']\s*\)/.test(applications),
  "applications.js must call the trusted reviewStaffApplication callable."
);

const browserWritePrimitive = /\b(?:addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(|\b(?:batch|transaction)\.(?:set|update|delete)\s*\(/;
const approvalMutationField = /\b(?:approvedAt|approvedBy|approvedRole|finalRole|reviewedAt|reviewedBy|reviewerRole|staff_profiles)\b/;
const directApprovalWriters = browserSources.filter(({ source }) => (
  /staff_applications/.test(source)
  && approvalMutationField.test(source)
  && browserWritePrimitive.test(source)
));
assert(
  directApprovalWriters.length === 0,
  `Browser code directly writes approval records: ${directApprovalWriters.map(({ file }) => relative(file)).join(", ")}`
);

assert(
  !browserWritePrimitive.test(applications),
  "applications.js must not contain Firestore write primitives."
);

assert(
  /const PLATFORM_ROLES = new Set\(\["owner", "super_admin", "platform_admin"\]\);/.test(applications),
  "Browser platform authority must be limited to owner, platform_admin and the legacy super_admin alias."
);
assert(
  !/role\s*===\s*["']admin["'][\s\S]{0,100}platformAccess/.test(applications),
  "Admin must not gain platform-wide browser approval authority through platformAccess."
);
assert(
  /function isPlatformReviewer\(profile = \{\}\) \{\s*return PLATFORM_ROLES\.has\(normalize\(profile\.role\)\);\s*\}/.test(applications),
  "applications.js must use the canonical owner/super_admin platform authority check."
);
assert(
  /const applicationsQuery = platformScope\s*\?\s*applicationsRef\s*:\s*query\(applicationsRef, where\("companyId", "==", companyId\)\);/.test(applications),
  "Admin-and-below application reads must be filtered to the reviewer's assigned company."
);
assert(
  /if \(!platformScope && !companyId\)/.test(applications),
  "Admin-and-below reviewers must have an assigned company before loading applications."
);

assert(
  /data-decision="assigned"/.test(applications),
  "The canonical Applications UI must expose owner-controlled company assignment."
);
assert(
  /decision === "assigned" && !isPlatformReviewer\(currentProfile\)/.test(applications),
  "The browser assignment control must be limited to owner/super_admin."
);
assert(
  /const companyDecision = \["approved", "assigned"\]\.includes\(decision\);/.test(applications),
  "Company assignment and approval must use the same trusted callable payload path."
);

assert(
  /function platformReviewer\(user = \{\}\) \{\s*return isPlatformReviewer\(user\);\s*\}/.test(approvalFunction),
  "Backend platform authority must be limited to owner, platform_admin and the legacy super_admin alias."
);
assert(
  !/role\s*===\s*["']admin["'][\s\S]{0,100}platformAccess/.test(approvalFunction),
  "Admin must not gain platform-wide backend approval authority through platformAccess."
);
assert(
  /if \(platformReviewer\(reviewer\)\) return;/.test(approvalFunction),
  "Owner/super_admin must bypass company restrictions in the canonical backend scope check."
);
assert(
  /if \(companyId && companyId !== reviewerCompanyId\)/.test(approvalFunction),
  "Admin-and-below must not assign applicants outside their assigned company."
);
assert(
  /if \(!applicationCompanyId \|\| applicationCompanyId !== reviewerCompanyId\)/.test(approvalFunction),
  "Admin-and-below must only review applications already assigned to their company."
);

assert(
  /const DECISIONS = new Set\(\["assigned", "approved", "rejected", "needs_more_info"\]\);/.test(approvalFunction),
  "The canonical callable must own the assignment transition."
);
assert(
  /if \(decision === "assigned" && !platformReviewer\(reviewer\)\)/.test(approvalFunction),
  "Only owner/super_admin may assign or reassign an application."
);
assert(
  /action: "staff_application_assigned"/.test(approvalFunction)
    && /assignmentStatus: "assigned"/.test(approvalFunction),
  "Trusted assignment must persist assignment state and an audit event."
);
assert(
  /function canonicalCompany\(snapshot, companyId\)/.test(approvalFunction)
    && /companyData\.name \|\| companyData\.companyName \|\| companyId/.test(approvalFunction),
  "Company names must come from the canonical company document."
);
assert(
  !/requestedCompanyName/.test(approvalFunction),
  "The backend must not trust a browser-supplied company name."
);

const forbiddenAssignedRoles = [
  "owner",
  "super_admin",
  "admin",
  "manager",
  "hr",
  "hr_manager",
  "operations_manager",
  "operations_coordinator",
  "dispatcher",
  "field_manager",
  "sales_manager",
  "customer_support"
];
const browserRoleBlock = blockBetween(applications, "const STAFF_ROLES", "const reviewStaffApplication");
const backendRoleBlock = blockBetween(approvalFunction, "const STAFF_ROLES", "const DECISIONS");
for (const role of forbiddenAssignedRoles) {
  const quotedRole = new RegExp(`["']${role}["']`);
  assert(!quotedRole.test(browserRoleBlock), `Elevated role remains assignable in applications.js: ${role}`);
  assert(!quotedRole.test(backendRoleBlock), `Elevated role remains assignable in staff-approval.js: ${role}`);
}

assert(
  /const CLAIM_SYNC_ATTEMPTS = 3;/.test(approvalFunction)
    && /for \(let attempt = 1; attempt <= CLAIM_SYNC_ATTEMPTS; attempt \+= 1\)/.test(approvalFunction)
    && /claimsSyncStatus: "pending_retry"/.test(approvalFunction)
    && /throw new HttpsError\(\s*"unavailable"/.test(approvalFunction),
  "Staff claim synchronization must retry deterministically and surface an incomplete activation state."
);
assert(
  /if \(applicationStatus === "rejected"\)/.test(approvalFunction)
    && /This application has already been finalized\./.test(approvalFunction),
  "Rejected applications must remain finalized."
);
assert(
  /if \(applicationStatus === "approved"\)/.test(approvalFunction)
    && /Claim retries must preserve the approved role and company\./.test(approvalFunction)
    && /staff_claims_sync_retry_requested/.test(approvalFunction)
    && /alreadySynced/.test(approvalFunction),
  "Approved applications must allow only idempotent same-role, same-company claim convergence."
);
assert(
  /if \(\["approved", "rejected"\]\.includes\(applicationStatus\)\)/.test(approvalFunction),
  "Company reassignment must be blocked after finalization."
);
assert(
  !/exports\.(?:retry|sync)StaffClaims\s*=\s*onCall/.test(approvalFunction),
  "Claim convergence must reuse reviewStaffApplication rather than adding a second privileged callable."
);

assert(
  /function platform\(\) \{ return active\(\) && role\(\) in \['owner', 'super_admin', 'platform_admin'\]; \}/.test(rules),
  "Firestore platform authority must be limited to owner, platform_admin and the legacy super_admin alias."
);
assert(
  !/function platform\(\)[\s\S]{0,180}role\(\) == 'admin'[\s\S]{0,80}platformAccess/.test(rules),
  "Firestore rules must not grant platform authority to admin through platformAccess."
);

const staffApplicationsRules = blockBetween(
  rules,
  "match /staff_applications/{id}",
  "match /staff_profiles/{id}"
);
assert(
  /allow read: if own\(id\) \|\| platform\(\) \|\| \(operations\(\) && sameCompany\(resource\.data\.companyId\)\);/.test(staffApplicationsRules),
  "Firestore staff application reads must keep admin-and-below company-scoped."
);
assert(
  /!request\.resource\.data\.keys\(\)\.hasAny\(\['companyId','companyName','assignmentStatus','assignedAt','assignedBy','assignedByName'\]\)/.test(staffApplicationsRules),
  "Applicant-created staff applications must be explicitly unassigned."
);
assert(
  /allow update: if own\(id\)/.test(staffApplicationsRules)
    && !/allow update: if (?:platform|operations|manager)\(/.test(staffApplicationsRules),
  "Firestore must not allow leadership browser approval or assignment writes."
);
assert(
  /match \/staff_profiles\/\{id\} \{[\s\S]*?allow write: if false;/.test(rules),
  "Firestore staff profile writes must remain backend-only."
);

if (failures.length) {
  console.error("Staff approval contract audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Staff approval contract audit passed.");
console.log("- One canonical browser runtime calls reviewStaffApplication.");
console.log("- One canonical backend callable is wired through the Functions entrypoint.");
console.log("- Applicant submissions remain unassigned and browser assignment writes are blocked.");
console.log("- Owner/platform_admin (including legacy super_admin) own trusted company assignment and remain platform-wide.");
console.log("- Admin-and-below read and review only their assigned company.");
console.log("- Elevated role assignment and repeat finalization are blocked.");
console.log("- Approved claim synchronization remains retryable, idempotent, and assignment-preserving.");
