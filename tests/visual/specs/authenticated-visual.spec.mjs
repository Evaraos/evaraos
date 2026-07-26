import { test, expect } from '@playwright/test';
import {
  APPEARANCES,
  CRITICAL_VISUAL_CASES,
  ROLE_DEFINITIONS,
  credentialsFor,
  routeSlug,
  storageStatePath
} from '../visual-matrix.mjs';

const matrixMode = process.env.EVARA_QA_MATRIX === 'full' ? 'full' : 'critical';
const criticalProjects = new Set(['desktop-chromium', 'iphone-webkit']);
const ownerRole = ROLE_DEFINITIONS.find((role) => role.id === 'owner');
const ownerAvailable = Boolean(ownerRole && credentialsFor(ownerRole).available);
const customerRole = ROLE_DEFINITIONS.find((role) => role.id === 'customer');
const customerAvailable = Boolean(customerRole && credentialsFor(customerRole).available);
const dynamicMaskSelector = [
  'canvas',
  'iframe',
  'video',
  'time',
  '.dashboard-live-dot',
  '[id$="Status"]',
  '[id*="Unread"]',
  '[id*="Count"]',
  '[id*="Total"]',
  '[id*="Gross"]',
  '[id*="Paid"]',
  '[id*="Risk"]'
].join(',');

function appearancePayload(appearance, baseURL) {
  return {
    mode: appearance.mode,
    imageUrl: appearance.imagePath ? new URL(appearance.imagePath, baseURL).href : '',
    imagePosition: 'center center',
    wallpaperDim: 0.08,
    glassTint: 0.46,
    adaptiveContrast: true,
    updatedAt: '2026-07-09T12:00:00.000Z'
  };
}

async function installAppearance(page, appearance, baseURL) {
  await page.emulateMedia({
    colorScheme: appearance.colorScheme,
    reducedMotion: 'reduce'
  });
  await page.addInitScript((payload) => {
    localStorage.setItem('evaraos-appearance', JSON.stringify(payload));
  }, appearancePayload(appearance, baseURL));
}

function collectRuntimeDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function waitForApplication(page, appearance) {
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await page.waitForFunction((mode) => document.documentElement.dataset.themeMode === mode, appearance.mode, { timeout: 15_000 });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.addStyleTag({
    content: `
      html { scroll-behavior: auto !important; }
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
      .eva-page-transition { display: none !important; }
    `
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function openRoute(page, route, appearance, baseURL) {
  await installAppearance(page, appearance, baseURL);
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response, `${route} should return a response`).not.toBeNull();
  expect(response.status(), `${route} should not return an HTTP error`).toBeLessThan(400);
  await waitForApplication(page, appearance);
  const pathname = new URL(page.url()).pathname;
  expect(pathname, `${route} must not redirect to login`).not.toMatch(/login\.html$/);
  expect.soft(pathname, `${route} should remain on the authorized route`).toBe(route);
}

async function collectDomDiagnostics(page) {
  return page.evaluate(() => {
    const idCounts = {};
    document.querySelectorAll('[id]').forEach((node) => {
      idCounts[node.id] = (idCounts[node.id] || 0) + 1;
    });
    const duplicateIds = Object.entries(idCounts).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
    const unlabeledControls = [...document.querySelectorAll('button,a[href],input,select,textarea')]
      .filter((node) => {
        if (node.hidden || node.closest('[hidden]')) return false;
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return !String(node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || node.getAttribute('placeholder') || '').trim();
      })
      .slice(0, 50)
      .map((node) => ({ tag: node.tagName.toLowerCase(), id: node.id || '', className: String(node.className || '') }));
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      duplicateIds,
      unlabeledControls,
      designSystem: document.documentElement.dataset.evaraDesignSystem || '',
      themeMode: document.documentElement.dataset.themeMode || '',
      environment: document.documentElement.dataset.environment || ''
    };
  });
}

async function verifyKeyboardFocus(page) {
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const node = document.activeElement;
    if (!node || node === document.body || node === document.documentElement) return { focused: false };
    const style = getComputedStyle(node);
    return {
      focused: true,
      tag: node.tagName.toLowerCase(),
      id: node.id || '',
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow
    };
  });
}

