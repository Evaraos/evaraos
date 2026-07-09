#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  PRODUCTION_ACK,
  READ_ONLY_ACK,
  assertRuntimeSafety
} = require('./lib/runtime-safety');

function parseSafetyArgs(argv) {
  const args = {
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    environment: '',
    includeIdentifiers: false,
    ack: '',
    productionAck: ''
  };
  const forwarded = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--environment') {
      args.environment = argv[++index] || '';
      continue;
    }

    if (value === '--ack-production-read-only') {
      args.productionAck = argv[++index] || '';
      continue;
    }

    if (value === '--project') {
      const projectId = argv[++index] || '';
      args.projectId = projectId;
      forwarded.push(value, projectId);
      continue;
    }

    if (value === '--ack-read-only') {
      const acknowledgement = argv[++index] || '';
      args.ack = acknowledgement;
      forwarded.push(value, acknowledgement);
      continue;
    }

    if (value === '--include-identifiers') {
      args.includeIdentifiers = true;
      forwarded.push(value);
      continue;
    }

    forwarded.push(value);
  }

  return { args, forwarded };
}

function printHelp() {
  console.log(`EvaraOS Access Continuity Preflight\n\nUsage:\n  node index.js --project <firebase-project-id> --environment <staging|production> --ack-read-only ${READ_ONLY_ACK} [options]\n\nProduction also requires:\n  --ack-production-read-only ${PRODUCTION_ACK}\n\nSafety:\n  - Static service-account key files are blocked.\n  - Production runs always hash identifiers.\n  - Use short-lived service-account impersonation only.\n`);
}

const argv = process.argv.slice(2);
if (argv.includes('--help')) {
  printHelp();
  process.exit(0);
}

try {
  const { args, forwarded } = parseSafetyArgs(argv);
  const safety = assertRuntimeSafety(args, process.env);

  process.env.EVARAOS_AUDIT_ENVIRONMENT = safety.environment;
  process.env.EVARAOS_AUDIT_CREDENTIAL_MODE = safety.credentialMode;
  process.argv = [
    process.argv[0],
    path.join(__dirname, 'internal-audit.js'),
    ...forwarded
  ];

  require('./internal-audit');
} catch (error) {
  console.error('Audit safety gate blocked execution:', error?.message || error);
  process.exitCode = 1;
}
