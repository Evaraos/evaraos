#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const block = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

const submission = read("public", "assets", "js", "staff-application.js");
const statusJs = read("public", "assets", "js", "account-status.js");
const statusHtml = read("public", "account-status.html");
const rules = read("firebase", "firestore.rules");
const submit = block(submission, "async function handleSubmit", "function upgradePage");
const selfCreate = block(rules, "function selfCreate", "function selfUpdate");
const applications = block(rules, "match /staff_applications/{id}", "match /staff_profiles/{id}");

check(/ACCOUNT_STATUS_ROUTE/.test(submission) && /account-lifecycle\.js/.test(submission), "Submission must reuse the canonical account lifecycle route.");
check(/ACCOUNT_STATUS_ROUTE\}\?state=pending/.test(submit), "Submission must open shared pending account status.");
check(!/customer_dashboard|staff_application_status/.test(submit), "Pending applicants must not open an operational or duplicate status route.");
check(/companyId:"",companyName:""/.test(submit), "Pending applicant profiles must remain unassigned.");
check(!/companyName:value\("appDesiredCompany"\)/.test(submit), "Preferred company must not populate trusted profile assignment.");
check(!/firstName:value|middleName:value|lastName:value|staffApplicationStatus|staffApplicationRoleRequested/.test(submit), "User profile create contains unsupported applicant-only fields.");

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
console.log("Staff applicant lifecycle audit passed: shared status, own read, unassigned profile, and preference boundary verified.");
