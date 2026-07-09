let panelOpen = false;
let enhancementFrame = 0;

const api = () => window.EvaraStudioDocument;
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
  return Number.isNaN(date.getTime()) ? 'Not saved' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function showToast(message, tone = 'info') {
  let toast = document.querySelector('[data-document-toast]');
  if (!toast) {
    toast = make('div', { className: 'studio-document-toast', dataset: { documentToast: 'true' }, attrs: { role: 'status' } });
    document.body.append(toast);
  }
  toast.textContent = String(message);
  toast.dataset.tone = tone;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function closeCompetingPanels() {
  document.querySelector('.studio-dock-button.is-active[data-sheet]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('[data-layout-tool="layers"].is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('[data-auto-layout-tool].is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function statusLabel(state) {
  if (state === 'saving') return 'Saving…';
  if (state === 'blocked') return 'Needs review';
  if (state === 'ready') return 'Document ready';
  return 'Saved';
}

function injectControls() {
  const actions = document.querySelector('.studio-top-actions');
  if (!actions || actions.querySelector('[data-document-status]')) return;
  const status = make('button', {
    className: 'studio-document-status',
    type: 'button',
    text: 'Document ready',
    title: 'Open document history and recovery',
    dataset: { documentStatus: 'true', documentAction: 'toggle' }
  });
  const versions = make('button', {
    className: 'studio-icon-button studio-document-history-button',
    type: 'button',
    text: 'V',
    title: 'Versions and recovery',
    dataset: { documentAction: 'toggle' },
    attrs: { 'aria-label': 'Open versions and recovery' }
  });
  actions.prepend(status, versions);
}

function versionRow(version) {
  return make('article', { className: 'studio-document-version' }, [
    make('div', { className: 'studio-document-version-copy' }, [
      make('strong', { text: `Revision ${version.revision}` }),
      make('span', { text: version.reason.replaceAll('-', ' ') }),
      make('small', { text: formatTime(version.createdAt) })
    ]),
    make('button', { type: 'button', text: 'Restore', dataset: { documentAction: 'restore', versionId: version.id } })
  ]);
}

function reportList(report) {
  if (report.valid && !report.warnings.length) return make('div', { className: 'studio-document-valid', text: 'Document validation passed.' });
  const list = make('div', { className: 'studio-document-report' });
  report.errors.forEach((message) => list.append(make('p', { className: 'is-error', text: message })));
  report.warnings.forEach((message) => list.append(make('p', { className: 'is-warning', text: message })));
  return list;
}

function renderPanel(force = false) {
  const mount = workspace();
  const existing = mount?.querySelector('[data-document-panel]');
  document.querySelector('[data-document-history-button]')?.classList.toggle('is-active', panelOpen);
  if (!panelOpen || !mount) {
    existing?.remove();
    return;
  }
  if (existing && !force) return;
  existing?.remove();
  const document = api()?.getDocument();
  const report = api()?.validate() || { valid: false, errors: ['Document model unavailable.'], warnings: [] };
  if (!document) return;

  const panel = make('aside', { className: 'studio-sheet studio-document-panel', dataset: { documentPanel: 'true' } });
  panel.append(
    make('div', { className: 'studio-sheet-header' }, [
      make('div', {}, [make('h2', { text: 'Document & Versions' }), make('p', { text: 'One validated source for content, layout, recovery, and publishing.' })]),
      make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { documentAction: 'close' }, attrs: { 'aria-label': 'Close document panel' } })
    ]),
    make('section', { className: 'studio-document-summary' }, [
      make('div', {}, [make('span', { text: 'Revision' }), make('strong', { text: document.revision })]),
      make('div', {}, [make('span', { text: 'Updated' }), make('strong', { text: formatTime(document.metadata.updatedAt) })]),
      make('div', {}, [make('span', { text: 'Published' }), make('strong', { text: document.publication.revision === null ? 'Not yet' : `Revision ${document.publication.revision}` })])
    ]),
    reportList(report),
    make('div', { className: 'studio-document-actions' }, [
      make('button', { type: 'button', text: 'Create checkpoint', dataset: { documentAction: 'checkpoint' } }),
      make('button', { type: 'button', text: 'Export document', dataset: { documentAction: 'export' } })
    ]),
    make('div', { className: 'studio-document-version-list' }, document.versions.length
      ? document.versions.map(versionRow)
      : [make('div', { className: 'studio-empty-state', text: 'Checkpoints and published versions will appear here.' })])
  );
  mount.append(panel);
}

function downloadDocument() {
  const payload = api()?.exportDocument();
  if (!payload) return;
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `evara-studio-document-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handlePublish(event) {
  const publish = event.target.closest('[data-action="publish"]');
  if (!publish) return;
  const report = api()?.validate();
  if (report?.valid) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  panelOpen = true;
  closeCompetingPanels();
  renderPanel(true);
  showToast(report?.errors?.[0] || 'Publishing is blocked until the document is valid.', 'error');
}

function enhance() {
  if (!document.querySelector('[data-visual-studio]')) return;
  injectControls();
  if (panelOpen && !workspace()?.querySelector('[data-document-panel]')) renderPanel(true);
}

function scheduleEnhance() {
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = requestAnimationFrame(enhance);
}

function bindEvents() {
  document.addEventListener('click', handlePublish, true);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet], [data-layout-tool="layers"], [data-auto-layout-tool]') && panelOpen) {
      panelOpen = false;
      renderPanel(true);
    }
    const action = event.target.closest('[data-document-action]');
    if (!action) return;
    event.preventDefault();
    const type = action.dataset.documentAction;
    if (type === 'toggle') {
      panelOpen = !panelOpen;
      if (panelOpen) closeCompetingPanels();
      renderPanel(true);
    } else if (type === 'close') {
      panelOpen = false;
      renderPanel(true);
    } else if (type === 'checkpoint') {
      api()?.createCheckpoint('manual-checkpoint');
      renderPanel(true);
      showToast('Checkpoint created.');
    } else if (type === 'export') {
      downloadDocument();
      showToast('Studio document exported.');
    } else if (type === 'restore') {
      const versionId = action.dataset.versionId;
      if (!versionId || !window.confirm('Restore this Studio version? Your current state will be saved as a recovery checkpoint.')) return;
      const result = api()?.restoreVersion(versionId);
      if (result?.restored) location.reload();
      else showToast(result?.reason || 'Version could not be restored.', 'error');
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="save"]')) {
      setTimeout(() => {
        api()?.flush('manual-save');
        showToast('Unified Studio document saved.');
      }, 0);
    }
  }, true);

  window.addEventListener('evara:studio-document-status', (event) => {
    const status = document.querySelector('[data-document-status]');
    if (!status) return;
    status.textContent = statusLabel(event.detail?.state);
    status.dataset.state = event.detail?.state || 'saved';
    status.title = event.detail?.updatedAt ? `Last saved ${formatTime(event.detail.updatedAt)}` : 'Open document history and recovery';
    if (event.detail?.state === 'blocked') {
      panelOpen = true;
      renderPanel(true);
    }
  });

  window.addEventListener('evara:studio-published', () => {
    showToast('Validated Studio revision published.');
    renderPanel(true);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      panelOpen = !panelOpen;
      if (panelOpen) closeCompetingPanels();
      renderPanel(true);
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
