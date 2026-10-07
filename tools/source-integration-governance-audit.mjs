import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A regression contract for the repository's known automation authorities.
// GitHub's active ruleset remains the server-side enforcement authority.
export function auditGovernance(root) {
  const errors = [];
  const workflowDir = path.join(root, '.github/workflows');
  const read = (name) => fs.readFileSync(path.join(workflowDir, name), 'utf8');
  const workflows = fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));
  for (const name of workflows) {
    const source = read(name);
    if (/\bcontents:\s*write\b/.test(source)) errors.push(`${name}: workflow source write permission is forbidden`);
    if (/\bgit\s+(?:push|commit)\b/.test(source)) errors.push(`${name}: source changes require a reviewed PR`);
  }
  for (const name of ['publish-settings-pages.yml', 'operations-appearance-migration.yml', 'patch-messaging-firestore-rules.yml', 'flip-message-swipe.yml', 'activate-dashboard-leads-entry.yml']) {
    const source = read(name);
    if (!source.includes("branches-ignore: ['**']") || !source.includes("tags-ignore: ['**']") || !source.includes('if: ${{ false }}') || !source.includes('permissions: {}') || /\bworkflow_dispatch:/.test(source)) {
      errors.push(`${name}: historical source writer must remain inert`);
    }
  }
  for (const name of ['verify-studio-release-candidate-once.yml', 'firebase-production-release.yml', 'verify-trusted-studio-functions-production.yml', 'deploy-trusted-studio-functions-once.yml', 'design-system-visual-qa.yml']) {
    if (!read(name).includes('actions/upload-artifact@v4')) errors.push(`${name}: evidence artifact is required`);
  }
  const gate = read('canonical-pr-gate.yml');
  if (!gate.includes('ref: ${{ github.sha }}')) errors.push('Canonical PR Gate must validate the proposed integration commit');
  if (!gate.includes("node-version: '22'")) errors.push('Canonical PR Gate must use the supported Node.js runtime');
  if (/\bpaths(?:-ignore)?:/.test(gate)) errors.push('Canonical PR Gate must run for every canonical PR');
  if (!gate.includes('node tools/source-integration-governance-audit.mjs')) errors.push('Canonical PR Gate must validate governance');
  if (!gate.includes('node "tools/$audit"')) errors.push('Canonical PR Gate must validate source contracts');
  return { workflows: workflows.length, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditGovernance(process.cwd());
  for (const error of result.errors) console.error(error);
  console.log(`Source integration governance: ${result.workflows} workflows, ${result.errors.length} errors`);
  if (result.errors.length) process.exitCode = 1;
}
