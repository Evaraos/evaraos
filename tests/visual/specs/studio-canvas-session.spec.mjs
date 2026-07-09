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

async function installStudioBoot(page) {
  if (appCheckDebugToken) {
    await page.addInitScript((token) => {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
    }, appCheckDebugToken);
  }
  await page.addInitScript(() => {
    window.__evaraJournalEvents = [];
    window.__evaraAppCheckEvents = [];
    localStorage.removeItem('evaraos-studio-visual-builder-v1');
    localStorage.removeItem('evaraos-studio-auto-layout-v1');
    window.addEventListener('evara:studio-journal-status', (event) => {
      window.__evaraJournalEvents.push(JSON.parse(JSON.stringify(event.detail || {})));
    });
    window.addEventListener('evara:trusted-studio-journal', (event) => {
      window.__evaraJournalEvents.push(JSON.parse(JSON.stringify(event.detail || {})));
    });
    window.addEventListener('evara:app-check-status', (event) => {
      window.__evaraAppCheckEvents.push(JSON.parse(JSON.stringify(event.detail || {})));
    });
  });
}

async function openStudioCanvas(page) {
  await installStudioBoot(page);
  const response = await page.goto('/website-builder.html', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await expect(page.locator('[data-visual-studio]')).toBeVisible();
  await page.waitForFunction(() => Boolean(
    window.EvaraAppCheckReadiness?.snapshot?.().state === 'ready'
    && window.EvaraTrustedStudioJournal?.snapshot
    && window.EvaraCanvasWriterGuard?.snapshot
    && window.EvaraCanvasSandbox?.open
    && window.EvaraCanvasSyncStatus?.snapshot
    && window.EvaraStudioJournal?.idempotencyGuardVersion
  ), null, { timeout: 30_000 });
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
      durabilityState: snapshot.durabilityState,
      canUndo: snapshot.canUndo
    };
  }, { nodeId, frameId: before.frameId, name });

  expect(inserted.transactionId).toBeTruthy();
  expect(inserted.exists).toBe(true);
  expect(inserted.revision).toBeGreaterThan(before.revision);
  expect(inserted.nodeCount).toBe(before.nodeCount + 1);
  expect(inserted.transactionCount).toBeGreaterThan(before.transactionCount);
  expect(inserted.pendingTransactionCount).toBeGreaterThanOrEqual(0);
  expect(inserted.unsynchronizedChanges).toBe(inserted.pendingTransactionCount > 0);
  expect(inserted.integrityState).toBe('verified');
  expect(inserted.headRevision).toBe(inserted.revision);
  expect(inserted.headSequence).toBeGreaterThan(0);
  expect(inserted.canUndo).toBe(true);
  return { before, inserted, nodeId };
}

async function mutateJournal(page, action, payload) {
  return page.evaluate(async ({ action, payload }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(window.EvaraStudioJournal.databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Journal database could not open.'));
    });
    const requestValue = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Journal request failed.'));
    });
    try {
      if (action === 'configure-scope') {
        const transaction = database.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        const session = await requestValue(store.get('local-studio-session'));
        const next = { ...session, projectId: payload.projectId, branchId: payload.branchId, updatedAt: new Date().toISOString() };
        store.put(next);
        await new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
        });
        return next;
      }
      if (action === 'corrupt-transaction') {
        const transaction = database.transaction(['transactions'], 'readwrite');
        const store = transaction.objectStore('transactions');
        const record = await requestValue(store.get(payload.transactionId));
        if (!record) throw new Error(`Missing transaction ${payload.transactionId}`);
        record.operations = [];
        store.put(record);
        await new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
        });
        return { transactionId: payload.transactionId, corrupted: true };
      }
      if (action === 'offset-graph-head') {
        const transaction = database.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        const session = await requestValue(store.get('local-studio-session'));
        if (!session?.graphHeads?.[payload.graphId]) throw new Error(`Missing graph head ${payload.graphId}`);
        session.graphHeads[payload.graphId] = {
          ...session.graphHeads[payload.graphId],
          revision: Number(session.graphHeads[payload.graphId].revision || 0) + 1,
          updatedAt: new Date().toISOString()
        };
        if (session.activeGraphId === payload.graphId) session.activeGraphRevision = session.graphHeads[payload.graphId].revision;
        store.put(session);
        await new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
        });
        return { graphId: payload.graphId, revision: session.graphHeads[payload.graphId].revision };
      }
      throw new Error(`Unsupported Journal test mutation: ${action}`);
    } finally {
      database.close();
    }
  }, { action, payload });
}

