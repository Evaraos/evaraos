import { test, expect } from '@playwright/test';
import {
  ROLE_DEFINITIONS,
  credentialsFor,
  storageStatePath
} from '../visual-matrix.mjs';

const ownerRole = ROLE_DEFINITIONS.find((role) => role.id === 'owner');
const ownerAvailable = Boolean(ownerRole && credentialsFor(ownerRole).available);
const PANEL_SELECTORS = [
  '[data-catalog-sheet="properties"]',
  '[data-layout-sheet="layers"]',
  '[data-auto-layout-panel]',
  '[data-journal-panel]',
  '[data-studio-sheet]'
];

function collectRuntimeDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function openCleanStudio(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('evaraos-studio-visual-builder-v1');
    localStorage.removeItem('evaraos-studio-auto-layout-v1');
    localStorage.removeItem('evaraos-studio-layout-grid-v1');
  });
  const response = await page.goto('/website-builder.html', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await expect(page.locator('[data-visual-studio]')).toBeVisible();
  await expect(page.locator('[data-catalog-tool="properties"]')).toBeVisible();
  await expect(page.locator('[data-layout-tool="layers"]')).toBeVisible();
  await expect(page.locator('[data-auto-layout-tool]')).toBeVisible();
  await expect(page.locator('.studio-document-history-button')).toBeVisible();
  await expect(page.locator('[data-catalog-field-bridge]')).toHaveCount(0);
  await expect(page.locator('.owner-edit-dock')).toHaveCount(0);

  const shell = await page.evaluate(() => {
    const root = document.querySelector('#appRoot');
    const studio = document.querySelector('[data-visual-studio]');
    const workspace = document.querySelector('.studio-workspace');
    return {
      rootTransform: root ? getComputedStyle(root).transform : '',
      studioHeight: studio?.getBoundingClientRect().height || 0,
      workspaceHeight: workspace?.getBoundingClientRect().height || 0
    };
  });
  expect(shell.rootTransform).toBe('none');
  expect(shell.studioHeight).toBeGreaterThan(600);
  expect(shell.workspaceHeight).toBeGreaterThan(480);

  const obstructedViewportControls = await page.evaluate(() => (
    [...document.querySelectorAll('.studio-viewport-switcher button')]
      .filter((button) => button.getClientRects().length)
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + (rect.width / 2),
          rect.top + (rect.height / 2)
        );
        return hit !== button && !button.contains(hit);
      })
      .map((button) => button.getAttribute('aria-label') || button.textContent?.trim())
  ));
  expect(obstructedViewportControls, 'Studio viewport controls must not be covered by topbar actions.').toEqual([]);

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `
  });
}

async function expectSinglePanel(page, expectedSelector) {
  for (const selector of PANEL_SELECTORS) {
    const panel = page.locator(selector);
    if (selector === expectedSelector) await expect(panel).toBeVisible();
    else await expect(panel).toHaveCount(0);
  }
}

async function attachStudioState(page, testInfo, name) {
  const state = await page.evaluate(() => ({
    builder: JSON.parse(localStorage.getItem('evaraos-studio-visual-builder-v1') || 'null'),
    autoLayout: JSON.parse(localStorage.getItem('evaraos-studio-auto-layout-v1') || 'null'),
    grid: localStorage.getItem('evaraos-studio-layout-grid-v1')
  }));
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(state, null, 2),
    contentType: 'application/json'
  });
}

test.describe('authenticated Evara Studio integration', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for Studio interaction validation.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical catalog, properties, history, layout, and journal cooperate', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const diagnostics = collectRuntimeDiagnostics(page);
    await openCleanStudio(page);

    await testInfo.attach('studio-initial.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });

    await page.locator('[data-sheet="add"]').click();
    await expect(page.locator('[data-catalog-search]')).toBeVisible();
    await page.locator('[data-catalog-search]').fill('notice');
    await expect(page.locator('[data-add-component="notice-banner"]')).toBeVisible();
    await expect(page.locator('[data-add-component]:visible')).toHaveCount(1);
    await page.locator('[data-add-component="notice-banner"]').click();

    const notice = page.locator('.studio-node[data-node-type="notice-banner"].is-selected');
    await expect(notice).toBeVisible();
    await expect(notice.locator('h3')).toHaveText('Action required');

    await page.locator('[data-catalog-tool="properties"]').click();
    await expectSinglePanel(page, '[data-catalog-sheet="properties"]');

    const title = page.locator('[data-catalog-sheet="properties"] [data-property-field="title"]');
    await title.fill('');
    await title.blur();
    await expect(title).toHaveAttribute('aria-invalid', 'true');
    await expect(notice.locator('h3')).toHaveText('Action required');

    await title.fill('QA validation notice');
    await title.blur();
    await expect(page.locator('.studio-node[data-node-type="notice-banner"].is-selected h3')).toHaveText('QA validation notice');

    await page.locator('[data-action="undo"]').click();
    await expect(page.locator('.studio-node[data-node-type="notice-banner"].is-selected h3')).toHaveText('Action required');
    await page.locator('[data-action="redo"]').click();
    await expect(page.locator('.studio-node[data-node-type="notice-banner"].is-selected h3')).toHaveText('QA validation notice');

    await page.locator('[data-catalog-sheet="properties"] [data-property-field="tone"]').selectOption('critical');
    await expect(page.locator('.studio-node[data-node-type="notice-banner"].is-selected')).toHaveAttribute('data-catalog-tone', 'critical');

    await page.locator('[data-layout-tool="layers"]').click();
    await expectSinglePanel(page, '[data-layout-sheet="layers"]');
    await expect(page.locator('[data-layout-sheet="layers"] [data-layer-node]')).toHaveCount(8);
    await expect(page.locator('[data-layout-sheet="layers"] [data-layer-node]').filter({ hasText: 'QA validation notice' })).toHaveCount(1);

    await page.locator('[data-auto-layout-tool]').click();
    await expectSinglePanel(page, '[data-auto-layout-panel]');
    await page.locator('[data-auto-action="create"]').click();
    await expect(page.locator('[data-auto-layout-group]')).toHaveCount(1);
    await expect(page.locator('.studio-auto-layout-frame')).toHaveCount(1);

    await page.locator('.studio-document-history-button').click();
    await expectSinglePanel(page, '[data-journal-panel]');
    await page.locator('[data-journal-action="checkpoint"]').click();
    await expect(page.locator('[data-journal-panel] .studio-document-version')).not.toHaveCount(0);

    await testInfo.attach('studio-validated.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });
    await attachStudioState(page, testInfo, 'studio-state');

    if (diagnostics.consoleErrors.length) {
      await testInfo.attach('studio-console-errors.txt', {
        body: diagnostics.consoleErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    expect(diagnostics.pageErrors, 'Studio must not emit uncaught page errors.').toEqual([]);
    expect.soft(diagnostics.consoleErrors, 'Studio console errors require review.').toEqual([]);
  });
});
