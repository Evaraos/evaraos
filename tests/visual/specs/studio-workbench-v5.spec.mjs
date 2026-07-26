import { test, expect } from '@playwright/test';
import {
  ROLE_DEFINITIONS,
  credentialsFor,
  storageStatePath
} from '../visual-matrix.mjs';

const ownerRole = ROLE_DEFINITIONS.find((role) => role.id === 'owner');
const ownerAvailable = Boolean(ownerRole && credentialsFor(ownerRole).available);
const appCheckDebugToken = String(process.env.EVARA_QA_APP_CHECK_DEBUG_TOKEN || '').trim();

function diagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function installAppCheck(page) {
  if (!appCheckDebugToken) return;
  await page.addInitScript((token) => {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, appCheckDebugToken);
}

async function openWorkbench(page) {
  await installAppCheck(page);
  await page.addInitScript(() => {
    window.__evaraWorkbenchEvents = [];
    window.addEventListener('evara:studio-workbench-ready', (event) => {
      window.__evaraWorkbenchEvents.push({ type: 'ready', detail: JSON.parse(JSON.stringify(event.detail || {})) });
    });
    window.addEventListener('evara:studio-release-complete', (event) => {
      window.__evaraWorkbenchEvents.push({ type: 'prepared', detail: JSON.parse(JSON.stringify(event.detail || {})) });
    });
    window.addEventListener('evara:studio-release-active', (event) => {
      window.__evaraWorkbenchEvents.push({ type: 'active', detail: JSON.parse(JSON.stringify(event.detail || {})) });
    });
    window.addEventListener('evara:published-studio-release-rendered', (event) => {
      window.__evaraWorkbenchEvents.push({ type: 'rendered', detail: JSON.parse(JSON.stringify(event.detail || {})) });
    });
  });

  const response = await page.goto('/website-builder.html', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await page.waitForFunction(() => Boolean(
    window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().ready
    && window.EvaraCanvasSandbox.getSession().snapshot().source === 'authored-blueprint-graph'
    && window.EvaraCanvasSandbox.getSession().snapshot().sourceDocumentId
    && window.EvaraStudioWorkbench?.version === 'studio-canvas-workbench-v5'
    && window.EvaraStudioReleaseActivation?.version === 'studio-release-activation-v1'
    && window.EvaraAppCheckReadiness?.snapshot?.().state === 'ready'
    && window.EvaraTrustedStudioJournal?.snapshot
  ), null, { timeout: 45_000 });
  await expect(page.locator('[data-canvas-sandbox]')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-studio-primary-surface', 'graph-canvas');
  await page.locator('[data-workbench-toggle]').click();
  await expect(page.locator('[data-canvas-workbench]')).toHaveClass(/is-open/);
}

async function selectedGraphNode(page) {
  return page.evaluate(() => {
    const session = window.EvaraCanvasSandbox.getSession();
    const id = session.snapshot().selection.selectedIds[0];
    return id ? JSON.parse(JSON.stringify(session.getGraph().nodes[id])) : null;
  });
}

async function selectFirstComponent(page) {
  const node = page.locator('[data-sandbox-node-id]').first();
  await node.click();
  await page.waitForFunction(() => window.EvaraCanvasSandbox.getSession().snapshot().selection.selectedIds.length > 0);
  return node;
}

async function chooseWorkbenchTab(page, tab) {
  await page.locator(`[data-workbench-tab="${tab}"]`).click();
  await expect(page.locator(`[data-workbench-tab="${tab}"]`)).toHaveClass(/is-active/);
}

async function changeField(page, path, value) {
  const field = page.locator(`[data-workbench-field="${path}"]`);
  await expect(field).toBeVisible();
  if (await field.evaluate((node) => node.tagName === 'SELECT')) await field.selectOption(String(value));
  else await field.fill(String(value));
  await field.blur();
}

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('authenticated Graph Workbench — all eight Studio milestones', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for Studio Workbench validation.');
  test.skip(Boolean(process.env.CI) && !appCheckDebugToken, 'EVARA_QA_APP_CHECK_DEBUG_TOKEN is required for authenticated CI.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical edits, responsive rules, media, logic, versions, activation, and live rendering', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openWorkbench(page);
    const source = await page.evaluate(() => window.EvaraCanvasSandbox.getSession().snapshot());
    expect(source.source).toBe('authored-blueprint-graph');
    expect(source.sourceDocumentId).toBeTruthy();
    expect(source.sourceFingerprint).toBeTruthy();
    const article = await selectFirstComponent(page);

    const beforeRevision = await page.evaluate(() => window.EvaraCanvasSandbox.getSession().getGraph().revision);
    const titleField = page.locator('[data-workbench-field="content.title"]');
    const labelField = page.locator('[data-workbench-field="content.label"]');
    const editable = await titleField.count() ? titleField : labelField;
    await expect(editable).toBeVisible();
    const updatedTitle = `Workbench QA ${Date.now()}`;
    await editable.fill(updatedTitle);
    await editable.blur();
    await expect.poll(() => page.evaluate(() => window.EvaraCanvasSandbox.getSession().getGraph().revision)).toBeGreaterThan(beforeRevision);
    const edited = await selectedGraphNode(page);
    expect(edited.props.content.title || edited.props.content.label).toBe(updatedTitle);

    await changeField(page, 'layout.mode', 'spatial');
    await changeField(page, 'layout.x', '24');
    await changeField(page, 'layout.y', '32');
    await changeField(page, 'style.radius', '30');
    await changeField(page, 'style.opacity', '0.95');
    await expect(article).toHaveCSS('opacity', '0.95');
    await expect(page.locator('[data-workbench-resize]')).toHaveCount(8);
    const handleMutations = await page.evaluate(async () => {
      const selected = document.querySelector('[data-sandbox-node-id].is-selected');
      let count = 0;
      const observer = new MutationObserver((records) => {
        count += records.filter((record) => record.type === 'childList').length;
      });
      observer.observe(selected, { childList: true, subtree: true });
      await new Promise((resolve) => setTimeout(resolve, 350));
      observer.disconnect();
      return count;
    });
    expect(handleMutations).toBeLessThan(8);
    const rejected = await page.evaluate(async () => {
      try {
        await window.EvaraCanvasSandbox.dispatch('canvas.property.set', {
          nodeId: 'missing-authoritative-node',
          property: 'content.title',
          value: 'must fail'
        });
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);

    await chooseWorkbenchTab(page, 'responsive');
    await changeField(page, 'responsive.tablet.span', '6');
    await changeField(page, 'responsive.mobile.visible', 'false');
    await page.locator('[data-sandbox-device="tablet"]').click();
    await expect.poll(() => page.evaluate(() => {
      const projection = window.EvaraCanvasSandbox.getProjection();
      const id = window.EvaraCanvasSandbox.getSession().snapshot().selection.selectedIds[0];
      const walk = (node) => node.id === id ? node : node.children.map(walk).find(Boolean);
      return walk(projection.page)?.layout?.span;
    })).toBe(6);
    await page.locator('[data-sandbox-device="mobile"]').click();
    await expect(article).toHaveClass(/is-workbench-hidden/);
    await page.locator('[data-sandbox-device="desktop"]').click();

    await chooseWorkbenchTab(page, 'components');
    const reusableName = `Reusable QA ${Date.now()}`;
    await changeField(page, 'reusable-name', reusableName);
    const countBeforeReusable = await page.locator('[data-sandbox-node-id]').count();
    await page.locator('[data-workbench-action="save-reusable"]').click();
    await expect(page.locator('.studio-workbench-row', { hasText: reusableName })).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('evaraos-studio-workbench-v5:'))
        .forEach((key) => localStorage.removeItem(key));
    });
    await openWorkbench(page);
    await chooseWorkbenchTab(page, 'components');
    await expect(page.locator('.studio-workbench-row', { hasText: reusableName })).toBeVisible({ timeout: 20_000 });
    await selectFirstComponent(page);
    await page.locator('.studio-workbench-row', { hasText: reusableName }).locator('[data-workbench-action="insert-reusable"]').click();
    await expect.poll(() => page.locator('[data-sandbox-node-id]').count()).toBe(countBeforeReusable + 1);

    await chooseWorkbenchTab(page, 'media');
    await page.locator('[data-workbench-upload]').setInputFiles({
      name: 'studio-workbench-qa.png',
      mimeType: 'image/png',
      buffer: onePixelPng
    });
    await expect(page.locator('[data-workbench-status]')).toContainText(/upload complete/i, { timeout: 45_000 });
    const assetRow = page.locator('.studio-workbench-row.is-asset', { hasText: 'studio-workbench-qa.png' }).first();
    await expect(assetRow).toBeVisible();
    await assetRow.locator('[data-workbench-action="apply-asset"]').click();
    await expect.poll(() => selectedGraphNode(page).then((node) => node?.props?.content?.assetUrl || '')).toMatch(/^https:\/\//);
    await expect(page.locator('.studio-workbench-node-media')).toBeVisible();
    await page.evaluate(async () => {
      const session = window.EvaraCanvasSandbox.getSession();
      const nodeId = session.snapshot().selection.selectedIds[0];
      await window.EvaraCanvasSandbox.dispatch('canvas.property.set', { nodeId, property: 'content.assetUrl', value: '' });
      await window.EvaraCanvasSandbox.dispatch('canvas.property.set', { nodeId, property: 'content.assetType', value: '' });
    });
    await assetRow.locator('[data-workbench-action="delete-asset"]').click();
    await expect(assetRow).toHaveCount(0);

    await chooseWorkbenchTab(page, 'logic');
    await changeField(page, 'action.trigger', 'click');
    await changeField(page, 'action.type', 'open-modal');
    await changeField(page, 'action.value', 'Authenticated no-code action preview');
    await page.locator('[data-workbench-action="toggle-logic-preview"]').click();
    await page.locator('[data-workbench-action="close-workbench"]').click();
    await page.locator('[data-sandbox-node-id].is-selected').click();
    await expect(page.locator('[data-workbench-preview-modal]')).toContainText('Authenticated no-code action preview');
    await page.locator('[data-workbench-action="close-preview-modal"]').click();
    await page.locator('[data-workbench-toggle]').click();

    await chooseWorkbenchTab(page, 'versions');
    const versionName = `QA Trusted Version ${Date.now()}`;
    await changeField(page, 'version-name', versionName);
    await page.locator('[data-workbench-action="create-version"]').click();
    const versionRow = page.locator('.studio-workbench-row', { hasText: versionName });
    await expect(versionRow).toBeVisible({ timeout: 60_000 });
    await expect(versionRow.locator('[data-workbench-action="restore-version"]')).toBeEnabled();

    await chooseWorkbenchTab(page, 'publish');
    await changeField(page, 'publish-channel', 'staging');
    await changeField(page, 'publish-slug', 'owner-dashboard');
    await changeField(page, 'publish-title', 'Evara Studio authenticated QA');
    await page.locator('[data-workbench-local-field="publish-description"]').fill('Authenticated active-release verification for the Graph Workbench.');
    await page.locator('[data-workbench-action="publish"]').click();
    await expect(page.locator('[data-workbench-status]')).toContainText(/active on staging\/owner-dashboard/i, { timeout: 120_000 });
    await expect(page.locator('[data-studio-active-release]')).toContainText('Active release');
    const activation = await page.evaluate(() => window.EvaraStudioReleaseActivation.snapshot().lastActivation);
    expect(activation.releaseId).toContain('staging-owner-dashboard');
    expect(activation.checkpointId).toBeTruthy();
    expect(activation.status).toBe('active');
    expect(activation.channel).toBe('staging');
    expect(activation.slug).toBe('owner-dashboard');

    await page.goto('/dashboard.html?studioReleaseChannel=staging', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
    await page.waitForFunction(() => Boolean(
      window.EvaraPublishedStudioRuntime?.snapshot?.().active
      && window.EvaraPublishedStudioRuntime.snapshot().release?.releaseId
    ), null, { timeout: 90_000 });
    await expect(page.locator('[data-studio-published-root]')).toBeVisible();
    const live = await page.evaluate(() => window.EvaraPublishedStudioRuntime.snapshot());
    expect(live.release.releaseId).toBe(activation.releaseId);
    expect(live.release.status).toBe('active');
    expect(live.channel).toBe('staging');
    expect(live.slug).toBe('owner-dashboard');
    await expect(page.locator('[data-studio-published-root]')).toContainText(updatedTitle);

    expect(runtime.pageErrors).toEqual([]);
    expect(runtime.consoleErrors.filter((message) => !/favicon|ResizeObserver loop/i.test(message))).toEqual([]);
  });

  test('mobile primary surface remains usable', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkbench(page);
    await expect(page.locator('[data-canvas-sandbox]')).toBeVisible();
    await expect(page.locator('.studio-canvas-sandbox-stage')).toBeVisible();
    await expect(page.locator('[data-canvas-workbench]')).toHaveCSS('max-height', /.+/);
    await selectFirstComponent(page);
    await page.locator('[data-workbench-toggle]').click();
    await expect(page.locator('[data-canvas-workbench]')).not.toHaveClass(/is-open/);
    await page.locator('[data-workbench-toggle]').click();
    await expect(page.locator('[data-canvas-workbench]')).toHaveClass(/is-open/);
    await expect(page.locator('[data-workbench-tab="responsive"]')).toBeVisible();
  });
});