for (const role of ROLE_DEFINITIONS) {
  const available = credentialsFor(role).available;
  const routes = matrixMode === 'full' ? role.routes : role.criticalRoutes;

  test.describe(`${role.id} authenticated route QA`, () => {
    test.skip(!available, `${role.id} QA credentials are not configured.`);
    test.use({ storageState: storageStatePath(role.id) });

    for (const route of routes) {
      test(`${matrixMode === 'critical' ? '@critical ' : ''}${route} loads without layout failure`, async ({ page, baseURL }, testInfo) => {
        if (matrixMode !== 'full' && testInfo.project.name !== 'desktop-chromium') test.skip();
        const diagnostics = collectRuntimeDiagnostics(page);
        await openRoute(page, route, APPEARANCES[0], baseURL);
        const dom = await collectDomDiagnostics(page);
        const focus = await verifyKeyboardFocus(page);

        await testInfo.attach('dom-diagnostics.json', { body: JSON.stringify(dom, null, 2), contentType: 'application/json' });
        await testInfo.attach('focus-diagnostics.json', { body: JSON.stringify(focus, null, 2), contentType: 'application/json' });
        if (diagnostics.consoleErrors.length) {
          await testInfo.attach('console-errors.txt', { body: diagnostics.consoleErrors.join('\n'), contentType: 'text/plain' });
        }

        expect(dom.horizontalOverflow, 'The root document must not overflow horizontally.').toBeLessThanOrEqual(2);
        expect(dom.themeMode).toBe('light');
        expect(focus.focused, 'Keyboard Tab should reach a visible interactive element.').toBe(true);
        expect(diagnostics.pageErrors, 'Uncaught page errors are not allowed.').toEqual([]);
        expect.soft(diagnostics.consoleErrors, 'Console errors require review.').toEqual([]);
        expect.soft(dom.duplicateIds, 'Duplicate IDs require review.').toEqual([]);
        expect.soft(dom.unlabeledControls, 'Visible interactive elements need an accessible name.').toEqual([]);
      });
    }
  });
}

const visualCases = matrixMode === 'full'
  ? ROLE_DEFINITIONS.flatMap((role) => role.criticalRoutes.map((route) => ({ role: role.id, route })))
  : CRITICAL_VISUAL_CASES;

for (const visualCase of visualCases) {
  const role = ROLE_DEFINITIONS.find((entry) => entry.id === visualCase.role);
  const available = Boolean(role && credentialsFor(role).available);

  test.describe(`${visualCase.role} visual baselines`, () => {
    test.skip(!available, `${visualCase.role} QA credentials are not configured.`);
    test.use({ storageState: storageStatePath(visualCase.role) });

    for (const appearance of APPEARANCES) {
      test(`@critical ${routeSlug(visualCase.route)} · ${appearance.id}`, async ({ page, baseURL }, testInfo) => {
        if (matrixMode !== 'full' && !criticalProjects.has(testInfo.project.name)) test.skip();
        const diagnostics = collectRuntimeDiagnostics(page);
        await openRoute(page, visualCase.route, appearance, baseURL);
        const dom = await collectDomDiagnostics(page);
        const mask = page.locator(dynamicMaskSelector);

        await expect(page).toHaveScreenshot(`${visualCase.role}-${routeSlug(visualCase.route)}-${appearance.id}.png`, {
          fullPage: false,
          mask,
          maskColor: '#7f7f7f'
        });

        await testInfo.attach('visual-dom-diagnostics.json', { body: JSON.stringify(dom, null, 2), contentType: 'application/json' });
        expect(dom.horizontalOverflow, 'The visual baseline must not contain root horizontal overflow.').toBeLessThanOrEqual(2);
        expect(dom.themeMode).toBe(appearance.mode);
        expect(diagnostics.pageErrors, 'Uncaught page errors are not allowed during visual capture.').toEqual([]);
      });
    }
  });
}

test.describe('owner settings navigation regression', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are not configured.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical settings cards keep their authorized destination', async ({ page, baseURL }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const destinations = [
      '/settings/account.html',
      '/settings/appearance.html',
      '/settings/icons.html',
      '/settings/notifications.html',
      '/settings/workspace-v2.html'
    ];

    for (const destination of destinations) {
      await openRoute(page, '/settings-v2.html', APPEARANCES[0], baseURL);
      await page.locator(`a[href="${destination}"]`).click();
      await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
      expect(new URL(page.url()).pathname).toBe(destination);
    }
  });
});

test.describe('customer portal regression', () => {
  test.skip(!customerAvailable, 'Customer QA credentials are not configured.');
  test.use({ storageState: customerRole ? storageStatePath(customerRole.id) : undefined });

  test('@critical customer portal renders and profile controls respond', async ({ page, baseURL }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const diagnostics = collectRuntimeDiagnostics(page);
    await openRoute(page, '/customer_dashboard.html', APPEARANCES[0], baseURL);

    await expect(page.locator('.customer-page-wrap')).toBeVisible();
    await expect(page.locator('.customer-kicker').first()).toHaveText('CUSTOMER PORTAL');
    await expect(page.locator('#customerServiceTimeline')).not.toContainText('Loading your service history');
    await page.locator('#customerEditProfile').click();
    await expect(page.locator('#customerProfileForm')).toBeVisible();
    await expect(page.locator('#customerProfileView')).toBeHidden();
    await page.locator('#customerCancelEdit').click();
    await expect(page.locator('#customerProfileView')).toBeVisible();

    expect(diagnostics.pageErrors).toEqual([]);
    expect.soft(diagnostics.consoleErrors).toEqual([]);
  });
});
