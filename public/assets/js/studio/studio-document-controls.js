let panelOpen = false;
let enhancementFrame = 0;
let statusCache = null;
let publishing = false;

const api = () => window.EvaraStudioJournal;
const trusted = () => window.EvaraTrustedStudioJournal;
const workspace = () => document.querySelector('.studio-workspace');

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  if (options.title) node.title = String(options.title);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function formatTime(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toast(message, tone = 'info') {
  let node = document.querySelector('[data-document-toast]');
  if (!node) {
    node = make('div', { className: 'studio-document-toast', dataset: { documentToast: 'true' }, attrs: { role: 'status' } });
    document.body.append(node);
  }
  node.textContent = String(message);
  node.dataset.tone = tone;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 3600);
}

function closeCompetingPanels() {
  document.querySelector('.studio-dock-button.is-active[data-sheet]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('[data-layout-tool="layers"].is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('[data-auto-layout-tool].is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function injectControls() {
  const actions = document.querySelector('.studio-top-actions');
  if (!actions || actions.querySelector('[data-journal-status]')) return;
  actions.prepend(
    make('button', {
      className: 'studio-document-status',
      type: 'button',
      text: 'Local journal',
      title: 'Open draft journal and recovery',
      dataset: { journalStatus: 'true', journalAction: 'toggle', state: 'saved-locally' }
    }),
    make('button', {
      className: 'studio-icon-button studio-document-history-button',
      type: 'button',
      text: 'J',
      title: 'Draft journal and recovery',
      dataset: { journalAction: 'toggle' },
      attrs: { 'aria-label': 'Open draft journal and recovery' }
    })
  );
}

function checkpointRow(checkpoint) {
  const trustedCanvas = checkpoint.trusted === true && checkpoint.checkpointType === 'canvas-graph';
  const children = [
    make('div', { className: 'studio-document-version-copy' }, [
      make('strong', { text: `Revision ${checkpoint.revision}` }),
      make('span', { text: String(checkpoint.reason || 'checkpoint').replaceAll('-', ' ') }),
      make('small', { text: `${formatTime(checkpoint.createdAt || checkpoint.createdAtMs)} · ${checkpoint.trusted ? 'trusted' : 'local'}${checkpoint.checkpointType === 'canvas-graph' ? ' · Canvas graph' : ''}` })
    ])
  ];
  if (trustedCanvas) {
    children.push(make('button', {
      type: 'button',
      text: 'Recover',
      dataset: { journalAction: 'trusted-restore', checkpointId: checkpoint.checkpointId, graphId: checkpoint.graphId }
    }));
  } else if (checkpoint.checkpointType !== 'canvas-graph') {
    children.push(make('button', { type: 'button', text: 'Recover', dataset: { journalAction: 'restore', checkpointId: checkpoint.checkpointId } }));
  } else {
    children.push(make('span', { className: 'studio-document-version-state', text: 'Local Canvas' }));
  }
  return make('article', { className: 'studio-document-version' }, children);
}

function transactionRow(transaction) {
  return make('article', { className: 'studio-document-version studio-journal-transaction' }, [
    make('div', { className: 'studio-document-version-copy' }, [
      make('strong', { text: String(transaction.intent || 'system').replaceAll('.', ' › ') }),
      make('span', { text: transaction.summary || transaction.metadata?.channel || 'Journal transaction' }),
      make('small', { text: `${formatTime(transaction.createdAtClient)} · revision ${transaction.acceptedHeadRevision ?? (transaction.expectedHeadRevision + 1)} · ${transaction.durabilityState || 'saved-locally'}` })
    ])
  ]);
}

async function refreshStatus() {
  const journal = api();
  statusCache = journal?.getAuthorityStatus ? await journal.getAuthorityStatus() : await journal?.getStatus();
  return statusCache;
}

async function ensureCanvasSession() {
  let session = window.EvaraCanvasSandbox?.getSession?.();
  if (session?.snapshot?.().ready) return session;
  if (!window.EvaraCanvasSandbox?.open) throw new Error('Graph Canvas is unavailable.');
  await window.EvaraCanvasSandbox.open();
  session = window.EvaraCanvasSandbox.getSession?.();
  if (!session?.snapshot?.().ready) throw new Error('Graph Canvas did not initialize.');
  return session;
}

async function renderPanel(force = false) {
  const mount = workspace();
  const existing = mount?.querySelector('[data-journal-panel]');
  document.querySelector('.studio-document-history-button')?.classList.toggle('is-active', panelOpen);
  if (!panelOpen || !mount) {
    existing?.remove();
    return;
  }
  if (existing && !force) return;
  existing?.remove();
  const status = await refreshStatus();
  if (!status || !panelOpen || !workspace()) return;
  const { session, checkpoints, transactions, serverAdapters } = status;
  const pending = status.pendingTransactions || transactions.filter((record) => !['server-confirmed', 'rejected'].includes(record.durabilityState));
  const compatibilityCheckpoints = checkpoints.filter((checkpoint) => checkpoint.checkpointType !== 'canvas-graph');
  const canvasCheckpoints = checkpoints.filter((checkpoint) => checkpoint.checkpointType === 'canvas-graph');
  const trustedCheckpoints = canvasCheckpoints.filter((checkpoint) => checkpoint.trusted === true);
  const adapterReady = serverAdapters.includes('trusted-studio-journal') && Boolean(trusted());
  const panel = make('aside', { className: 'studio-sheet studio-document-panel', dataset: { journalPanel: 'true' } });
  panel.append(
    make('div', { className: 'studio-sheet-header' }, [
      make('div', {}, [make('h2', { text: 'Draft Journal' }), make('p', { text: 'Local write-ahead recovery, trusted synchronization, checkpoints, and immutable releases.' })]),
      make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { journalAction: 'close' }, attrs: { 'aria-label': 'Close draft journal' } })
    ]),
    make('section', { className: 'studio-document-summary' }, [
      make('div', {}, [make('span', { text: 'Pending' }), make('strong', { text: pending.length })]),
      make('div', {}, [make('span', { text: 'Durability' }), make('strong', { text: String(session.durabilityState || 'saved-locally').replaceAll('-', ' ') })]),
      make('div', {}, [make('span', { text: 'Trusted server' }), make('strong', { text: adapterReady ? 'Connected' : 'Unavailable' })])
    ]),
    make('div', { className: 'studio-document-report' }, [
      make('p', {
        className: adapterReady && !pending.length ? 'is-success' : adapterReady ? 'is-warning' : 'is-error',
        text: !adapterReady
          ? 'Publishing requires the trusted server journal and release service.'
          : pending.length
            ? `${pending.length} unsynchronized transaction${pending.length === 1 ? '' : 's'} must be confirmed or recovered before release.`
            : trustedCheckpoints.length
              ? 'Canvas history is server confirmed and a trusted recovery checkpoint is available.'
              : 'Canvas history is server confirmed. Create a trusted checkpoint before release.'
      })
    ]),
    make('div', { className: 'studio-document-actions' }, [
      make('button', { type: 'button', text: 'Sync now', disabled: !adapterReady, dataset: { journalAction: 'sync' } }),
      make('button', { type: 'button', text: 'Trusted checkpoint', disabled: !adapterReady || Boolean(pending.length), dataset: { journalAction: 'trusted-checkpoint' } }),
      make('button', { type: 'button', text: 'Compatibility checkpoint', dataset: { journalAction: 'checkpoint' } }),
      make('button', { type: 'button', text: 'Refresh', dataset: { journalAction: 'refresh' } })
    ]),
    make('h3', { className: 'studio-journal-heading', text: 'Trusted Canvas recovery' }),
    make('div', { className: 'studio-document-version-list' }, trustedCheckpoints.length
      ? trustedCheckpoints.slice(0, 8).map(checkpointRow)
      : [make('div', { className: 'studio-empty-state', text: 'No trusted Canvas checkpoint yet.' })]),
    make('h3', { className: 'studio-journal-heading', text: 'Local compatibility recovery' }),
    make('div', { className: 'studio-document-version-list' }, compatibilityCheckpoints.length
      ? compatibilityCheckpoints.map(checkpointRow)
      : [make('div', { className: 'studio-empty-state', text: 'No compatibility checkpoints yet.' })]),
    make('h3', { className: 'studio-journal-heading', text: 'Recent transactions' }),
    make('div', { className: 'studio-document-version-list studio-journal-transaction-list' }, transactions.length
      ? transactions.slice(0, 30).map(transactionRow)
      : [make('div', { className: 'studio-empty-state', text: 'No journal transactions yet.' })])
  );
  workspace().append(panel);
}

