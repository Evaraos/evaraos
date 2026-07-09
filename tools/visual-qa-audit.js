#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

const requiredFiles = [
  '.github/workflows/design-system-visual-qa.yml',
  '.gitignore',
  'public/qa-v2.html',
  'public/assets/css/pages/qa-v2.css',
  'public/assets/js/qa-v2.js',
  'public/assets/js/access-control.js',
  'tests/visual/package.json',
  'tests/visual/playwright.config.mjs',
  'tests/visual/visual-matrix.mjs',
  'tests/visual/global-setup.mjs',
  'tests/visual/specs/authenticated-visual.spec.mjs',
  'tests/visual/specs/studio-interactions.spec.mjs',
  'tests/visual/README.md'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required visual QA asset is missing`);
}

if (!errors.length) {
  const workflow = read('.github/workflows/design-system-visual-qa.yml');
  const gitignore = read('.gitignore');
  const qaPage = read('public/qa-v2.html');
  const qaRuntime = read('public/assets/js/qa-v2.js');
  const access = read('public/assets/js/access-control.js');
  const config = read('tests/visual/playwright.config.mjs');
  const matrix = read('tests/visual/visual-matrix.mjs');
  const setup = read('tests/visual/global-setup.mjs');
  const spec = read('tests/visual/specs/authenticated-visual.spec.mjs');
  const studioSpec = read('tests/visual/specs/studio-interactions.spec.mjs');
  const packageJson = JSON.parse(read('tests/visual/package.json'));

  if (packageJson.devDependencies?.['@playwright/test'] !== '1.61.1') {
    errors.push('tests/visual/package.json: Playwright must remain pinned to the reviewed 1.61.1 release');
  }

  for (const project of ['desktop-chromium', 'tablet-chromium', 'iphone-webkit', 'android-chromium']) {
    if (!config.includes(`name: '${project}'`)) errors.push(`tests/visual/playwright.config.mjs: missing ${project} project`);
  }

  for (const role of ['platform_admin', 'owner', 'admin', 'manager', 'sales', 'technician', 'cleaner', 'customer', 'vendor']) {
    if (!matrix.includes(`id: '${role}'`)) errors.push(`tests/visual/visual-matrix.mjs: missing ${role} role`);
  }

  if (!matrix.includes("id: 'owner'") || !matrix.includes('required: true')) {
    errors.push('tests/visual/visual-matrix.mjs: owner credentials must remain mandatory');
  }

  for (const appearance of ['light', 'dark', 'system', 'image']) {
    if (!matrix.includes(`id: '${appearance}'`)) errors.push(`tests/visual/visual-matrix.mjs: missing ${appearance} appearance`);
  }

  for (const requiredSetupContract of [
    "page.goto('/login.html'",
    "page.locator('#loginEmail')",
    "page.locator('#loginPassword')",
    'indexedDB: true',
    'credentialsFor(role)',
    'missingRequired',
    'role.required'
  ]) {
    if (!setup.includes(requiredSetupContract)) errors.push(`tests/visual/global-setup.mjs: missing secure setup contract ${requiredSetupContract}`);
  }

  if (/bypass|disableAuth|mockAuth|fakeUser/i.test(setup)) {
    errors.push('tests/visual/global-setup.mjs: authentication bypass language or hooks are not allowed');
  }

  for (const testContract of [
    'toHaveScreenshot',
    'horizontalOverflow',
    "page.on('pageerror'",
    'duplicateIds',
    "page.keyboard.press('Tab')",
    'storageStatePath'
  ]) {
    if (!spec.includes(testContract)) errors.push(`tests/visual/specs/authenticated-visual.spec.mjs: missing ${testContract} coverage`);
  }

  for (const studioContract of [
    "page.goto('/website-builder.html'",
    'data-catalog-search',
    'data-add-component="notice-banner"',
    'data-property-field="title"',
    'data-action="undo"',
    'data-action="redo"',
    'data-layout-tool="layers"',
    'data-auto-layout-tool',
    'data-journal-action="checkpoint"',
    'studio-initial.png',
    'studio-validated.png',
    'storageStatePath'
  ]) {
    if (!studioSpec.includes(studioContract)) errors.push(`tests/visual/specs/studio-interactions.spec.mjs: missing ${studioContract} coverage`);
  }

  if (!studioSpec.includes("localStorage.removeItem('evaraos-studio-visual-builder-v1')")) {
    errors.push('tests/visual/specs/studio-interactions.spec.mjs: Studio validation must start from a clean browser-local draft');
  }
  if (/localStorage\.clear\s*\(/.test(studioSpec)) {
    errors.push('tests/visual/specs/studio-interactions.spec.mjs: validation must not clear unrelated authentication or appearance state');
  }

  if (!workflow.includes('workflow_dispatch:')) errors.push('.github/workflows/design-system-visual-qa.yml: authenticated job must remain manually dispatchable');
  if (!workflow.includes("- studio\n          - all")) errors.push('.github/workflows/design-system-visual-qa.yml: focused Studio suite option is missing');
  if (!workflow.includes('npx playwright test specs/studio-interactions.spec.mjs --project=desktop-chromium')) {
    errors.push('.github/workflows/design-system-visual-qa.yml: focused Studio validation command is missing');
  }
  if (!workflow.includes('node tools/design-system-audit.js')) errors.push('.github/workflows/design-system-visual-qa.yml: design-system audit is missing');
  if (!workflow.includes('node tools/visual-qa-audit.js')) warnings.push('.github/workflows/design-system-visual-qa.yml: visual QA audit has not been wired yet');
  if (!workflow.includes('EVARA_QA_OWNER_EMAIL')) errors.push('.github/workflows/design-system-visual-qa.yml: owner QA secret is missing');
  if (!workflow.includes('actions/upload-artifact@v4')) errors.push('.github/workflows/design-system-visual-qa.yml: report artifact upload is missing');
  if (/path:\s*[^\n]*\.auth|tests\/visual\/\.auth/.test(workflow)) errors.push('.github/workflows/design-system-visual-qa.yml: authentication state must never be uploaded');

  if (!gitignore.includes('tests/visual/.auth/')) errors.push('.gitignore: visual QA auth state is not ignored');
  if (!gitignore.includes('tests/visual/playwright-report/')) errors.push('.gitignore: Playwright report is not ignored');
  if (!gitignore.includes('tests/visual/test-results/')) errors.push('.gitignore: Playwright results are not ignored');

  if (!access.includes("'qa-v2.html': ['platform_admin', 'owner', 'admin']")) {
    errors.push('public/assets/js/access-control.js: qa-v2.html must remain explicitly restricted to platform_admin, owner, and admin');
  }

  if (!qaPage.includes('design-system.css?v=2')) errors.push('public/qa-v2.html: canonical design-system bundle v2 is missing');
  if (!qaPage.includes('data-route-guard="private"')) errors.push('public/qa-v2.html: protected route guard is missing');
  if (!qaRuntime.includes('EVARA_DESIGN_SYSTEM_REGISTRY')) errors.push('public/assets/js/qa-v2.js: design-system registry diagnostics are missing');
  if (!qaRuntime.includes('pagesForRole')) errors.push('public/assets/js/qa-v2.js: canonical role route diagnostics are missing');
  if (!qaRuntime.includes("'/assets/brand/evaraos-app-icon.png'")) errors.push('public/assets/js/qa-v2.js: deterministic image appearance asset is missing');
}

console.log(`EvaraOS visual QA audit: ${requiredFiles.length} required assets checked.`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Visual QA role, appearance, device, authentication, Studio interaction, artifact, and route contracts passed.');
