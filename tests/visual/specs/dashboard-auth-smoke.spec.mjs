// Temporary PR-only authenticated verification for production dashboard release gating.
import { test, expect } from '@playwright/test';
import { credentialsFor, ROLE_DEFINITIONS, storageStatePath } from '../visual-matrix.mjs';

const ROLE_EXPECTATIONS = {
  owner: {
    bodyClass: 'dashboard-role-leadership',
    navCount: 7,
    clickableCards: 4,
    companiesHidden: false,
    usersHidden: false
  },
  technician: {
    bodyClass: 'dashboard-role-staff',
    navCount: 5,
    clickableCards: 2,
    companiesHidden: true,
    usersHidden: true
  }
};

const APPEARANCES = [
  { id: 'light', mode: 'light', colorScheme: 'light' },
  { id: 'dark', mode: 'dark', colorScheme: 'dark' },
  { id: 'image', mode: 'image', colorScheme: 'dark', imagePath: '/assets/brand/evaraos-app-icon.png' }
];

async function applyAppearance(page, appearance, baseURL) {
  await page.emulateMedia({ colorScheme: appearance.colorScheme, reducedMotion: 'reduce' });
  await page.addInitScript((payload) => {
    localStorage.setItem('evaraos-appearance', JSON.stringify(payload));
  }, {
    mode: appearance.mode,
    imageUrl: appearance.imagePath ? new URL(appearance.imagePath, baseURL).href : '',
    imagePosition: 'center center',
    wallpaperDim: 0.08,
    glassTint: 0.46,
    adaptiveContrast: true,
    updatedAt: '2026-07-09T12:00:00.000Z'
  });
}

for (const roleId of ['owner', 'technician']) {
  const role = ROLE_DEFINITIONS.find((entry) => entry.id === roleId);
  const available = Boolean(role && credentialsFor(role).available);
  const expected = ROLE_EXPECTATIONS[roleId];

  test.describe(`${roleId} dashboard authenticated smoke`, () => {
    test.skip(!available, `${roleId} QA credentials are not configured.`);
    test.use({ storageState: storageStatePath(roleId) });

    for (const appearance of APPEARANCES) {
      test(`${appearance.id} mode hydrates the correct role dashboard`, async ({ page, baseURL }) => {
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));

        await applyAppearance(page, appearance, baseURL);
        const response = await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });
        expect(response).not.toBeNull();
        expect(response.status()).toBeLessThan(400);
        await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
        await page.waitForFunction((mode) => document.documentElement.dataset.themeMode === mode, appearance.mode, { timeout: 15_000 });
        await page.waitForTimeout(500);

        expect(new URL(page.url()).pathname).toBe('/dashboard.html');
        await expect(page.locator('body')).toHaveClass(new RegExp(expected.bodyClass));
        await expect(page.locator('.dashboard-sidebar-nav .dashboard-nav-link')).toHaveCount(expected.navCount);
        await expect(page.locator('.dashboard-sidebar-nav [aria-current="location"]')).toHaveCount(1);
        await expect(page.locator('.dashboard-nav-icon[data-evara-icon] .eva-icon')).toHaveCount(expected.navCount);
        await expect(page.locator('.dashboard-stat-card.dashboard-click-card')).toHaveCount(expected.clickableCards);

        const diagnostics = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          companiesHidden: document.getElementById('companiesSection')?.hidden ?? null,
          usersHidden: document.getElementById('usersSection')?.hidden ?? null,
          themeMode: document.documentElement.dataset.themeMode || ''
        }));

        expect(diagnostics.documentWidth - diagnostics.viewportWidth).toBeLessThanOrEqual(2);
        expect(diagnostics.companiesHidden).toBe(expected.companiesHidden);
        expect(diagnostics.usersHidden).toBe(expected.usersHidden);
        expect(diagnostics.themeMode).toBe(appearance.mode);
        expect(pageErrors).toEqual([]);

        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const node = document.activeElement;
          return Boolean(node && node !== document.body && node !== document.documentElement);
        });
        expect(focused).toBe(true);
      });
    }
  });
}
