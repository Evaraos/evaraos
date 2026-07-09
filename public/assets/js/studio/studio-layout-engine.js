const GRID_KEY = 'evaraos-studio-layout-grid-v1';
const ALLOWED_SPANS = [3, 4, 6, 8, 12];

let layersOpen = false;
let dragNodeId = null;
let dragTargetId = null;
let resizeSession = null;
let enhancementFrame = 0;
let savedTimer = 0;

const root = () => document.querySelector('#appRoot');
const canvas = () => document.querySelector('[data-canvas-dropzone]');
const workspace = () => document.querySelector('.studio-workspace');
const selectedNode = () => document.querySelector('.studio-node.is-selected');
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  if (options.title) node.title = options.title;
  if (options.draggable !== undefined) node.draggable = options.draggable;
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function setSaveStatus(label = 'Saved') {
  const status = document.querySelector('[data-layout-save-status]');
  if (!status) return;
  status.textContent = label;
  status.dataset.state = label === 'Saved' ? 'saved' : 'saving';
  clearTimeout(savedTimer);
  if (label !== 'Saved') savedTimer = setTimeout(() => setSaveStatus('Saved'), 500);
}

function gridEnabled() {
  return localStorage.getItem(GRID_KEY) !== 'false';
}

function applyGridPreference() {
  canvas()?.classList.toggle('is-layout-grid', gridEnabled());
  document.querySelector('[data-layout-action="grid"]')?.classList.toggle('is-active', gridEnabled());
}

function toggleGrid() {
  localStorage.setItem(GRID_KEY, String(!gridEnabled()));
  applyGridPreference();
}

function nodeLabel(node) {
  const heading = node.querySelector('h1, h2, h3, strong, [data-field="title"], [data-field="label"]');
  const text = heading?.textContent?.trim();
  return text ? text.slice(0, 42) : (node.dataset.nodeType || 'Component').replaceAll('-', ' ');
}

function visualNodes() {
  return [...document.querySelectorAll('.studio-node[data-node-id]')];
}

function visualNodeIds() {
  return visualNodes().map((node) => node.dataset.nodeId).filter(Boolean);
}

