import { CanvasWriterLease } from './canvas-writer-lease.js';

const CANVAS_GRAPH_PREFIX = 'graph:canvas:';
let activeGraphId = null;
let lease = null;
let leasePromise = null;
let guardState = 'idle';
let previousLeaseState = 'idle';
let suspended = false;

function journal() {
  const api = window.EvaraStudioJournal;
  if (!api?.appendOperationTransaction || !api?.getGraphHead) {
    throw new Error('The canonical Studio operation Journal is unavailable.');
  }
  return api;
}

function sessionSnapshot() {
  return window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.() || null;
}

function currentLeaseResult() {
  const snapshot = lease?.snapshot?.() || { graphId: activeGraphId, method: 'none' };
  return {
    ...snapshot,
    state: guardState,
    canWrite: guardState === 'writer'
  };
}

function publishState(state, reason, leaseSnapshot = null, { updateSession = true } = {}) {
  previousLeaseState = guardState;
  guardState = state;
  document.body.dataset.canvasWriterState = state;
  document.body.dataset.canvasWriterMethod = leaseSnapshot?.method || lease?.snapshot?.().method || 'none';
  window.dispatchEvent(new CustomEvent('evara:canvas-writer-guard', {
    detail: {
      graphId: activeGraphId,
      state,
      canWrite: state === 'writer',
      reason,
      method: document.body.dataset.canvasWriterMethod
    }
  }));
  const session = window.EvaraCanvasSandbox?.getSession?.();
  if (updateSession && session?.setDurabilityState) {
    const durability = state === 'writer' ? 'saved-locally' : 'read-only';
    session.setDurabilityState(durability, `writer-guard:${reason}`).catch(() => undefined);
  }
}

async function verifyCurrentHead(graphId) {
  const snapshot = sessionSnapshot();
  if (!snapshot || snapshot.graphId !== graphId) return true;
  const head = await journal().getGraphHead(graphId);
  return Number(head?.revision || 0) === Number(snapshot.graphRevision || 0);
}

async function acquireForGraph(graphId) {
  if (!String(graphId || '').startsWith(CANVAS_GRAPH_PREFIX)) return { state: 'not-canvas', canWrite: true };
  if (suspended) return { state: 'released', canWrite: false };
  if (activeGraphId === graphId && leasePromise) {
    await leasePromise.catch(() => undefined);
    return currentLeaseResult();
  }

  lease?.release();
  lease = new CanvasWriterLease(graphId);
  activeGraphId = graphId;
  publishState('acquiring', 'lease-requested', lease.snapshot());
  lease.subscribe(async (next, event) => {
    if (suspended) return;
    if (next.state === 'writer') {
      const current = await verifyCurrentHead(graphId).catch(() => false);
      publishState(current ? 'writer' : 'refresh-required', current ? event.reason : 'stale-graph-head', next);
      return;
    }
    publishState(next.state, event.reason, next);
  });

  leasePromise = lease.acquire().then(async (next) => {
    if (suspended) return { ...next, state: 'released', canWrite: false };
    if (next.state !== 'writer') {
      publishState(next.state, 'lease-acquired-read-only', next);
      return currentLeaseResult();
    }
    const current = await verifyCurrentHead(graphId).catch(() => false);
    const state = current ? 'writer' : 'refresh-required';
    publishState(state, current ? 'lease-acquired-writer' : 'stale-graph-head', next);
    return currentLeaseResult();
  });
  await leasePromise;
  return currentLeaseResult();
}

function installJournalGuard() {
  const current = journal();
  if (current.writerLeaseGuardVersion) return;
  const append = current.appendOperationTransaction.bind(current);
  const guarded = async (envelope) => {
    const graphId = String(envelope?.graphId || '');
    if (graphId.startsWith(CANVAS_GRAPH_PREFIX)) {
      const writer = await acquireForGraph(graphId);
      if (!writer.canWrite) {
        const reason = writer.state === 'refresh-required'
          ? 'This Canvas tab is stale. Reload before editing the latest graph head.'
          : 'This Canvas draft is read-only because another Studio tab owns the writer lease.';
        throw new Error(reason);
      }
    }
    return append(envelope);
  };
  window.EvaraStudioJournal = Object.freeze({
    ...current,
    appendOperationTransaction: guarded,
    writerLeaseGuardVersion: 'canvas-writer-guard-v1'
  });
}

function release() {
  suspended = true;
  lease?.release();
  lease = null;
  leasePromise = null;
  activeGraphId = null;
  publishState('released', 'manual-release', null, { updateSession: false });
}

function resume(graphId = sessionSnapshot()?.graphId || '') {
  suspended = false;
  return acquireForGraph(graphId);
}

window.addEventListener('evara:canvas-session-change', (event) => {
  if (suspended) return;
  const graphId = String(event.detail?.graphId || '');
  if (!graphId.startsWith(CANVAS_GRAPH_PREFIX)) return;
  acquireForGraph(graphId).catch((error) => publishState('read-only', String(error?.message || error).slice(0, 120)));
});

window.EvaraCanvasWriterGuard = Object.freeze({
  version: 'canvas-writer-guard-v1',
  acquireForGraph,
  release,
  resume,
  snapshot: () => ({
    graphId: activeGraphId,
    state: guardState,
    previousState: previousLeaseState,
    canWrite: guardState === 'writer',
    suspended,
    lease: lease?.snapshot?.() || null
  })
});

installJournalGuard();
