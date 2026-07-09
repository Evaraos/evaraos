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

async function installJournalEventCapture(page) {
  await page.addInitScript(() => {
    window.__evaraJournalEvents = [];
    window.addEventListener('evara:studio-journal-status', (event) => {
      window.__evaraJournalEvents.push(JSON.parse(JSON.stringify(event.detail || {})));
    });
  });
}

async function openStudioCanvas(page) {
  await installJournalEventCapture(page);
  await page.addInitScript(() => {
    localStorage.removeItem('evaraos-studio-visual-builder-v1');
    localStorage.removeItem('evaraos-studio-auto-layout-v1');
  });
  const response = await page.goto('/website-builder.html', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await expect(page.locator('[data-visual-studio]')).toBeVisible();
  await page.waitForFunction(() => Boolean(
    window.EvaraCanvasWriterGuard?.snapshot
    && window.EvaraCanvasSandbox?.open
    && window.EvaraCanvasSyncStatus?.snapshot
  ), null, { timeout: 15_000 });
  await page.locator('[data-canvas-sandbox-toggle]').click();
  await expect(page.locator('[data-canvas-sandbox]')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().ready), null, { timeout: 15_000 });
}

async function writerState(page) {
  return page.evaluate(() => document.body.dataset.canvasWriterState || window.EvaraCanvasWriterGuard?.snapshot?.().state || 'unknown');
}

