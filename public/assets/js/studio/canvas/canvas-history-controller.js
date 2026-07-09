function clone(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function chronological(records = []) {
  return [...records].sort((left, right) => {
    const sequence = Number(left.startSequence || 0) - Number(right.startSequence || 0);
    return sequence || Date.parse(left.createdAtClient || 0) - Date.parse(right.createdAtClient || 0);
  });
}

function deriveHistory(records = []) {
  const byId = new Map(records.map((record) => [record.transactionId, record]));
  const undoStack = [];
  const redoStack = [];

  chronological(records).forEach((record) => {
    if (String(record.intent || '').startsWith('canvas.')) {
      undoStack.push(record.transactionId);
      redoStack.length = 0;
      return;
    }
    if (record.intent === 'history.undo' && record.revertsTransactionId) {
      const index = undoStack.lastIndexOf(record.revertsTransactionId);
      if (index >= 0) undoStack.splice(index, 1);
      redoStack.push({ targetTransactionId: record.revertsTransactionId, undoTransactionId: record.transactionId });
      return;
    }
    if (record.intent === 'history.redo' && record.redoesTransactionId) {
      const index = redoStack.map((entry) => entry.targetTransactionId).lastIndexOf(record.redoesTransactionId);
      if (index >= 0) redoStack.splice(index, 1);
      if (byId.has(record.redoesTransactionId)) undoStack.push(record.redoesTransactionId);
    }
  });

  return { byId, undoStack, redoStack };
}

export class HistoryController {
  #journal;
  #dispatchOperations;
  #listeners = new Set();
  #state = { transactions: [], undoStack: [], redoStack: [] };

  constructor({ journal, dispatchOperations } = {}) {
    if (!journal || typeof journal.listTransactions !== 'function') throw new TypeError('HistoryController requires a Canvas journal.');
    if (typeof dispatchOperations !== 'function') throw new TypeError('HistoryController requires dispatchOperations().');
    this.#journal = journal;
    this.#dispatchOperations = dispatchOperations;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('History subscribers must be functions.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    const snapshot = this.snapshot();
    this.#listeners.forEach((listener) => listener(snapshot));
  }

  async initialize() {
    await this.refresh();
    return this.snapshot();
  }

  async refresh() {
    const transactions = await this.#journal.listTransactions();
    const derived = deriveHistory(transactions);
    this.#state = {
      transactions: transactions.map(clone),
      undoStack: [...derived.undoStack],
      redoStack: derived.redoStack.map(clone),
      byId: derived.byId
    };
    this.#emit();
    return this.snapshot();
  }

  snapshot() {
    return {
      transactions: this.#state.transactions.map(clone),
      undoTransactionIds: [...this.#state.undoStack],
      redoEntries: this.#state.redoStack.map(clone),
      canUndo: this.#state.undoStack.length > 0,
      canRedo: this.#state.redoStack.length > 0
    };
  }

  async undo() {
    const targetId = this.#state.undoStack.at(-1);
    if (!targetId) return { changed: false, reason: 'Nothing to undo.' };
    const target = this.#state.byId.get(targetId);
    if (!target?.inverseOperations?.length) return { changed: false, reason: 'The selected transaction has no inverse operations.' };
    const result = await this.#dispatchOperations({
      intent: 'history.undo',
      operations: clone(target.inverseOperations),
      revertsTransactionId: target.transactionId,
      summary: `Undo ${target.intent}`
    });
    await this.refresh();
    return result;
  }

  async redo() {
    const entry = this.#state.redoStack.at(-1);
    if (!entry) return { changed: false, reason: 'Nothing to redo.' };
    const undoRecord = this.#state.byId.get(entry.undoTransactionId);
    if (!undoRecord?.inverseOperations?.length) return { changed: false, reason: 'The undo transaction has no redo operations.' };
    const result = await this.#dispatchOperations({
      intent: 'history.redo',
      operations: clone(undoRecord.inverseOperations),
      redoesTransactionId: entry.targetTransactionId,
      summary: `Redo ${this.#state.byId.get(entry.targetTransactionId)?.intent || 'Canvas transaction'}`,
      metadata: { undoTransactionId: entry.undoTransactionId }
    });
    await this.refresh();
    return result;
  }
}

export const CanvasHistory = Object.freeze({
  create: (options) => new HistoryController(options),
  derive: deriveHistory
});
