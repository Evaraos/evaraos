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

async function openStudioCanvas(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('evaraos-studio-visual-builder-v1');
    localStorage.removeItem('evaraos-studio-auto-layout-v1');
  });
  const response = await page.goto('/website-builder.html', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await expect(page.locator('[data-visual-studio]')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.EvaraCanvasWriterGuard?.snapshot && window.EvaraCanvasSandbox?.open), null, { timeout: 15_000 });
  await page.locator('[data-canvas-sandbox-toggle]').click();
  await expect(page.locator('[data-canvas-sandbox]')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().ready), null, { timeout: 15_000 });
}

async function writerState(page) {
  return page.evaluate(() => document.body.dataset.canvasWriterState || window.EvaraCanvasWriterGuard?.snapshot?.().state || 'unknown');
}

test.describe('authenticated durable CanvasSession', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for CanvasSession validation.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical semantic insert undo redo and reload recovery', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const nodeId = `component_qa_${Date.now().toString(36)}`;
    const before = await page.evaluate(() => {
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      const frame = Object.values(graph.nodes).find((node) => node.kind === 'frame');
      return {
        graphId: graph.graphId,
        revision: graph.revision,
        nodeCount: Object.keys(graph.nodes).length,
        transactionCount: session.snapshot().transactionCount,
        frameId: frame?.id || null
      };
    });
    expect(before.frameId).toBeTruthy();
    expect(before.graphId).toMatch(/^graph:canvas:/);

    const inserted = await page.evaluate(async ({ nodeId, frameId }) => {
      await window.EvaraCanvasSandbox.dispatch('canvas.component.insert', {
        nodeId,
        parentId: frameId,
        componentType: 'glass-card',
        name: 'QA Durable Card',
        span: 4,
        content: { title: 'Durable Canvas QA', body: 'This node must survive reload through operation replay.' }
      });
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      return {
        exists: Boolean(graph.nodes[nodeId]),
        revision: graph.revision,
        nodeCount: Object.keys(graph.nodes).length,
        transactionCount: session.snapshot().transactionCount,
        canUndo: session.snapshot().canUndo
      };
    }, { nodeId, frameId: before.frameId });

    expect(inserted.exists).toBe(true);
    expect(inserted.revision).toBeGreaterThan(before.revision);
    expect(inserted.nodeCount).toBe(before.nodeCount + 1);
    expect(inserted.transactionCount).toBeGreaterThan(before.transactionCount);
    expect(inserted.canUndo).toBe(true);

    const undone = await page.evaluate(async (targetId) => {
      await window.EvaraCanvasSandbox.undo();
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      return {
        exists: Boolean(graph.nodes[targetId]),
        revision: graph.revision,
        canRedo: session.snapshot().canRedo
      };
    }, nodeId);
    expect(undone.exists).toBe(false);
    expect(undone.revision).toBeGreaterThan(inserted.revision);
    expect(undone.canRedo).toBe(true);

    const redone = await page.evaluate(async (targetId) => {
      await window.EvaraCanvasSandbox.redo();
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      return {
        exists: Boolean(graph.nodes[targetId]),
        revision: graph.revision,
        transactionCount: session.snapshot().transactionCount,
        pendingCount: (await window.EvaraCanvasSandbox.pendingTransactions()).length
      };
    }, nodeId);
    expect(redone.exists).toBe(true);
    expect(redone.revision).toBeGreaterThan(undone.revision);
    expect(redone.pendingCount).toBeGreaterThan(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
    await page.waitForFunction(() => Boolean(window.EvaraCanvasWriterGuard?.snapshot && window.EvaraCanvasSandbox?.open), null, { timeout: 15_000 });
    await page.locator('[data-canvas-sandbox-toggle]').click();
    await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().ready), null, { timeout: 15_000 });
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const recovered = await page.evaluate(async (targetId) => {
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      return {
        exists: Boolean(graph.nodes[targetId]),
        revision: graph.revision,
        transactionCount: session.snapshot().transactionCount,
        canUndo: session.snapshot().canUndo,
        pendingCount: (await window.EvaraCanvasSandbox.pendingTransactions()).length,
        durabilityState: session.snapshot().durabilityState
      };
    }, nodeId);

    expect(recovered.exists).toBe(true);
    expect(recovered.revision).toBe(redone.revision);
    expect(recovered.transactionCount).toBe(redone.transactionCount);
    expect(recovered.canUndo).toBe(true);
    expect(recovered.pendingCount).toBeGreaterThan(0);
    expect(recovered.durabilityState).toBe('saved-locally');

    await testInfo.attach('canvas-session-recovery.json', {
      body: JSON.stringify({ before, inserted, undone, redone, recovered }, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('canvas-session-recovery.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });

    if (runtime.consoleErrors.length) {
      await testInfo.attach('canvas-session-console-errors.txt', {
        body: runtime.consoleErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    expect(runtime.pageErrors, 'CanvasSession must not emit uncaught page errors.').toEqual([]);
    expect.soft(runtime.consoleErrors, 'CanvasSession console errors require review.').toEqual([]);
  });

  test('@critical second tab is read-only and takes over after release', async ({ context, page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();

    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const second = await context.newPage();
    await openStudioCanvas(second);
    await expect.poll(() => writerState(second), { timeout: 15_000 }).toBe('read-only');

    const before = await second.evaluate(() => {
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      const frame = Object.values(graph.nodes).find((node) => node.kind === 'frame');
      return {
        graphId: graph.graphId,
        revision: graph.revision,
        nodeCount: Object.keys(graph.nodes).length,
        frameId: frame?.id || null,
        guard: window.EvaraCanvasWriterGuard.snapshot()
      };
    });
    expect(before.frameId).toBeTruthy();
    expect(before.guard.canWrite).toBe(false);

    const blockedNodeId = `component_blocked_${Date.now().toString(36)}`;
    const blocked = await second.evaluate(async ({ nodeId, frameId }) => {
      const result = await window.EvaraCanvasSandbox.dispatch('canvas.component.insert', {
        nodeId,
        parentId: frameId,
        componentType: 'glass-card',
        name: 'Blocked secondary-tab card',
        span: 4,
        content: { title: 'Must not persist' }
      });
      const graph = window.EvaraCanvasSandbox.getSession().getGraph();
      return {
        result,
        exists: Boolean(graph.nodes[nodeId]),
        revision: graph.revision,
        nodeCount: Object.keys(graph.nodes).length,
        state: document.body.dataset.canvasWriterState
      };
    }, { nodeId: blockedNodeId, frameId: before.frameId });

    expect(blocked.result).toBeNull();
    expect(blocked.exists).toBe(false);
    expect(blocked.revision).toBe(before.revision);
    expect(blocked.nodeCount).toBe(before.nodeCount);
    expect(blocked.state).toBe('read-only');

    await page.evaluate(() => window.EvaraCanvasWriterGuard.release());
    await expect.poll(() => writerState(second), { timeout: 20_000 }).toBe('writer');

    const takeoverNodeId = `component_takeover_${Date.now().toString(36)}`;
    const takeover = await second.evaluate(async ({ nodeId, frameId }) => {
      const result = await window.EvaraCanvasSandbox.dispatch('canvas.component.insert', {
        nodeId,
        parentId: frameId,
        componentType: 'glass-card',
        name: 'Writer takeover card',
        span: 4,
        content: { title: 'Writer takeover succeeded' }
      });
      const graph = window.EvaraCanvasSandbox.getSession().getGraph();
      return {
        durable: Boolean(result?.durable),
        exists: Boolean(graph.nodes[nodeId]),
        revision: graph.revision,
        state: document.body.dataset.canvasWriterState,
        guard: window.EvaraCanvasWriterGuard.snapshot()
      };
    }, { nodeId: takeoverNodeId, frameId: before.frameId });

    expect(takeover.durable).toBe(true);
    expect(takeover.exists).toBe(true);
    expect(takeover.revision).toBeGreaterThan(before.revision);
    expect(takeover.state).toBe('writer');
    expect(takeover.guard.canWrite).toBe(true);

    await testInfo.attach('canvas-writer-lease.json', {
      body: JSON.stringify({ before, blocked, takeover }, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('canvas-writer-lease.png', {
      body: await second.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });
  });
});