function selectById(nodeId) {
  const target = document.querySelector(`.studio-node[data-node-id="${CSS.escape(nodeId)}"]`);
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function moveNode(nodeId, targetId) {
  if (!nodeId || !targetId || nodeId === targetId) return;
  const ids = visualNodeIds();
  const from = ids.indexOf(nodeId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;

  setSaveStatus('Saving...');
  selectById(nodeId);
  await nextFrame();

  const direction = to < from ? 'up' : 'down';
  const steps = Math.abs(to - from);
  for (let index = 0; index < steps; index += 1) {
    const control = document.querySelector(`[data-context-action="${direction}"]`);
    if (!control) break;
    control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await nextFrame();
  }

  setSaveStatus('Saved');
}

function nearestSpan(value) {
  return ALLOWED_SPANS.reduce((best, span) => Math.abs(span - value) < Math.abs(best - value) ? span : best, ALLOWED_SPANS[0]);
}

async function commitSpan(nodeId, span) {
  const target = document.querySelector(`.studio-node[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!target) return;

  setSaveStatus('Saving...');
  if (!target.classList.contains('is-selected')) {
    selectById(nodeId);
    await nextFrame();
  }

  const styleButton = document.querySelector('[data-sheet="style"]');
  const wasOpen = styleButton?.classList.contains('is-active');
  if (!wasOpen) {
    styleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await nextFrame();
  }

  const widthControl = document.querySelector('[data-style-field="span"]');
  if (widthControl) {
    widthControl.value = String(span);
    widthControl.dispatchEvent(new Event('change', { bubbles: true }));
    await nextFrame();
  }

  if (!wasOpen) {
    document.querySelector('[data-sheet="style"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await nextFrame();
  }
  setSaveStatus('Saved');
}

function beginResize(event) {
  const handle = event.target.closest('[data-layout-resize]');
  if (!handle || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const node = handle.closest('.studio-node[data-node-id]');
  const stage = node?.closest('.studio-stage');
  if (!node || !stage || stage.dataset.device === 'mobile') return;

  resizeSession = {
    pointerId: event.pointerId,
    nodeId: node.dataset.nodeId,
    startX: event.clientX,
    startSpan: Number(node.dataset.span || 4),
    nextSpan: Number(node.dataset.span || 4),
    stageWidth: Math.max(320, stage.getBoundingClientRect().width)
  };
  handle.setPointerCapture?.(event.pointerId);
  node.classList.add('is-layout-resizing');
  document.body.classList.add('studio-layout-resizing');
}

function resizeMove(event) {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) return;
  event.preventDefault();
  const columnWidth = resizeSession.stageWidth / 12;
  const delta = Math.round((event.clientX - resizeSession.startX) / columnWidth);
  resizeSession.nextSpan = nearestSpan(resizeSession.startSpan + delta);
  const node = document.querySelector(`.studio-node[data-node-id="${CSS.escape(resizeSession.nodeId)}"]`);
  if (!node) return;
  node.dataset.span = String(resizeSession.nextSpan);
  node.querySelector('[data-layout-size-label]')?.replaceChildren(document.createTextNode(`${resizeSession.nextSpan}/12`));
}

async function endResize(event) {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) return;
  event.preventDefault();
  const session = resizeSession;
  resizeSession = null;
  document.body.classList.remove('studio-layout-resizing');
  document.querySelector(`.studio-node[data-node-id="${CSS.escape(session.nodeId)}"]`)?.classList.remove('is-layout-resizing');
  if (session.nextSpan !== session.startSpan) await commitSpan(session.nodeId, session.nextSpan);
}

function enhanceNodes() {
  visualNodes().forEach((node) => {
    node.draggable = !node.classList.contains('is-layout-resizing');
    node.dataset.layoutReady = 'true';
  });

  const node = selectedNode();
  if (!node || node.querySelector('[data-layout-resize]')) return;
  const handle = make('button', {
    className: 'studio-layout-resize-handle',
    type: 'button',
    title: 'Drag to resize and snap to the layout grid',
    dataset: { layoutResize: 'true' },
    attrs: { 'aria-label': 'Resize component' }
  }, [make('span', { text: `${node.dataset.span || 4}/12`, dataset: { layoutSizeLabel: 'true' } })]);
  node.append(handle);
}

function injectToolbarTools() {
  const dock = document.querySelector('.studio-dock');
  if (dock && !dock.querySelector('[data-layout-tool="layers"]')) {
    dock.append(make('button', {
      className: `studio-dock-button${layersOpen ? ' is-active' : ''}`,
      type: 'button',
      title: 'Layers',
      dataset: { layoutTool: 'layers' },
      attrs: { 'aria-label': 'Open layers' }
    }, [make('span', { text: 'L' }), make('small', { text: 'Layers' })]));
  }

  const actions = document.querySelector('.studio-top-actions');
  if (actions && !actions.querySelector('[data-layout-action="grid"]')) {
    const grid = make('button', {
      className: 'studio-icon-button studio-layout-grid-button',
      type: 'button',
      title: 'Toggle snap grid',
      text: 'G',
      dataset: { layoutAction: 'grid' },
      attrs: { 'aria-label': 'Toggle snap grid' }
    });
    const status = make('span', {
      className: 'studio-layout-save-status',
      text: 'Saved',
      dataset: { layoutSaveStatus: 'true', state: 'saved' },
      attrs: { role: 'status', 'aria-live': 'polite' }
    });
    actions.prepend(status, grid);
  }
}

function layerRow(node, index) {
  const row = make('button', {
    className: `studio-layout-layer${node.classList.contains('is-selected') ? ' is-selected' : ''}`,
    type: 'button',
    draggable: true,
    dataset: { layerNode: node.dataset.nodeId, layerIndex: index }
  });
  row.append(
    make('span', { className: 'studio-layout-layer-grip', text: '::', attrs: { 'aria-hidden': 'true' } }),
    make('span', { className: 'studio-layout-layer-type', text: (node.dataset.nodeType || 'component').slice(0, 1).toUpperCase() }),
    make('span', { className: 'studio-layout-layer-copy' }, [
      make('strong', { text: nodeLabel(node) }),
      make('small', { text: `${(node.dataset.nodeType || 'component').replaceAll('-', ' ')} · ${node.dataset.span || 4}/12` })
    ]),
    make('span', { className: 'studio-layout-layer-state', text: node.dataset.hiddenInPreview === 'true' ? 'Hidden' : 'Visible' })
  );
  return row;
}

function renderLayersPanel() {
  workspace()?.querySelector('[data-layout-sheet="layers"]')?.remove();
  document.querySelector('[data-layout-tool="layers"]')?.classList.toggle('is-active', layersOpen);
  if (!layersOpen || !workspace()) return;

  const sheet = make('aside', { className: 'studio-sheet studio-layout-sheet', dataset: { layoutSheet: 'layers' } });
  const header = make('div', { className: 'studio-sheet-header' }, [
    make('div', {}, [make('h2', { text: 'Layers' }), make('p', { text: 'Drag components to change their visual order.' })]),
    make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { layoutAction: 'close-layers' }, attrs: { 'aria-label': 'Close layers' } })
  ]);
  const list = make('div', { className: 'studio-layout-layer-list' });
  visualNodes().forEach((node, index) => list.append(layerRow(node, index)));
  if (!list.children.length) list.append(make('div', { className: 'studio-empty-state', text: 'Add a component to begin building layers.' }));
  sheet.append(header, list);
  workspace().append(sheet);
}

function enhance() {
  if (!document.querySelector('[data-visual-studio]')) return;
  injectToolbarTools();
  enhanceNodes();
  applyGridPreference();
  renderLayersPanel();
}

function scheduleEnhance() {
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = requestAnimationFrame(enhance);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const layers = event.target.closest('[data-layout-tool="layers"]');
    if (layers) {
      event.preventDefault();
      const activeNativeSheet = document.querySelector('.studio-dock-button.is-active[data-sheet]');
      activeNativeSheet?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      layersOpen = !layersOpen;
      renderLayersPanel();
      return;
    }

    const action = event.target.closest('[data-layout-action]');
    if (action?.dataset.layoutAction === 'grid') {
      event.preventDefault();
      toggleGrid();
      return;
    }
    if (action?.dataset.layoutAction === 'close-layers') {
      event.preventDefault();
      layersOpen = false;
      renderLayersPanel();
      return;
    }

    const layer = event.target.closest('[data-layer-node]');
    if (layer) {
      event.preventDefault();
      selectById(layer.dataset.layerNode);
    }
  });

  document.addEventListener('pointerdown', beginResize, true);
  document.addEventListener('pointermove', resizeMove, true);
  document.addEventListener('pointerup', endResize, true);
  document.addEventListener('pointercancel', endResize, true);

  document.addEventListener('dragstart', (event) => {
    const layer = event.target.closest('[data-layer-node]');
    const node = event.target.closest('.studio-node[data-node-id]');
    const sourceId = layer?.dataset.layerNode || node?.dataset.nodeId;
    if (!sourceId || event.target.closest('[contenteditable="true"], [data-layout-resize]')) return;
    dragNodeId = sourceId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/x-evara-studio-node', sourceId);
    document.body.classList.add('studio-layout-dragging');
  }, true);

  document.addEventListener('dragover', (event) => {
    const target = event.target.closest('[data-layer-node], .studio-node[data-node-id]');
    const targetId = target?.dataset.layerNode || target?.dataset.nodeId;
    if (!dragNodeId || !targetId || targetId === dragNodeId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragTargetId !== targetId) {
      document.querySelectorAll('.is-layout-drop-target').forEach((item) => item.classList.remove('is-layout-drop-target'));
      target.classList.add('is-layout-drop-target');
      dragTargetId = targetId;
    }
  });

  document.addEventListener('drop', async (event) => {
    const target = event.target.closest('[data-layer-node], .studio-node[data-node-id]');
    const targetId = target?.dataset.layerNode || target?.dataset.nodeId;
    if (!dragNodeId || !targetId) return;
    event.preventDefault();
    const source = dragNodeId;
    dragNodeId = null;
    dragTargetId = null;
    document.body.classList.remove('studio-layout-dragging');
    document.querySelectorAll('.is-layout-drop-target').forEach((item) => item.classList.remove('is-layout-drop-target'));
    await moveNode(source, targetId);
  });

  document.addEventListener('dragend', () => {
    dragNodeId = null;
    dragTargetId = null;
    document.body.classList.remove('studio-layout-dragging');
    document.querySelectorAll('.is-layout-drop-target').forEach((item) => item.classList.remove('is-layout-drop-target'));
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      layersOpen = !layersOpen;
      renderLayersPanel();
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'g' && !event.target.matches('input, textarea, select, [contenteditable="true"]')) {
      event.preventDefault();
      toggleGrid();
    }
  });
}

function boot() {
  const appRoot = root();
  if (!appRoot) return;
  bindEvents();
  new MutationObserver(scheduleEnhance).observe(appRoot, { childList: true, subtree: true });
  scheduleEnhance();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
