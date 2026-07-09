import { test, expect } from '@playwright/test';
import {
  ROLE_DEFINITIONS,
  credentialsFor,
  storageStatePath
} from '../visual-matrix.mjs';

const ownerRole = ROLE_DEFINITIONS.find((role) => role.id === 'owner');
const ownerAvailable = Boolean(ownerRole && credentialsFor(ownerRole).available);
const GRAPH_ID = 'graph:studio:owner:owner-dashboard';

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
  await page.waitForFunction(() => Boolean(
    window.EvaraStudioJournal?.appendOperationTransaction
    && window.EvaraBlueprintOperationAdapter?.flush
  ), null, { timeout: 20_000 });
  await expect(page.locator('[data-visual-studio]')).toHaveAttribute('data-operation-adapter', 'blueprint-operation-adapter-v1');
}

async function operationCount(page) {
  return page.evaluate(async (graphId) => (await window.EvaraStudioJournal.listOperationTransactions(graphId)).length, GRAPH_ID);
}

async function waitForOperationCount(page, minimum) {
  await page.waitForFunction(async ({ graphId, minimumCount }) => {
    const entries = await window.EvaraStudioJournal?.listOperationTransactions?.(graphId);
    return Array.isArray(entries) && entries.length >= minimumCount;
  }, { graphId: GRAPH_ID, minimumCount: minimum }, { timeout: 20_000 });
}

test.describe('authenticated Studio Blueprint operation journal', () => {
  test.skip(!ownerAvailable, 'Owner QA credentials are required for Blueprint operation validation.');
  test.use({ storageState: ownerRole ? storageStatePath(ownerRole.id) : undefined });

  test('@critical semantic component edits become durable reversible transactions', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-chromium') test.skip();
    const runtime = diagnostics(page);
    await openCleanStudio(page);

    const beforeCount = await operationCount(page);
    await page.locator('[data-catalog-tool="components"]').click();
    await page.locator('[data-add-component="notice-banner"]').click();
    await waitForOperationCount(page, beforeCount + 1);

    let transactions = await page.evaluate(async (graphId) => window.EvaraStudioJournal.listOperationTransactions(graphId), GRAPH_ID);
    const inserted = transactions[0];
    expect(inserted.envelopeVersion).toBe('studio-journal-operation-envelope-v1');
    expect(inserted.graphId).toBe(GRAPH_ID);
    expect(inserted.intent).toBe('canvas.component.insert');
    expect(inserted.semanticCommand).toMatchObject({
      version: 'canvas-semantic-command-v1',
      type: 'canvas.component.insert'
    });
    expect(inserted.semanticCommand.intents).toContain('canvas.component.insert');
    expect(inserted.operations.length).toBeGreaterThan(1);
    expect(inserted.inverseOperations.length).toBeGreaterThan(0);
    expect(inserted.commitOperation.type).toBe('transaction.commit');
    expect(inserted.commitOperation.transactionId).toBe(inserted.transactionId);
    expect(inserted.acceptedHeadRevision).toBeGreaterThan(inserted.expectedHeadRevision);
    expect(inserted.durabilityState).toBe('saved-locally');
    expect(inserted.sourceFingerprint).toMatch(/^bp_[0-9a-f]{8}$/);
    expect(inserted.operations.every((operation) => operation.type !== 'compatibility.projection.replace')).toBe(true);
    expect(inserted.operations.every((operation) => operation.metadata?.adapterVersion === 'blueprint-operation-adapter-v1')).toBe(true);

    const countAfterInsert = transactions.length;
    const duplicateResult = await page.evaluate(async ({ graphId, transactionId }) => {
      const list = await window.EvaraStudioJournal.listOperationTransactions(graphId);
      const transaction = list.find((item) => item.transactionId === transactionId);
      const returned = await window.EvaraStudioJournal.appendOperationTransaction(transaction);
      const after = await window.EvaraStudioJournal.listOperationTransactions(graphId);
      return { returned, count: after.length };
    }, { graphId: GRAPH_ID, transactionId: inserted.transactionId });
    expect(duplicateResult.returned.transactionId).toBe(inserted.transactionId);
    expect(duplicateResult.count).toBe(countAfterInsert);

    const insertedNode = page.locator('.studio-node[data-node-type="notice-banner"]').last();
    await insertedNode.click();
    await page.locator('[data-catalog-tool="properties"]').click();
    let properties = page.locator('[data-catalog-sheet="properties"]');
    const titleField = properties.locator('[data-property-field="title"]');
    await titleField.fill('Durable operation notice');
    await titleField.blur();
    await waitForOperationCount(page, countAfterInsert + 1);

    await page.locator('[data-auto-layout-tool]').click();
    await page.locator('[data-auto-action="create"]').click();
    await expect(page.locator('[data-auto-layout-group]')).toHaveCount(1);
    await waitForOperationCount(page, countAfterInsert + 2);

    await windowFlush(page);
    transactions = await page.evaluate(async (graphId) => window.EvaraStudioJournal.listOperationTransactions(graphId), GRAPH_ID);
    const latestThree = transactions.slice(0, 3);
    expect(latestThree.some((transaction) => transaction.intent === 'canvas.property.set')).toBe(true);
    expect(latestThree.some((transaction) => transaction.intent === 'canvas.layout.set')).toBe(true);

    const head = await page.evaluate((graphId) => window.EvaraStudioJournal.getGraphHead(graphId), GRAPH_ID);
    expect(head.graphId).toBe(GRAPH_ID);
    expect(head.revision).toBe(latestThree[0].acceptedHeadRevision);
    expect(head.sequence).toBeGreaterThanOrEqual(3);
    expect(head.lastTransactionId).toBe(latestThree[0].transactionId);

    const allTransactions = await page.evaluate(() => window.EvaraStudioJournal.listTransactions());
    const operationTransactions = allTransactions.filter((transaction) => transaction.envelopeVersion === 'studio-journal-operation-envelope-v1');
    const compatibilityForLatestProjection = allTransactions.filter((transaction) =>
      transaction.envelopeVersion === 'compatibility-projection-v1'
      && transaction.projectionHash
      && transaction.projectionHash === latestThree[0].projectionHash
    );
    expect(operationTransactions.length).toBeGreaterThanOrEqual(3);
    expect(compatibilityForLatestProjection).toHaveLength(0);

    await testInfo.attach('studio-blueprint-operation-transactions.json', {
      body: JSON.stringify(latestThree, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('studio-blueprint-operation-head.json', {
      body: JSON.stringify(head, null, 2),
      contentType: 'application/json'
    });
    await testInfo.attach('studio-blueprint-operations.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });

    if (runtime.consoleErrors.length) {
      await testInfo.attach('studio-blueprint-operation-console-errors.txt', {
        body: runtime.consoleErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    expect(runtime.pageErrors, 'Blueprint operation journaling must not emit uncaught page errors.').toEqual([]);
    expect.soft(runtime.consoleErrors, 'Blueprint operation console errors require review.').toEqual([]);
  });
});

async function windowFlush(page) {
  await page.evaluate(async () => {
    await window.EvaraBlueprintOperationAdapter.flush();
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
}