function statusText(state) {
  if (state === 'syncing') return 'Syncing…';
  if (state === 'offline') return 'Saved offline';
  if (state === 'server-confirmed') return 'Server confirmed';
  if (state === 'conflict') return 'Conflict';
  if (state === 'read-only') return 'Read only';
  if (state === 'recovery-required') return 'Recovery needed';
  if (state === 'release-blocked') return 'Publish blocked';
  if (state === 'recovered') return 'Recovered';
  return 'Saved locally';
}

function openJournalPanel() {
  panelOpen = false;
  closeCompetingPanels();
  panelOpen = true;
  return renderPanel(true);
}

async function prepareTrustedRelease() {
  const adapter = trusted();
  if (!adapter?.release) {
    await openJournalPanel();
    throw new Error('Publishing requires the trusted server journal and release service.');
  }
  const session = await ensureCanvasSession();
  const snapshot = session.snapshot();
  if (snapshot.integrityState !== 'verified') {
    await openJournalPanel();
    throw new Error('Canvas integrity must be verified before preparing a release.');
  }
  if (document.body.dataset.canvasWriterState && document.body.dataset.canvasWriterState !== 'writer') {
    throw new Error('Only the active Canvas writer tab can prepare a release.');
  }
  const graph = session.getGraph();
  const pendingBefore = await api().listPendingOperationTransactions(graph.graphId);
  if (pendingBefore.some((record) => ['conflict', 'recovery-required'].includes(record.durabilityState))) {
    await openJournalPanel();
    throw new Error('Resolve Canvas conflicts or recovery-required transactions before release.');
  }
  await adapter.syncGraph(graph.graphId);
  const pending = await api().listPendingOperationTransactions(graph.graphId);
  if (pending.length) {
    await openJournalPanel();
    throw new Error(`${pending.length} unsynchronized Canvas transaction${pending.length === 1 ? '' : 's'} block publication.`);
  }
  if (!window.confirm(`Prepare immutable release for Canvas revision ${graph.revision}? This creates a trusted checkpoint and cannot rewrite published history.`)) {
    return null;
  }
  return adapter.release(graph);
}

