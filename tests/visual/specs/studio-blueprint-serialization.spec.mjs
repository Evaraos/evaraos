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
  await page.waitForFunction(() => Boolean(window.EvaraStudioBlueprintSerialization?.capture), null, { timeout: 15_000 });
  await expect(page.locator('[data-visual-studio]')).toHaveAttribute('data-blueprint-schema', '1.0.0');
}

test.describe('authenticated Studio Blueprint serialization', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for Blueprint serialization validation.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical component instances round-trip and compile into Evara Graph', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openCleanStudio(page);

    const card = page.locator('.studio-node[data-node-type="glass-card"]').first();
    await card.click();
    await page.locator('[data-catalog-tool="properties"]').click();
    const panel = page.locator('[data-catalog-sheet="properties"]');
    await panel.locator('[data-action-intent-control]').selectOption('navigate');
    await panel.locator('[data-action-target-control]').selectOption('/revenue.html');
    await panel.locator('[data-icon-search]').fill('map');
    await panel.locator('[data-icon-choice="map"]').click();

    await page.locator('[data-auto-layout-tool]').click();
    await page.locator('[data-auto-action="create"]').click();
    await expect(page.locator('[data-auto-layout-group]')).toHaveCount(1);

    const result = await page.evaluate(() => {
      const api = window.EvaraStudioBlueprintSerialization;
      const first = api.capture('owner-dashboard', {
        actorId: 'qa-owner',
        generatedAt: '2026-07-09T12:00:00.000Z'
      });
      const second = api.capture('owner-dashboard', {
        actorId: 'qa-owner',
        generatedAt: '2026-07-10T12:00:00.000Z'
      });
      const serialized = api.stringifyCurrent('owner-dashboard', {
        actorId: 'qa-owner',
        generatedAt: '2026-07-09T12:00:00.000Z'
      });
      const inspected = api.inspect(JSON.parse(serialized));
      const compiled = api.compileCurrent('owner-dashboard', {
        actorId: 'qa-owner',
        generatedAt: '2026-07-09T12:00:00.000Z'
      });
      const graphNodes = Object.values(compiled.graph.nodes || {});
      const graphEdges = Object.values(compiled.graph.edges || {});
      return {
        document: first,
        secondFingerprint: second.metadata.fingerprint,
        serialized,
        projection: inspected.projection,
        graph: {
          graphId: compiled.graph.graphId,
          validation: compiled.validation,
          nodeKinds: graphNodes.reduce((counts, node) => ({ ...counts, [node.kind]: (counts[node.kind] || 0) + 1 }), {}),
          edgeKinds: graphEdges.reduce((counts, edge) => ({ ...counts, [edge.kind]: (counts[edge.kind] || 0) + 1 }), {})
        }
      };
    });

    expect(result.document.kind).toBe('evara.blueprint.component-document');
    expect(result.document.schemaVersion).toBe('1.0.0');
    expect(result.document.blueprintId).toBe('owner');
    expect(result.document.role).toBe('owner');
    expect(result.document.validation.valid).toBe(true);
    expect(result.document.metadata.fingerprint).toMatch(/^bp_[0-9a-f]{8}$/);
    expect(result.secondFingerprint).toBe(result.document.metadata.fingerprint);
    expect(result.document.pages).toHaveLength(1);
    expect(result.document.pages[0].sections[0].layout.groups).toHaveLength(1);

    const instances = Object.values(result.document.instances);
    expect(instances.length).toBeGreaterThan(5);
    const configured = instances.find((instance) => instance.definition.id === 'glass-card' && instance.action.target === '/revenue.html');
    expect(configured).toBeTruthy();
    expect(configured.icon).toEqual({ registry: 'icon-registry-v1', id: 'map' });
    expect(configured.action).toMatchObject({ version: 'action-binding-v1', intent: 'navigate', routeAllowed: true });
    expect(configured.visibility.roles.owner).toBe(true);
    expect(configured.responsive.mobile.span).toBe(12);

    expect(result.projection.page.nodes).toHaveLength(instances.length);
    const projected = result.projection.page.nodes.find((node) => node.id === configured.id);
    expect(projected.props).toMatchObject({ icon: 'map', actionIntent: 'navigate', actionTarget: '/revenue.html' });

    expect(result.graph.validation.valid).toBe(true);
    expect(result.graph.nodeKinds.workspace).toBe(1);
    expect(result.graph.nodeKinds.blueprint).toBe(1);
    expect(result.graph.nodeKinds['component-instance']).toBe(instances.length);
    expect(result.graph.edgeKinds.instantiates).toBe(instances.length);
    expect(result.graph.edgeKinds.visibleTo).toBeGreaterThan(instances.length);
    expect(result.graph.edgeKinds.navigatesTo).toBeGreaterThan(0);

    await testInfo.attach('studio-blueprint-document.json', {
      body: JSON.stringify(result.document, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('studio-blueprint-projection.json', {
      body: JSON.stringify(result.projection, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('studio-blueprint-graph-summary.json', {
      body: JSON.stringify(result.graph, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('studio-blueprint-serialization.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });

    if (runtime.consoleErrors.length) {
      await testInfo.attach('studio-blueprint-console-errors.txt', {
        body: runtime.consoleErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    expect(runtime.pageErrors, 'Blueprint serialization must not emit uncaught page errors.').toEqual([]);
    expect.soft(runtime.consoleErrors, 'Blueprint serialization console errors require review.').toEqual([]);
  });
});
