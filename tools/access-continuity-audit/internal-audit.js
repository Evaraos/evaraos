#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { classifyAccount } = require('./lib/classify');

const READ_ONLY_ACK = 'I_UNDERSTAND_THIS_IS_READ_ONLY';
const DEFAULT_PAGE_SIZE = 500;

function parseArgs(argv) {
  const args = {
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    outputDir: path.resolve(process.cwd(), 'audit-output'),
    includeIdentifiers: false,
    ack: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--project') args.projectId = argv[++index] || '';
    else if (value === '--out') args.outputDir = path.resolve(argv[++index] || args.outputDir);
    else if (value === '--include-identifiers') args.includeIdentifiers = true;
    else if (value === '--ack-read-only') args.ack = argv[++index] || '';
    else if (value === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  console.log(`EvaraOS Access Continuity Preflight\n\nUsage:\n  node index.js --project <firebase-project-id> --ack-read-only ${READ_ONLY_ACK} [options]\n\nOptions:\n  --out <directory>          Local output directory (default: ./audit-output)\n  --include-identifiers      Include raw UID and email in local output\n  --help                     Show this help\n\nSafety:\n  This tool contains no Firestore, Authentication, or Claims mutation calls.\n  Run it with a service account limited to Firebase Authentication Viewer and Datastore Viewer.\n`);
}

function requireSafetyAcknowledgement(args) {
  if (args.ack !== READ_ONLY_ACK) {
    throw new Error(`Missing safety acknowledgement. Pass --ack-read-only ${READ_ONLY_ACK}`);
  }
  if (!args.projectId) throw new Error('A Firebase project ID is required.');
}

function hashIdentifier(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function safeIdentity(uid, email, includeIdentifiers) {
  if (includeIdentifiers) return { uid: uid || '', email: email || '' };
  return {
    uidHash: hashIdentifier(uid),
    emailHash: hashIdentifier(String(email || '').toLowerCase())
  };
}

async function listAuthUsers(auth) {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(DEFAULT_PAGE_SIZE, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

async function readCollectionMap(
  db,
  collectionName,
  keyResolver = (snapshot) => snapshot.id
) {
  const output = new Map();
  let last = null;

  while (true) {
    let query = db.collection(collectionName)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(DEFAULT_PAGE_SIZE);
    if (last) query = query.startAfter(last);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    snapshot.docs.forEach((document) => {
      const data = document.data() || {};
      const key = keyResolver(document, data);
      if (key) output.set(String(key), { id: document.id, ...data });
    });

    last = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < DEFAULT_PAGE_SIZE) break;
  }

  return output;
}

function groupApplicationsByUid(applications) {
  const grouped = new Map();
  applications.forEach((application, key) => {
    const uid = String(application.applicantUid || key || '');
    if (!uid) return;
    const existing = grouped.get(uid);
    const existingUpdated = Number(existing?.updatedAtMs || existing?.submittedAtMs || 0);
    const currentUpdated = Number(application.updatedAtMs || application.submittedAtMs || 0);
    if (!existing || currentUpdated >= existingUpdated) grouped.set(uid, application);
  });
  return grouped;
}

function duplicateEmailFindings(authUsers, profiles) {
  const index = new Map();
  const append = (email, uid, source) => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return;
    const values = index.get(normalized) || [];
    values.push({ uid, source });
    index.set(normalized, values);
  };

  authUsers.forEach((user) => append(user.email, user.uid, 'auth'));
  profiles.forEach((profile, uid) => append(profile.email, uid, 'profile'));

  return [...index.entries()]
    .map(([email, entries]) => ({
      email,
      entries,
      uniqueUids: [...new Set(entries.map((entry) => entry.uid))]
    }))
    .filter((item) => item.uniqueUids.length > 1);
}

function summaryOf(accounts, duplicates, sourceCounts) {
  const classifications = {};
  const findings = {};
  const canonicalRoles = {};
  let automaticMigrationEligible = 0;

  accounts.forEach((account) => {
    classifications[account.classification] = (
      classifications[account.classification] || 0
    ) + 1;
    const role = account.currentAccess.canonicalRole || 'unknown';
    canonicalRoles[role] = (canonicalRoles[role] || 0) + 1;
    if (account.automaticMigrationEligible) automaticMigrationEligible += 1;
    account.findings.forEach((finding) => {
      findings[finding.code] = (findings[finding.code] || 0) + 1;
    });
  });

  return {
    totalAccounts: accounts.length,
    automaticMigrationEligible,
    manualOrBlocked: accounts.length - automaticMigrationEligible,
    duplicateEmails: duplicates.length,
    classifications,
    canonicalRoles,
    findings,
    sourceCounts
  };
}

function toCsv(accounts) {
  const headers = [
    'identity',
    'classification',
    'automaticMigrationEligible',
    'browserAccess',
    'backendAccess',
    'detailedRole',
    'canonicalRole',
    'companyId',
    'platformAccess',
    'findingCodes',
    'recommendedAction'
  ];

  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = accounts.map((account) => [
    account.identity.uid || account.identity.uidHash || '',
    account.classification,
    account.automaticMigrationEligible,
    account.currentAccess.browser,
    account.currentAccess.backend,
    account.currentAccess.detailedRole,
    account.currentAccess.canonicalRole,
    account.currentAccess.companyId,
    account.currentAccess.platformAccess,
    account.findings.map((finding) => finding.code).join('|'),
    account.recommendedAction
  ].map(escape).join(','));

  return [headers.map(escape).join(','), ...rows].join('\n');
}

function writeReport(outputDir, report) {
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const timestamp = report.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `access-continuity-${timestamp}.json`);
  const csvPath = path.join(outputDir, `access-continuity-${timestamp}.csv`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(csvPath, `${toCsv(report.accounts)}\n`, { mode: 0o600 });
  return { jsonPath, csvPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  requireSafetyAcknowledgement(args);

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: args.projectId
  }, 'access-continuity-preflight');

  const app = admin.app('access-continuity-preflight');
  const auth = app.auth();
  const db = app.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const [authUsers, profiles, staffProfiles, rawApplications, companies] = await Promise.all([
    listAuthUsers(auth),
    readCollectionMap(db, 'users'),
    readCollectionMap(db, 'staff_profiles'),
    readCollectionMap(db, 'staff_applications'),
    readCollectionMap(db, 'companies')
  ]);

  const applications = groupApplicationsByUid(rawApplications);
  const authByUid = new Map(authUsers.map((user) => [user.uid, user]));
  const uids = new Set([...authByUid.keys(), ...profiles.keys()]);
  const accounts = [];

  [...uids].sort().forEach((uid) => {
    const authUser = authByUid.get(uid) || null;
    const profile = profiles.get(uid) || null;
    const result = classifyAccount({
      uid,
      authUser,
      profile,
      staffProfile: staffProfiles.get(uid) || null,
      application: applications.get(uid) || null,
      companies
    });

    accounts.push({
      identity: safeIdentity(
        uid,
        authUser?.email || profile?.email || '',
        args.includeIdentifiers
      ),
      classification: result.classification,
      automaticMigrationEligible: result.automaticMigrationEligible,
      currentAccess: result.currentAccess,
      findings: result.findings,
      recommendedAction: result.recommendedAction
    });
  });

  const duplicateEmails = duplicateEmailFindings(authUsers, profiles).map((duplicate) => ({
    email: args.includeIdentifiers ? duplicate.email : undefined,
    emailHash: hashIdentifier(duplicate.email),
    accounts: duplicate.uniqueUids.map((uid) => (
      args.includeIdentifiers ? { uid } : { uidHash: hashIdentifier(uid) }
    ))
  }));

  const report = {
    schemaVersion: 1,
    auditType: 'access_continuity_preflight',
    generatedAt: new Date().toISOString(),
    projectId: args.projectId,
    readOnly: true,
    writesPerformed: 0,
    identifiersIncluded: args.includeIdentifiers,
    summary: summaryOf(accounts, duplicateEmails, {
      authenticationUsers: authUsers.length,
      userProfiles: profiles.size,
      staffProfiles: staffProfiles.size,
      staffApplications: applications.size,
      companies: companies.size
    }),
    duplicateEmails,
    accounts
  };

  const paths = writeReport(args.outputDir, report);
  console.log(JSON.stringify({
    ok: true,
    readOnly: true,
    writesPerformed: 0,
    summary: report.summary,
    output: paths
  }, null, 2));
}

main().catch((error) => {
  console.error(
    'Access continuity preflight failed:',
    error?.stack || error?.message || error
  );
  process.exitCode = 1;
});
