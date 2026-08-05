#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const block = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const valuesFromRoleObjects = (source) => [...source.matchAll(/\{\s*value:\s*["']([^"']+)["']/g)].map((match) => match[1]);
const valuesFromSet = (source) => [...source.matchAll(/["']([a-z_]+)["']/g)].map((match) => match[1]);

const submission = read("public", "assets", "js", "staff-application.js");
const statusJs = read("public", "assets", "js", "account-status.js");
const statusHtml = read("public", "account-status.html");
const rules = read("firebase", "firestore.rules");
const approval = read("functions", "staff-approval.js");
const accessControl = read("public", "assets", "js", "access-control.js");
const submit = block(submission, "async function handleSubmit", "function upgradePage");
const selfCreate = block(rules, "function selfCreate", "function selfUpdate");
const applications = block(rules, "match /staff_applications/{id}", "match /staff_profiles/{id}");
const publicRoleRule = block(rules, "function publicStaffRole", "function selfCreate");
const publicRoleBlock = block(submission, "const AVAILABLE_STAFF_ROLES", "const form");
const trustedRoleBlock = block(approval, "const STAFF_ROLES", "const DECISIONS");
const aliasBlock = block(accessControl, "const ROLE_ALIASES", "const ALL_AUTHENTICATED");
const publicRoles = valuesFromRoleObjects(publicRoleBlock);
const rulesPublicRoles = new Set(valuesFromSet(publicRoleRule));
const trustedRoles = new Set(valuesFromSet(trustedRoleBlock));
const managerAliases = new Set(
  [...aliasBlock.matchAll(/^\s*([a-z_]+):\s*["']manager["']/gm)].map((match) => match[1])
);
const forbiddenPublicRoles = new Set([
  "platform_admin", "super_admin", "owner", "admin", "manager",
  "operations_manager", "operations_coordinator", "field_manager", "sales_manager",
  "dispatcher", "hr", "hr_manager", "customer_support", "customer_support_manager"
]);

check(/ACCOUNT_STATUS_ROUTE/.test(submission) && /account-lifecycle\.js/.test(submission), "Submission must reuse the canonical account lifecycle route.");
check(/ACCOUNT_STATUS_ROUTE\}\?state=pending/.test(submit), "Submission must open shared pending account status.");
check(!/customer_dashboard|staff_application_status/.test(submit), "Pending applicants must not open an operational or duplicate status route.");
check(/companyId:"",companyName:""/.test(submit), "Pending applicant profiles must remain unassigned.");
check(!/companyName:value\("appDesiredCompany"\)/.test(submit), "Preferred company must not populate trusted profile assignment.");
check(!/firstName:value|middleName:value|lastName:value|staffApplicationStatus|staffApplicationRoleRequested/.test(submit), "User profile create contains unsupported applicant-only fields.");

check(publicRoles.length > 0, "Public staff role catalog is empty.");
check(new Set(publicRoles).size === publicRoles.length, "Public staff role catalog contains duplicate roles.");
check(publicRoles.every((role) => trustedRoles.has(role)), "Every public role must be approvable by the trusted staff approval backend.");
check(publicRoles.every((role) => !forbiddenPublicRoles.has(role)), "Authority-bearing management, HR, admin, owner, or platform roles must not be publicly requestable.");
check(publicRoles.every((role) => !managerAliases.has(role)), "Public roles must not normalize to manager-level application access.");
check(!/lead_generator/.test(publicRoleBlock), "Unapprovable lead_generator role remains in the public catalog.");
check(/field_staff/.test(publicRoleBlock), "Public operational catalog should expose the trusted field_staff pathway.");
check(/Management, HR, administrative, and platform authority roles are assigned only through an authorized internal review\./.test(submission), "Public form must explain that authority roles require internal assignment.");
check(publicRoles.every((role) => rulesPublicRoles.has(role)) && rulesPublicRoles.size === publicRoles.length, "Firestore public-role allowlist must exactly match the browser catalog.");
check(/publicStaffRole\(request\.resource\.data\.roleRequested\)/.test(applications), "Application create must enforce the public role allowlist.");
check(/request\.resource\.data\.desiredRole == request\.resource\.data\.roleRequested/.test(applications), "Application create must require desiredRole to match roleRequested.");

check(!fs.existsSync(path.join(root, "public", "staff_application_status.html")), "Duplicate staff status page exists.");
check(!fs.existsSync(path.join(root, "public", "assets", "js", "staff-application-status.js")), "Duplicate staff status runtime exists.");
check(/staffApplicationStatusPanel/.test(statusHtml) && /account-status\.js\?v=2/.test(statusHtml), "Shared account status page is missing its optional staff application panel.");
check(/getDoc\(doc\(db, 'staff_applications', userId\)\)/.test(statusJs), "Status runtime must use one fixed own-document read.");
check(!/\b(?:collection|query|where|getDocs|addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/.test(statusJs), "Status runtime must not list or write Firestore records.");
check(/session\?\.userId/.test(statusJs), "Status read must be anchored to verified route-guard identity.");
check(/application\.desiredCompany/.test(statusJs) && /application\.companyName/.test(statusJs), "Status must distinguish preference from assignment.");

check(/companyId == ''/.test(selfCreate) && /companyName == ''/.test(selfCreate), "Self-created profiles must be unassigned.");
check(!/staffApplicationStatus|staffApplicationRoleRequested|firstName|middleName|lastName/.test(selfCreate), "Self-create schema must remain constrained.");
check(/allow read: if own\(id\)/.test(applications), "Applicants must retain own fixed-document read access.");
check(/hasAny\(\['companyId','companyName','assignmentStatus','assignedAt','assignedBy','assignedByName'\]\)/.test(applications), "Applicant-created applications must forbid assignment fields.");

if (failures.length) {
  console.error("Staff applicant lifecycle audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Staff applicant lifecycle audit passed: ${publicRoles.length} public operational roles are browser/rules aligned, trusted, non-managerial, and lifecycle-safe.`);