async function configureTrustedScope(page, projectId, branchId) {
  return mutateJournal(page, 'configure-scope', { projectId, branchId });
}

async function corruptTransaction(page, transactionId) {
  return mutateJournal(page, 'corrupt-transaction', { transactionId });
}

async function offsetGraphHead(page, graphId) {
  return mutateJournal(page, 'offset-graph-head', { graphId });
}

async function reloadAndAttemptCanvasRecovery(page, { offsetGraphId = null } = {}) {
  await page.evaluate(() => window.EvaraCanvasWriterGuard?.release?.());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.open && window.EvaraCanvasSyncStatus?.snapshot), null, { timeout: 15_000 });
  const injected = offsetGraphId ? await offsetGraphHead(page, offsetGraphId) : null;
  await page.locator('[data-canvas-sandbox-toggle]').click();
  await page.waitForFunction(() => window.__evaraJournalEvents?.some((event) => event.state === 'recovery-required'), null, { timeout: 15_000 });
  return page.evaluate((injectedMismatch) => ({
    events: window.__evaraJournalEvents,
    sync: window.EvaraCanvasSyncStatus.snapshot(),
    overlayVisible: Boolean(document.querySelector('[data-canvas-sandbox]')),
    toast: document.querySelector('[data-canvas-sandbox-toast]')?.textContent || '',
    injected: injectedMismatch
  }), injected);
}

