let panelOpen = false;
let enhancementFrame = 0;
let statusCache = null;

const api = () => window.EvaraStudioJournal;
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
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 2600);
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

function checkpointRow(checkpoint, { recoverable = true } = {}) {
  const children = [
    make('div', { className: 'studio-document-version-copy' }, [
      make('strong', { text: `Revision ${checkpoint.revision}` }),
      make('span', { text: String(checkpoint.reason || 'checkpoint').replaceAll('-', ' ') }),
      make('small', { text: `${formatTime(checkpoint.createdAt)} · ${checkpoint.trusted ? 'trusted' : 'local'}${checkpoint.checkpointType === 'canvas-graph' ? ' · Canvas graph' : ''}` })
    ])
  ];
  children.push(recoverable
    ? make('button', { type: 'button', text: 'Recover', dataset: { journalAction: 'restore', checkpointId: checkpoint.checkpointId } })
    : make('span', { className: 'studio-document-version-state', text: 'Canvas' }));
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
  statusCache = await api()?.getStatus();
  return statusCache;
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
  const compatibilityCheckpoints = checkpoints.filter((checkpoint) => checkpoint.checkpointType !== 'canvas-graph');
  const canvasCheckpoints = checkpoints.filter((checkpoint) => checkpoint.checkpointType === 'canvas-graph');
  const panel = make('aside', { className: 'studio-sheet studio-document-panel', dataset: { journalPanel: 'true' } });
  panel.append(
    make('div', { className: 'studio-sheet-header' }, [
      make('div', {}, [make('h2', { text: 'Draft Journal' }), make('p', { text: 'IndexedDB recovery journal for compatibility and Evara Graph Canvas drafts.' })]),
      make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { journalAction: 'close' }, attrs: { 'aria-label': 'Close draft journal' } })
    ]),
    make('section', { className: 'studio-document-summary' }, [
      make('div', {}, [make('span', { text: 'Compatibility revision' }), make('strong', { text: session.headRevision })]),
      make('div', {}, [make('span', { text: 'Durability' }), make('strong', { text: session.durabilityState.replaceAll('-', ' ') })]),
      make('div', {}, [make('span', { text: 'Server' }), make('strong', { text: serverAdapters.length ? 'Adapter ready' : 'Not connected' })])
    ]),
    make('div', { className: 'studio-document-report' }, [
      make('p', { className: serverAdapters.length ? 'is-warning' : 'is-error', text: serverAdapters.length
        ? 'A trusted server adapter is registered, but release publishing remains gated until server confirmation.'
        : 'Publishing is blocked until Backend connects the trusted journal and release service.' })
    ]),
    make('div', { className: 'studio-document-actions' }, [
      make('button', { type: 'button', text: 'Compatibility checkpoint', dataset: { journalAction: 'checkpoint' } }),
      make('button', { type: 'button', text: 'Refresh', dataset: { journalAction: 'refresh' } })
    ]),
    make('h3', { className: 'studio-journal-heading', text: 'Compatibility recovery' }),
    make('div', { className: 'studio-document-version-list' }, compatibilityCheckpoints.length
      ? compatibilityCheckpoints.map((checkpoint) => checkpointRow(checkpoint, { recoverable: true }))
      : [make('div', { className: 'studio-empty-state', text: 'No compatibility checkpoints yet.' })]),
    make('h3', { className: 'studio-journal-heading', text: 'Canvas graph checkpoints' }),
    make('div', { className: 'studio-document-version-list' }, canvasCheckpoints.length
      ? canvasCheckpoints.slice(0, 8).map((checkpoint) => checkpointRow(checkpoint, { recoverable: false }))
      : [make('div', { className: 'studio-empty-state', text: 'Open Graph Canvas and create a save point.' })]),
    make('h3', { className: 'studio-journal-heading', text: 'Recent transactions' }),
    make('div', { className: 'studio-document-version-list studio-journal-transaction-list' }, transactions.length
      ? transactions.slice(0, 24).map(transactionRow)
      : [make('div', { className: 'studio-empty-state', text: 'No journal transactions yet.' })])
  );
  workspace().append(panel);
}

function statusText(state) {
  if (state === 'syncing') return 'Journaling…';
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

function blockPrototypePublish(event) {
  if (!event.target.closest('[data-action="publish"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openJournalPanel();
  toast('Publishing requires the trusted server journal and release service.', 'error');
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
    } else if (type === 'refresh') {
      await renderPanel(true);
    } else if (type === 'restore') {
      const checkpointId = action.dataset.checkpointId;
      const checkpoint = statusCache?.checkpoints?.find((item) => item.checkpointId === checkpointId);
      if (checkpoint?.checkpointType === 'canvas-graph') {
        toast('Canvas graph checkpoints recover automatically when Graph Canvas opens.', 'error');
        return;
      }
      if (!checkpointId || !window.confirm('Recover this local Studio checkpoint? The current compatibility projection will be journaled first.')) return;
      const result = await api()?.restoreCheckpoint(checkpointId);
      if (result?.restored) location.reload();
      else toast(result?.reason || 'Checkpoint could not be recovered.', 'error');
    }
  });

  window.addEventListener('evara:studio-journal-status', (event) => {
    const status = document.querySelector('[data-journal-status]');
    if (status) {
      status.textContent = statusText(event.detail?.state);
      status.dataset.state = event.detail?.state || 'saved-locally';
      status.title = `Revision ${event.detail?.revision || 0} · ${event.detail?.reason || 'journal'}`;
    }
    if (event.detail?.state === 'recovery-required') toast(event.detail?.error || 'Studio journal recovery is required.', 'error');
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
