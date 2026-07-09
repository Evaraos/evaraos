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
const isPinnedNode = (node) => node?.dataset.nodeType === 'hero-block';
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  if (options.title) node.title = options.title;
  if (options.draggable !== undefined) node.draggable = options.draggable;
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
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
  const value = heading?.textContent?.trim();
  return value ? value.slice(0, 42) : (node.dataset.nodeType || 'Component').replaceAll('-', ' ');
}

function visualNodes() {
  return [...document.querySelectorAll('.studio-node[data-node-id]')];
}

function visualNodeIds() {
  return visualNodes().map((node) => node.dataset.nodeId).filter(Boolean);
}

function findNode(nodeId) {
  if (!nodeId) return null;
  return document.querySelector(`.studio-node[data-node-id="${CSS.escape(nodeId)}"]`);
}

function selectById(nodeId) {
  findNode(nodeId)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function moveNode(nodeId, targetId) {
  if (!nodeId || !targetId || nodeId === targetId) return;
  const sourceNode = findNode(nodeId);
  const targetNode = findNode(targetId);
  if (!sourceNode || !targetNode || isPinnedNode(sourceNode) || isPinnedNode(targetNode)) return;

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
    if (!control || control.disabled) break;
    control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await nextFrame();
  }

  setSaveStatus('Saved');
}

function nearestSpan(value) {
  return ALLOWED_SPANS.reduce((best, span) => Math.abs(span - value) < Math.abs(best - value) ? span : best, ALLOWED_SPANS[0]);
}

async function commitSpan(nodeId, span) {
  const target = findNode(nodeId);
  if (!target || isPinnedNode(target)) return;

  if (layersOpen) {
    layersOpen = false;
    renderLayersPanel(true);
  }

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
  if (!node || !stage || isPinnedNode(node) || stage.dataset.device === 'mobile') return;

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
  const node = findNode(resizeSession.nodeId);
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
  findNode(session.nodeId)?.classList.remove('is-layout-resizing');
  if (session.nextSpan !== session.startSpan) await commitSpan(session.nodeId, session.nextSpan);
}

function updateContextBoundaries(node) {
  const ids = visualNodeIds();
  const index = node ? ids.indexOf(node.dataset.nodeId) : -1;
  const pinned = isPinnedNode(node);
  const up = document.querySelector('[data-context-action="up"]');
  const down = document.querySelector('[data-context-action="down"]');
  if (up) up.disabled = pinned || index <= 1;
  if (down) down.disabled = pinned || index < 0 || index >= ids.length - 1;
}

function enhanceNodes() {
  visualNodes().forEach((node) => {
    const pinned = isPinnedNode(node);
    node.draggable = !pinned && !node.classList.contains('is-layout-resizing');
    node.dataset.layoutReady = 'true';
    node.dataset.layoutPinned = String(pinned);
  });

  const node = selectedNode();
  updateContextBoundaries(node);
  if (!node || isPinnedNode(node) || node.querySelector('[data-layout-resize]')) return;
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
  const pinned = isPinnedNode(node);
  const row = make('button', {
    className: `studio-layout-layer${node.classList.contains('is-selected') ? ' is-selected' : ''}${pinned ? ' is-pinned' : ''}`,
    type: 'button',
    draggable: !pinned,
    dataset: { layerNode: node.dataset.nodeId, layerIndex: index, layerPinned: String(pinned) }
  });
  row.append(
    make('span', { className: 'studio-layout-layer-grip', text: pinned ? '--' : '::', attrs: { 'aria-hidden': 'true' } }),
    make('span', { className: 'studio-layout-layer-type', text: (node.dataset.nodeType || 'component').slice(0, 1).toUpperCase() }),
    make('span', { className: 'studio-layout-layer-copy' }, [
      make('strong', { text: nodeLabel(node) }),
      make('small', { text: `${(node.dataset.nodeType || 'component').replaceAll('-', ' ')} · ${node.dataset.span || 4}/12` })
    ]),
    make('span', { className: 'studio-layout-layer-state', text: pinned ? 'Pinned' : node.dataset.hiddenInPreview === 'true' ? 'Hidden' : 'Visible' })
  );
  return row;
}

function renderLayersPanel(force = false) {
  const mount = workspace();
  const existing = mount?.querySelector('[data-layout-sheet="layers"]');
  document.querySelector('[data-layout-tool="layers"]')?.classList.toggle('is-active', layersOpen);

  if (!layersOpen || !mount) {
    existing?.remove();
    return;
  }
  if (existing && !force) return;
  existing?.remove();

  const sheet = make('aside', { className: 'studio-sheet studio-layout-sheet', dataset: { layoutSheet: 'layers' } });
  const header = make('div', { className: 'studio-sheet-header' }, [
    make('div', {}, [make('h2', { text: 'Layers' }), make('p', { text: 'Drag components to change their visual order.' })]),
    make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { layoutAction: 'close-layers' }, attrs: { 'aria-label': 'Close layers' } })
  ]);
  const list = make('div', { className: 'studio-layout-layer-list' });
  visualNodes().forEach((node, index) => list.append(layerRow(node, index)));
  if (!list.children.length) list.append(make('div', { className: 'studio-empty-state', text: 'Add a component to begin building layers.' }));
  sheet.append(header, list);
  mount.append(sheet);
}

function enhance() {
  if (!document.querySelector('[data-visual-studio]')) return;
  injectToolbarTools();
  enhanceNodes();
  applyGridPreference();
  if (layersOpen && !workspace()?.querySelector('[data-layout-sheet="layers"]')) renderLayersPanel(true);
}

function scheduleEnhance() {
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = requestAnimationFrame(enhance);
}

function clearDragState() {
  dragNodeId = null;
  dragTargetId = null;
  document.body.classList.remove('studio-layout-dragging');
  document.querySelectorAll('.is-layout-drop-target').forEach((item) => item.classList.remove('is-layout-drop-target'));
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const nativeSheet = event.target.closest('[data-sheet]');
    if (nativeSheet && layersOpen) {
      layersOpen = false;
      renderLayersPanel(true);
    }

    const layers = event.target.closest('[data-layout-tool="layers"]');
    if (layers) {
      event.preventDefault();
      const nextOpen = !layersOpen;
      layersOpen = false;
      const activeNativeSheet = document.querySelector('.studio-dock-button.is-active[data-sheet]');
      activeNativeSheet?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      layersOpen = nextOpen;
      renderLayersPanel(true);
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
      renderLayersPanel(true);
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
    const sourceNode = findNode(sourceId);
    if (!sourceId || !sourceNode || isPinnedNode(sourceNode) || event.target.closest('[contenteditable="true"], [data-layout-resize]')) return;
    dragNodeId = sourceId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/x-evara-studio-node', sourceId);
    document.body.classList.add('studio-layout-dragging');
  }, true);

  document.addEventListener('dragover', (event) => {
    const target = event.target.closest('[data-layer-node], .studio-node[data-node-id]');
    const targetId = target?.dataset.layerNode || target?.dataset.nodeId;
    const targetNode = findNode(targetId);
    if (!dragNodeId || !targetId || targetId === dragNodeId || !targetNode || isPinnedNode(targetNode)) return;
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
    const source = dragNodeId;
    const targetNode = findNode(targetId);
    if (!source || !targetId || !targetNode || isPinnedNode(targetNode)) {
      clearDragState();
      return;
    }
    event.preventDefault();
    clearDragState();
    await moveNode(source, targetId);
  });

  document.addEventListener('dragend', clearDragState);

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      layersOpen = !layersOpen;
      renderLayersPanel(true);
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