async function insertDurableNode(page, name = 'QA Durable Card') {
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

  const nodeId = `component_qa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const inserted = await page.evaluate(async ({ nodeId, frameId, name }) => {
    const result = await window.EvaraCanvasSandbox.dispatch('canvas.component.insert', {
      nodeId,
      parentId: frameId,
      componentType: 'glass-card',
      name,
      span: 4,
      content: { title: name, body: 'This node must survive through the canonical operation Journal.' }
    });
    const session = window.EvaraCanvasSandbox.getSession();
    const graph = session.getGraph();
    const snapshot = session.snapshot();
    return {
      transactionId: result?.transactionId || null,
      exists: Boolean(graph.nodes[nodeId]),
      revision: graph.revision,
      nodeCount: Object.keys(graph.nodes).length,
      transactionCount: snapshot.transactionCount,
      pendingTransactionCount: snapshot.pendingTransactionCount,
      unsynchronizedChanges: snapshot.unsynchronizedChanges,
      integrityState: snapshot.integrityState,
      headRevision: snapshot.headRevision,
      headSequence: snapshot.headSequence,
      canUndo: snapshot.canUndo
    };
  }, { nodeId, frameId: before.frameId, name });

  expect(inserted.transactionId).toBeTruthy();
  expect(inserted.exists).toBe(true);
  expect(inserted.revision).toBeGreaterThan(before.revision);
  expect(inserted.nodeCount).toBe(before.nodeCount + 1);
  expect(inserted.transactionCount).toBeGreaterThan(before.transactionCount);
  expect(inserted.pendingTransactionCount).toBeGreaterThan(0);
  expect(inserted.unsynchronizedChanges).toBe(true);
  expect(inserted.integrityState).toBe('verified');
  expect(inserted.headRevision).toBe(inserted.revision);
  expect(inserted.headSequence).toBeGreaterThan(0);
  expect(inserted.canUndo).toBe(true);

  return { before, inserted, nodeId };
}

async function openJournalDatabase(page) {
  return page.evaluate(async () => {
    const name = window.EvaraStudioJournal.databaseName;
    const request = indexedDB.open(name);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        request.result.close();
        resolve(name);
      };
      request.onerror = () => reject(request.error || new Error('Journal database could not open.'));
    });
  });
}

async function corruptTransaction(page, transactionId) {
  return page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(window.EvaraStudioJournal.databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Journal database could not open.'));
    });
    try {
      const tx = db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      const record = await new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!record) throw new Error(`Missing transaction ${id}`);
      record.operations = [];
      store.put(record);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
      });
      return { transactionId: id, corrupted: true };
    } finally {
      db.close();
    }
  }, transactionId);
}

async function offsetGraphHead(page, graphId) {
  return page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(window.EvaraStudioJournal.databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Journal database could not open.'));
    });
    try {
      const tx = db.transaction(['sessions'], 'readwrite');
      const store = tx.objectStore('sessions');
      const session = await new Promise((resolve, reject) => {
        const request = store.get('local-studio-session');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!session?.graphHeads?.[id]) throw new Error(`Missing graph head ${id}`);
      session.graphHeads[id] = {
        ...session.graphHeads[id],
        revision: Number(session.graphHeads[id].revision || 0) + 1,
        updatedAt: new Date().toISOString()
      };
      if (session.activeGraphId === id) session.activeGraphRevision = session.graphHeads[id].revision;
      store.put(session);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
      });
      return { graphId: id, revision: session.graphHeads[id].revision };
    } finally {
      db.close();
    }
  }, graphId);
}

async function reloadAndAttemptCanvasRecovery(page) {
  await page.evaluate(() => window.EvaraCanvasWriterGuard?.release?.());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.open && window.EvaraCanvasSyncStatus?.snapshot), null, { timeout: 15_000 });
  await page.locator('[data-canvas-sandbox-toggle]').click();
  await page.waitForFunction(() => window.__evaraJournalEvents?.some((event) => event.state === 'recovery-required'), null, { timeout: 15_000 });
  return page.evaluate(() => ({
    events: window.__evaraJournalEvents,
    sync: window.EvaraCanvasSyncStatus.snapshot(),
    overlayVisible: Boolean(document.querySelector('[data-canvas-sandbox]')),
    toast: document.querySelector('[data-canvas-sandbox-toast]')?.textContent || ''
  }));
}

test.describe('authenticated durable CanvasSession', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for CanvasSession validation.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical semantic insert undo redo and reload recovery', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const { before, inserted, nodeId } = await insertDurableNode(page);
    expect(before.graphId).toMatch(/^graph:canvas:/);
    await expect(page.locator('[data-canvas-sync-status]')).toContainText('local change');
    await expect(page.locator('body')).toHaveAttribute('data-canvas-unsynchronized', 'true');

    const undone = await page.evaluate(async (targetId) => {
      await window.EvaraCanvasSandbox.undo();
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      const snapshot = session.snapshot();
      return {
        exists: Boolean(graph.nodes[targetId]),
        revision: graph.revision,
        canRedo: snapshot.canRedo,
        pendingTransactionCount: snapshot.pendingTransactionCount,
        integrityState: snapshot.integrityState
      };
    }, nodeId);
    expect(undone.exists).toBe(false);
    expect(undone.revision).toBeGreaterThan(inserted.revision);
    expect(undone.canRedo).toBe(true);
    expect(undone.pendingTransactionCount).toBeGreaterThan(inserted.pendingTransactionCount);
    expect(undone.integrityState).toBe('verified');

    const redone = await page.evaluate(async (targetId) => {
      await window.EvaraCanvasSandbox.redo();
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      const snapshot = session.snapshot();
      return {
        exists: Boolean(graph.nodes[targetId]),
        revision: graph.revision,
        transactionCount: snapshot.transactionCount,
        pendingCount: (await window.EvaraCanvasSandbox.pendingTransactions()).length,
        pendingTransactionCount: snapshot.pendingTransactionCount,
        unsynchronizedChanges: snapshot.unsynchronizedChanges,
        headRevision: snapshot.headRevision
      };
    }, nodeId);
    expect(redone.exists).toBe(true);
    expect(redone.revision).toBeGreaterThan(undone.revision);
    expect(redone.pendingCount).toBeGreaterThan(0);
    expect(redone.pendingTransactionCount).toBe(redone.pendingCount);
    expect(redone.unsynchronizedChanges).toBe(true);
    expect(redone.headRevision).toBe(redone.revision);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
    await page.waitForFunction(() => Boolean(window.EvaraCanvasWriterGuard?.snapshot && window.EvaraCanvasSandbox?.open), null, { timeout: 15_000 });
    await page.locator('[data-canvas-sandbox-toggle]').click();
    await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().ready), null, { timeout: 15_000 });
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const recovered = await page.evaluate(async (targetId) => {
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      const snapshot = session.snapshot();
      return {
        exists: Boolean(graph.nodes[targetId]),
        revision: graph.revision,
        transactionCount: snapshot.transactionCount,
        canUndo: snapshot.canUndo,
        pendingCount: (await window.EvaraCanvasSandbox.pendingTransactions()).length,
        pendingTransactionCount: snapshot.pendingTransactionCount,
        durabilityState: snapshot.durabilityState,
        integrityState: snapshot.integrityState,
        headRevision: snapshot.headRevision,
        headSequence: snapshot.headSequence,
        unsynchronizedChanges: snapshot.unsynchronizedChanges
      };
    }, nodeId);

    expect(recovered.exists).toBe(true);
    expect(recovered.revision).toBe(redone.revision);
    expect(recovered.transactionCount).toBe(redone.transactionCount);
    expect(recovered.canUndo).toBe(true);
    expect(recovered.pendingCount).toBeGreaterThan(0);
    expect(recovered.pendingTransactionCount).toBe(recovered.pendingCount);
    expect(recovered.durabilityState).toBe('saved-locally');
    expect(recovered.integrityState).toBe('verified');
    expect(recovered.headRevision).toBe(recovered.revision);
    expect(recovered.headSequence).toBeGreaterThan(0);
    expect(recovered.unsynchronizedChanges).toBe(true);

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

  test('@critical corrupted Canvas transaction fails closed with recovery-required', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');
    await openJournalDatabase(page);

    const { inserted } = await insertDurableNode(page, 'Corruption recovery probe');
    const corruption = await corruptTransaction(page, inserted.transactionId);
    expect(corruption.corrupted).toBe(true);

    const recovery = await reloadAndAttemptCanvasRecovery(page);
    const event = recovery.events.find((item) => item.recoveryCode === 'canvas-transaction-integrity');
    expect(event).toBeTruthy();
    expect(event.state).toBe('recovery-required');
    expect(recovery.overlayVisible).toBe(false);
    expect(recovery.sync.integrityState).toBe('recovery-required');
    expect(recovery.toast).toMatch(/integrity|recovery/i);
    await expect(page.locator('body')).toHaveAttribute('data-canvas-integrity-state', 'recovery-required');

    await testInfo.attach('canvas-corrupt-transaction-recovery.json', {
      body: JSON.stringify({ corruption, recovery }, null, 2),
      contentType: 'application/json'
    });
  });

  test('@critical graph-head mismatch fails closed and requires refresh', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const { before } = await insertDurableNode(page, 'Graph head mismatch probe');
    const mismatch = await offsetGraphHead(page, before.graphId);
    expect(mismatch.revision).toBeGreaterThan(0);

    const recovery = await reloadAndAttemptCanvasRecovery(page);
    const event = recovery.events.find((item) => item.recoveryCode === 'canvas-graph-head-mismatch');
    expect(event).toBeTruthy();
    expect(event.state).toBe('recovery-required');
    expect(recovery.overlayVisible).toBe(false);
    expect(recovery.sync.integrityState).toBe('recovery-required');
    expect(recovery.toast).toMatch(/head mismatch|recovery/i);

    await testInfo.attach('canvas-graph-head-mismatch-recovery.json', {
      body: JSON.stringify({ mismatch, recovery }, null, 2),
      contentType: 'application/json'
    });
  });
});
