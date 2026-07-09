import { test, expect } from '@playwright/test';
import {
  ROLE_DEFINITIONS,
  credentialsFor,
  storageStatePath
} from '../visual-matrix.mjs';

const ownerRole = ROLE_DEFINITIONS.find((role) => role.id === 'owner');
const ownerAvailable = Boolean(ownerRole && credentialsFor(ownerRole).available);

function diagnostics(page) {
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
  });
  const response = await page.goto('/website-builder.html', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await expect(page.locator('[data-visual-studio]')).toBeVisible();
  await expect(page.locator('[data-catalog-tool="properties"]')).toBeVisible();
}

test.describe('authenticated Studio action and icon configuration', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for Studio action/icon validation.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical permission-aware actions and canonical icons persist through Studio', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openCleanStudio(page);

    const card = page.locator('.studio-node[data-node-type="glass-card"]').first();
    await card.click();
    await page.locator('[data-catalog-tool="properties"]').click();

    const panel = page.locator('[data-catalog-sheet="properties"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-property-field="action"]')).toHaveAttribute('type', 'text');
    await expect(panel.locator('[data-action-config]')).toBeVisible();
    await expect(panel.locator('[data-icon-picker]')).toBeVisible();

    await panel.locator('[data-action-intent-control]').selectOption('navigate');
    const target = panel.locator('[data-action-target-control]');
    await expect(target).toBeEnabled();
    await target.selectOption('/revenue.html');

    const selectedCard = page.locator('.studio-node[data-node-type="glass-card"].is-selected');
    await expect(selectedCard).toHaveAttribute('data-action-intent', 'navigate');
    await expect(selectedCard).toHaveAttribute('data-action-target', '/revenue.html');
    await expect(selectedCard).toHaveAttribute('data-action-allowed', 'true');

    await panel.locator('[data-icon-search]').fill('map');
    await expect(panel.locator('[data-icon-choice="map"]')).toBeVisible();
    await panel.locator('[data-icon-choice="map"]').click();
    await expect(selectedCard).toHaveAttribute('data-icon-id', 'map');
    await expect(selectedCard.locator('.studio-node-icon svg[data-evara-icon="map"]')).toBeVisible();

    await page.locator('[data-preview-role]').selectOption('customer');
    await expect(page.locator('.studio-node[data-node-type="glass-card"].is-selected')).toHaveAttribute('data-action-allowed', 'false');
    await expect(page.locator('[data-catalog-sheet="properties"] [data-action-permission="critical"]')).toContainText('not authorized');

    const saved = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('evaraos-studio-visual-builder-v1') || 'null');
      const pageState = state?.pages?.find((page) => page.id === state.activePageId);
      return pageState?.nodes?.find((node) => node.id === state.selectedNodeId)?.props || null;
    });
    expect(saved).toMatchObject({ actionIntent: 'navigate', actionTarget: '/revenue.html', icon: 'map' });

    await testInfo.attach('studio-action-icon.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });
    await testInfo.attach('studio-action-icon-state.json', {
      body: JSON.stringify(saved, null, 2),
      contentType: 'application/json'
    });

    if (runtime.consoleErrors.length) {
      await testInfo.attach('studio-action-icon-console-errors.txt', {
        body: runtime.consoleErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    expect(runtime.pageErrors, 'Studio action/icon configuration must not emit uncaught errors.').toEqual([]);
    expect.soft(runtime.consoleErrors, 'Studio action/icon console errors require review.').toEqual([]);
  });
});