test.describe('authenticated durable CanvasSession — corruption and graph-head recovery validation', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for CanvasSession validation.');
  test.skip(Boolean(process.env.CI) && !appCheckDebugToken, 'EVARA_QA_APP_CHECK_DEBUG_TOKEN is required for authenticated CI.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical semantic insert undo redo and reload recovery', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');
    const { before, inserted, nodeId } = await insertDurableNode(page);
    expect(before.graphId).toMatch(/^graph:canvas:/);
    await expect(page.locator('[data-canvas-sync-status]')).toContainText(/local change|server confirmed|saved offline|syncing/i);
    await expect(page.locator('body')).toHaveAttribute('data-canvas-unsynchronized', /^(true|false)$/);

    const undone = await page.evaluate(async (targetId) => {
      await window.EvaraCanvasSandbox.undo();
      const session = window.EvaraCanvasSandbox.getSession();
      return {
        exists: Boolean(session.getGraph().nodes[targetId]),
        revision: session.getGraph().revision,
        canRedo: session.snapshot().canRedo,
        pendingTransactionCount: session.snapshot().pendingTransactionCount,
        unsynchronizedChanges: session.snapshot().unsynchronizedChanges,
        integrityState: session.snapshot().integrityState
      };
    }, nodeId);
    expect(undone.exists).toBe(false);
    expect(undone.revision).toBeGreaterThan(inserted.revision);
    expect(undone.canRedo).toBe(true);
    expect(undone.unsynchronizedChanges).toBe(undone.pendingTransactionCount > 0);
    expect(undone.integrityState).toBe('verified');

    const redone = await page.evaluate(async (targetId) => {
      await window.EvaraCanvasSandbox.redo();
      const session = window.EvaraCanvasSandbox.getSession();
      const pendingCount = (await window.EvaraCanvasSandbox.pendingTransactions()).length;
      return {
        exists: Boolean(session.getGraph().nodes[targetId]),
        revision: session.getGraph().revision,
        transactionCount: session.snapshot().transactionCount,
        pendingCount,
        pendingTransactionCount: session.snapshot().pendingTransactionCount,
        unsynchronizedChanges: session.snapshot().unsynchronizedChanges,
        headRevision: session.snapshot().headRevision
      };
    }, nodeId);
    expect(redone.exists).toBe(true);
    expect(redone.revision).toBeGreaterThan(undone.revision);
    expect(redone.pendingTransactionCount).toBe(redone.pendingCount);
    expect(redone.unsynchronizedChanges).toBe(redone.pendingCount > 0);
    expect(redone.headRevision).toBe(redone.revision);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body?.classList.contains('app-ready'), null, { timeout: 30_000 });
    await page.waitForFunction(() => Boolean(window.EvaraCanvasWriterGuard?.snapshot && window.EvaraCanvasSandbox?.open), null, { timeout: 15_000 });
    await page.locator('[data-canvas-sandbox-toggle]').click();
    await page.waitForFunction(() => Boolean(window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().ready), null, { timeout: 15_000 });
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');

    const recovered = await page.evaluate(async (targetId) => {
      const session = window.EvaraCanvasSandbox.getSession();
      const pendingCount = (await window.EvaraCanvasSandbox.pendingTransactions()).length;
      return {
        exists: Boolean(session.getGraph().nodes[targetId]),
        revision: session.getGraph().revision,
        transactionCount: session.snapshot().transactionCount,
        pendingCount,
        pendingTransactionCount: session.snapshot().pendingTransactionCount,
        durabilityState: session.snapshot().durabilityState,
        integrityState: session.snapshot().integrityState,
        headRevision: session.snapshot().headRevision,
        headSequence: session.snapshot().headSequence,
        unsynchronizedChanges: session.snapshot().unsynchronizedChanges,
        appCheck: window.EvaraAppCheckReadiness.snapshot()
      };
    }, nodeId);
    expect(recovered.exists).toBe(true);
    expect(recovered.revision).toBe(redone.revision);
    expect(recovered.pendingTransactionCount).toBe(recovered.pendingCount);
    expect(recovered.integrityState).toBe('verified');
    expect(recovered.headRevision).toBe(recovered.revision);
    expect(recovered.headSequence).toBeGreaterThan(0);
    expect(recovered.unsynchronizedChanges).toBe(recovered.pendingCount > 0);
    expect(recovered.appCheck.state).toBe('ready');
    expect(recovered.appCheck.loaded).toBe(true);

    await testInfo.attach('canvas-session-recovery.json', { body: JSON.stringify({ before, inserted, undone, redone, recovered }, null, 2), contentType: 'application/json' });
    await testInfo.attach('canvas-session-recovery.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
    if (runtime.consoleErrors.length) await testInfo.attach('canvas-session-console-errors.txt', { body: runtime.consoleErrors.join('\n'), contentType: 'text/plain' });
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
      return { revision: graph.revision, nodeCount: Object.keys(graph.nodes).length, frameId: frame?.id || null, guard: window.EvaraCanvasWriterGuard?.snapshot() };
    });
    const blockedNodeId = `component_blocked_${Date.now().toString(36)}`;
    const blocked = await second.evaluate(async ({ nodeId, frameId }) => {
      const result = await window.EvaraCanvasSandbox.dispatch('canvas.component.insert', { nodeId, parentId: frameId, componentType: 'glass-card', name: 'Blocked secondary-tab card', span: 4, content: { title: 'Must not persist' } });
      const graph = window.EvaraCanvasSandbox.getSession().getGraph();
      return { result, exists: Boolean(graph.nodes[nodeId]), revision: graph.revision, nodeCount: Object.keys(graph.nodes).length, state: document.body.dataset.canvasWriterState };
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
      const result = await window.EvaraCanvasSandbox.dispatch('canvas.component.insert', { nodeId, parentId: frameId, componentType: 'glass-card', name: 'Writer takeover card', span: 4, content: { title: 'Writer takeover succeeded' } });
      const graph = window.EvaraCanvasSandbox.getSession().getGraph();
      return { durable: Boolean(result?.durable), exists: Boolean(graph.nodes[nodeId]), revision: graph.revision, state: document.body.dataset.canvasWriterState, guard: window.EvaraCanvasWriterGuard.snapshot() };
    }, { nodeId: takeoverNodeId, frameId: before.frameId });
    expect(takeover.durable).toBe(true);
    expect(takeover.exists).toBe(true);
    expect(takeover.revision).toBeGreaterThan(before.revision);
    expect(takeover.state).toBe('writer');
    expect(takeover.guard.canWrite).toBe(true);
    await testInfo.attach('canvas-writer-lease.json', { body: JSON.stringify({ before, blocked, takeover }, null, 2), contentType: 'application/json' });
  });

  test('@critical local transaction IDs are idempotent and conflicting reuse fails closed', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');
    const { inserted } = await insertDurableNode(page, 'Local idempotency probe');
    const result = await page.evaluate(async (transactionId) => {
      const record = (await window.EvaraStudioJournal.listOperationTransactions()).find((item) => item.transactionId === transactionId);
      const same = await window.EvaraStudioJournal.appendOperationTransaction(JSON.parse(JSON.stringify(record)));
      let conflict = null;
      try {
        await window.EvaraStudioJournal.appendOperationTransaction({ ...JSON.parse(JSON.stringify(record)), summary: `${record.summary} changed-content` });
      } catch (error) {
        conflict = String(error?.message || error);
      }
      return { originalId: record.transactionId, duplicateId: same.transactionId, conflict, guardVersion: window.EvaraStudioJournal.idempotencyGuardVersion };
    }, inserted.transactionId);
    expect(result.duplicateId).toBe(result.originalId);
    expect(result.conflict).toMatch(/reused with different content/i);
    expect(result.guardVersion).toBe('studio-journal-idempotency-guard-v1');
    await testInfo.attach('canvas-local-idempotency.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  });

  test('@critical trusted synchronization checkpoint and immutable release are server confirmed', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');
    const projectId = `qa-studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await configureTrustedScope(page, projectId, 'main');
    const { inserted } = await insertDurableNode(page, 'Trusted release probe');
    const result = await page.evaluate(async (transactionId) => {
      const adapter = window.EvaraTrustedStudioJournal;
      const session = window.EvaraCanvasSandbox.getSession();
      const graph = session.getGraph();
      const sync = await adapter.syncGraph(graph.graphId);
      const confirmed = (await window.EvaraStudioJournal.listOperationTransactions(graph.graphId)).find((record) => record.transactionId === transactionId);
      const retry = await adapter.commit(confirmed);
      const checkpoint = await adapter.checkpoint(graph, 'qa-trusted-checkpoint');
      const latest = await window.EvaraStudioJournal.latestTrustedCheckpoint(graph.graphId);
      const release = await adapter.release(graph, { releaseId: `release-${Date.now().toString(36)}` });
      const pending = await window.EvaraStudioJournal.listPendingOperationTransactions(graph.graphId);
      return { sync, confirmedState: confirmed?.durabilityState, startSequence: confirmed?.startSequence, endSequence: confirmed?.endSequence, retryIdempotent: retry?.idempotent, checkpoint, latestCheckpointId: latest?.checkpointId, pendingCount: pending.length, release: release.release, releaseIdempotent: release.idempotent, appCheck: window.EvaraAppCheckReadiness.snapshot() };
    }, inserted.transactionId);
    expect(result.confirmedState).toBe('server-confirmed');
    expect(result.startSequence).toBeGreaterThan(0);
    expect(result.endSequence).toBeGreaterThanOrEqual(result.startSequence);
    expect(result.retryIdempotent).toBe(true);
    expect(result.checkpoint.trusted).toBe(true);
    expect(result.latestCheckpointId).toBe(result.checkpoint.checkpointId);
    expect(result.pendingCount).toBe(0);
    expect(result.release.immutable).toBe(true);
    expect(result.release.status).toBe('prepared');
    expect(result.appCheck.state).toBe('ready');
    await testInfo.attach('canvas-trusted-release.json', { body: JSON.stringify({ projectId, result }, null, 2), contentType: 'application/json' });
    await testInfo.attach('canvas-trusted-release.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
  });

  test('@critical corrupted Canvas transaction fails closed with recovery-required', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');
    const { inserted } = await insertDurableNode(page, 'Corruption recovery probe');
    const corruption = await corruptTransaction(page, inserted.transactionId);
    const recovery = await reloadAndAttemptCanvasRecovery(page);
    const event = recovery.events.find((item) => item.recoveryCode === 'canvas-transaction-integrity');
    expect(corruption.corrupted).toBe(true);
    expect(event?.state).toBe('recovery-required');
    expect(recovery.overlayVisible).toBe(false);
    expect(recovery.sync.integrityState).toBe('recovery-required');
    expect(recovery.toast).toMatch(/integrity|recovery/i);
    await expect(page.locator('body')).toHaveAttribute('data-canvas-integrity-state', 'recovery-required');
    await testInfo.attach('canvas-corrupt-transaction-recovery.json', { body: JSON.stringify({ corruption, recovery }, null, 2), contentType: 'application/json' });
  });

  test('@critical graph-head mismatch fails closed and requires refresh', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    await openStudioCanvas(page);
    await expect.poll(() => writerState(page), { timeout: 15_000 }).toBe('writer');
    const { before } = await insertDurableNode(page, 'Graph head mismatch probe');
    const recovery = await reloadAndAttemptCanvasRecovery(page, { offsetGraphId: before.graphId });
    const event = recovery.events.find((item) => item.recoveryCode === 'canvas-graph-head-mismatch');
    expect(recovery.injected.revision).toBeGreaterThan(0);
    expect(event?.state).toBe('recovery-required');
    expect(recovery.overlayVisible).toBe(false);
    expect(recovery.sync.integrityState).toBe('recovery-required');
    expect(recovery.toast).toMatch(/head mismatch|recovery/i);
    await testInfo.attach('canvas-graph-head-mismatch-recovery.json', { body: JSON.stringify({ mismatch: recovery.injected, recovery }, null, 2), contentType: 'application/json' });
  });
});
