import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import {
  ROLE_DEFINITIONS,
  credentialsFor,
  configuredRoles,
  storageStatePath
} from './visual-matrix.mjs';

function normalizedBaseUrl() {
  const value = String(process.env.EVARA_QA_BASE_URL || '').trim().replace(/\/$/, '');
  if (!value) throw new Error('EVARA_QA_BASE_URL is required for authenticated visual QA.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('EVARA_QA_BASE_URL must use http or https.');
  return url.href.replace(/\/$/, '');
}

async function waitForReady(page) {
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
}

async function authenticateRole(browser, baseURL, role) {
  const credentials = credentialsFor(role);
  const context = await browser.newContext({
    baseURL,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce'
  });

  try {
    const page = await context.newPage();
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);
    await page.locator('#loginEmail').fill(credentials.email);
    await page.locator('#loginPassword').fill(credentials.password);

    await Promise.all([
      page.waitForURL((url) => !url.pathname.endsWith('/login.html'), { timeout: 30_000 }),
      page.locator('#loginForm button[type="submit"]').click()
    ]);

    await waitForReady(page);
    const current = new URL(page.url());
    if (current.pathname.endsWith('/login.html')) throw new Error('Login did not leave the authentication route.');

    const statePath = storageStatePath(role.id);
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await context.storageState({ path: statePath, indexedDB: true });
    return { role: role.id, route: current.pathname, ready: true };
  } finally {
    await context.close();
  }
}

export default async function globalSetup() {
  const baseURL = normalizedBaseUrl();
  const requireAllRoles = process.env.EVARA_QA_REQUIRE_ALL_ROLES === '1';
  const availableRoles = configuredRoles();
  const missingRoles = ROLE_DEFINITIONS.filter((role) => !credentialsFor(role).available);
  const missingRequired = ROLE_DEFINITIONS.filter((role) => role.required && !credentialsFor(role).available);

  if (missingRequired.length) {
    throw new Error(`Missing required QA credentials for: ${missingRequired.map((role) => role.id).join(', ')}`);
  }
  if (requireAllRoles && missingRoles.length) {
    throw new Error(`Full role QA requires credentials for: ${missingRoles.map((role) => role.id).join(', ')}`);
  }

  const browser = await chromium.launch();
  const sessions = [];
  try {
    for (const role of availableRoles) {
      try {
        sessions.push(await authenticateRole(browser, baseURL, role));
        console.log(`Authenticated visual QA session: ${role.id}`);
      } catch (error) {
        throw new Error(`Unable to create ${role.id} QA session: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const authDirectory = path.dirname(storageStatePath('owner'));
  await fs.mkdir(authDirectory, { recursive: true });
  await fs.writeFile(path.join(authDirectory, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseOrigin: new URL(baseURL).origin,
    configuredRoles: sessions.map((entry) => entry.role),
    missingRoles: missingRoles.map((entry) => entry.id),
    requireAllRoles
  }, null, 2));
}