function blockPrototypePublish(event) {
  const button = event.target.closest('[data-action="publish"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (publishing) return;
  publishing = true;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  prepareTrustedRelease()
    .then((result) => {
      if (!result) return;
      const releaseId = result.release?.releaseId || 'prepared release';
      toast(`Immutable release ${releaseId} prepared and server confirmed.`);
      renderPanel(true);
    })
    .catch((error) => {
      toast(error?.message || 'Trusted release preparation failed.', 'error');
      openJournalPanel();
    })
    .finally(() => {
      publishing = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    });
}

async function recoverTrusted(checkpointId, graphId) {
  const adapter = trusted();
  if (!adapter?.restore) throw new Error('Trusted recovery service is unavailable.');
  const pending = await api().listPendingOperationTransactions(graphId);
  if (pending.length) {
    const approved = window.confirm(`Trusted recovery will reject ${pending.length} unsynchronized local transaction${pending.length === 1 ? '' : 's'} while preserving them in history. Continue?`);
    if (!approved) return null;
    return adapter.rejectPendingAndRecover({ graphId, checkpointId });
  }
  if (!window.confirm('Recover this trusted Canvas checkpoint and reload the Graph Canvas?')) return null;
  return adapter.restore({ graphId, checkpointId });
}

function enhance() {
  if (!document.querySelector('[data-visual-studio]')) return;
  injectControls();
  if (panelOpen && !workspace()?.querySelector('[data-journal-panel]')) renderPanel(true);
}

function scheduleEnhance() {
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = requestAnimationFrame(enhance);
}

function bindEvents() {
  document.addEventListener('click', blockPrototypePublish, true);
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-sheet], [data-layout-tool="layers"], [data-auto-layout-tool]') && panelOpen) {
      panelOpen = false;
      renderPanel(true);
    }
    const action = event.target.closest('[data-journal-action]');
    if (!action) return;
    event.preventDefault();
    const type = action.dataset.journalAction;
    try {
      if (type === 'toggle') {
        const nextOpen = !panelOpen;
        if (nextOpen) await openJournalPanel();
        else { panelOpen = false; await renderPanel(true); }
      } else if (type === 'close') {
        panelOpen = false;
        await renderPanel(true);
      } else if (type === 'checkpoint') {
        await api()?.createCheckpoint('manual-checkpoint');
        await renderPanel(true);
        toast('Local compatibility checkpoint created.');
      } else if (type === 'trusted-checkpoint') {
        const session = await ensureCanvasSession();
        const checkpoint = await trusted()?.checkpoint(session.getGraph(), 'manual-trusted-checkpoint');
        if (checkpoint) toast(`Trusted checkpoint ${checkpoint.checkpointId} created.`);
        await renderPanel(true);
      } else if (type === 'sync') {
        await trusted()?.sync();
        await renderPanel(true);
        toast('Trusted synchronization completed.');
      } else if (type === 'refresh') {
        await renderPanel(true);
      } else if (type === 'trusted-restore') {
        const result = await recoverTrusted(action.dataset.checkpointId, action.dataset.graphId);
        if (result) location.reload();
      } else if (type === 'restore') {
        const checkpointId = action.dataset.checkpointId;
        if (!checkpointId || !window.confirm('Recover this local compatibility checkpoint? The current compatibility projection will be journaled first.')) return;
        const result = await api()?.restoreCheckpoint(checkpointId);
        if (result?.restored) location.reload();
        else toast(result?.reason || 'Checkpoint could not be recovered.', 'error');
      }
    } catch (error) {
      toast(error?.message || 'Journal action failed.', 'error');
    }
  });

  window.addEventListener('evara:studio-journal-status', (event) => {
    const status = document.querySelector('[data-journal-status]');
    if (status) {
      status.textContent = statusText(event.detail?.state);
      status.dataset.state = event.detail?.state || 'saved-locally';
      status.title = `Revision ${event.detail?.revision || event.detail?.acceptedHeadRevision || 0} · ${event.detail?.reason || 'journal'}`;
    }
    if (event.detail?.state === 'recovery-required') toast(event.detail?.error || 'Studio journal recovery is required.', 'error');
    if (panelOpen) renderPanel(true);
  });

  window.addEventListener('evara:trusted-studio-journal', (event) => {
    const status = document.querySelector('[data-journal-status]');
    if (status) {
      status.textContent = statusText(event.detail?.state);
      status.dataset.state = event.detail?.state || 'saved-locally';
      status.title = event.detail?.reason || 'trusted-journal';
    }
    if (panelOpen) renderPanel(true);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      const nextOpen = !panelOpen;
      if (nextOpen) openJournalPanel();
      else { panelOpen = false; renderPanel(true); }
    }
  });
}

function boot() {
  const root = document.querySelector('#appRoot');
  if (!root) return;
  bindEvents();
  new MutationObserver(scheduleEnhance).observe(root, { childList: true, subtree: true });
  scheduleEnhance();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
