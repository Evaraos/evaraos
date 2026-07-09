#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const {
  READ_ONLY_ACK
} = require('./lib/runtime-safety');
const {
  evaluateStagingReadiness
} = require('./lib/staging-readiness-policy');

function parseArgs(argv) {
  const args = {
    projectId: '',
    productionProjectId: 'evaraos-web',
    auditorEmail: '',
    acknowledgement: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--project') args.projectId = argv[++index] || '';
    else if (value === '--production-project') args.productionProjectId = argv[++index] || '';
    else if (value === '--auditor-email') args.auditorEmail = argv[++index] || '';
    else if (value === '--ack-read-only') args.acknowledgement = argv[++index] || '';
    else if (value === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }

  if (!args.auditorEmail && args.projectId) {
    args.auditorEmail = `evaraos-access-auditor@${args.projectId}.iam.gserviceaccount.com`;
  }

  return args;
}

function printHelp() {
  console.log(`EvaraOS Staging Readiness Verifier\n\nUsage:\n  node staging-readiness.js \\\n    --project <staging-project-id> \\\n    --ack-read-only ${READ_ONLY_ACK}\n\nThis verifier executes only gcloud describe, get-policy, and list commands.\nIt refuses the production project and refuses static credential-file authentication.\n`);
}

function assertLocalSafety(args) {
  if (!args.projectId) throw new Error('A staging project ID is required.');
  if (args.projectId === args.productionProjectId) {
    throw new Error('Production project is blocked by the staging verifier.');
  }
  if (args.acknowledgement !== READ_ONLY_ACK) {
    throw new Error(`Pass --ack-read-only ${READ_ONLY_ACK}`);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Static credential-file authentication is blocked.');
  }
}

function gcloudJson(operation, commandArgs, errors, fallback) {
  try {
    const output = execFileSync('gcloud', [...commandArgs, '--format=json', '--quiet'], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return output.trim() ? JSON.parse(output) : fallback;
  } catch (error) {
    errors.push({
      operation,
      code: String(error?.status ?? error?.code ?? 'unknown')
    });
    return fallback;
  }
}

function activeOperator(errors) {
  const accounts = gcloudJson(
    'active_operator',
    ['auth', 'list', '--filter=status:ACTIVE'],
    errors,
    []
  );
  return String(accounts?.[0]?.account || '');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  assertLocalSafety(args);

  const errors = [];
  const project = gcloudJson(
    'project_describe',
    ['projects', 'describe', args.projectId],
    errors,
    null
  );
  const projectPolicy = gcloudJson(
    'project_policy',
    ['projects', 'get-iam-policy', args.projectId],
    errors,
    { bindings: [] }
  );
  const serviceAccount = gcloudJson(
    'auditor_describe',
    [
      'iam', 'service-accounts', 'describe', args.auditorEmail,
      `--project=${args.projectId}`
    ],
    errors,
    null
  );
  const serviceAccountPolicy = gcloudJson(
    'auditor_policy',
    [
      'iam', 'service-accounts', 'get-iam-policy', args.auditorEmail,
      `--project=${args.projectId}`
    ],
    errors,
    { bindings: [] }
  );
  const keys = gcloudJson(
    'auditor_keys',
    [
      'iam', 'service-accounts', 'keys', 'list',
      `--iam-account=${args.auditorEmail}`,
      `--project=${args.projectId}`
    ],
    errors,
    []
  );
  const services = gcloudJson(
    'enabled_services',
    ['services', 'list', '--enabled', `--project=${args.projectId}`],
    errors,
    []
  );
  const operator = activeOperator(errors);

  const readiness = evaluateStagingReadiness({
    projectId: args.projectId,
    productionProjectId: args.productionProjectId,
    auditorEmail: args.auditorEmail,
    activeOperator: operator,
    project,
    projectPolicy,
    serviceAccount,
    serviceAccountPolicy,
    keys,
    services
  });

  console.log(JSON.stringify({
    ok: readiness.status === 'ready_for_staging_audit',
    readOnly: true,
    writesPerformed: 0,
    commandPolicy: 'describe_get_policy_and_list_only',
    readiness,
    readErrors: errors
  }, null, 2));

  if (readiness.status !== 'ready_for_staging_audit') process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error('Staging readiness verifier blocked execution:', error?.message || error);
  process.exitCode = 1;
}
