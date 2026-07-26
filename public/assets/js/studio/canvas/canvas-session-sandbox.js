import { createCanvasSession } from './canvas-session.js?v=2';
import { findProjectedNode, flattenGraphProjection } from './graph-projection.js';
import { CANVAS_SEMANTIC_COMMANDS } from './mock-operation-dispatcher.js';

const DEVICE_LABELS = Object.freeze({ desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' });
const ALLOWED_SPANS = Object.freeze([3, 4, 6, 8, 12]);
const MAX_LOG_ITEMS = 18;

let session = null;
let snapshot = null;
let overlay = null;
let open = false;
let tool = 'select';
let observer = null;
let busy = false;
let dragState = null;
let resizeState = null;
let panState = null;
let marqueeState = null;

function text(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 2400);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.checked !== undefined) node.checked = Boolean(options.checked);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.draggable !== undefined) node.draggable = Boolean(options.draggable);
  if (options.title) node.title = text(options.title, 300);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function showMessage(message, tone = 'info') {
  let toast = document.querySelector('[data-canvas-sandbox-toast]');
  if (!toast) {
    toast = el('div', {
      className: 'studio-canvas-sandbox-toast',
      dataset: { canvasSandboxToast: 'true' },
      attrs: { role: 'status' }
    });
    document.body.append(toast);
  }
  toast.textContent = text(message, 500);
  toast.dataset.tone = tone;
  toast.classList.add('is-visible');
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function projection() {
  return snapshot?.projection || null;
}

function selection() {
  return snapshot?.selection || { selectedIds: [], hoveredId: null };
}

function selectedIds() {
  return new Set(selection().selectedIds || []);
}

function frameProjection() {
  return projection()?.page?.children?.find((node) => ['frame', 'container', 'panel'].includes(node.kind)) || projection()?.page || null;
}

function componentProjections() {
  return (frameProjection()?.children || []).filter((node) => node.kind === 'component-instance');
}

function selectedNode() {
  const id = selection().selectedIds?.[0];
  return id ? findProjectedNode(projection(), id) : null;
}

async function ensureSession() {
  if (session) return session;
  session = await createCanvasSession({
    requireAuthoredGraph: true,
    actor: { id: 'canvas-session-local', type: 'user', role: 'owner' }
  });
  snapshot = session.snapshot();
  session.subscribe((next, event) => {
    snapshot = next;
    if (open && !['selection-change', 'viewport-change'].includes(event.reason)) renderOverlay();
    else if (open) refreshEphemeralUI();
  });
  return session;
}

async function command(type, payload, options = {}) {
  if (busy) {
    if (options.throwOnError) throw new Error('Graph Canvas is already processing another semantic command.');
    return null;
  }
  busy = true;
  refreshBusyState();
  try {
    const active = await ensureSession();
    const result = await active.dispatch({ type, payload, summary: options.summary });
    snapshot = active.snapshot();
    return result;
  } catch (error) {
    showMessage(error?.message || 'Canvas command failed.', 'error');
    if (options.throwOnError) throw error;
    return null;
  } finally {
    busy = false;
    refreshBusyState();
  }
}

function iconButton(label, action, title, disabled = false) {
  return el('button', {
    className: 'studio-canvas-sandbox-icon-button',
    type: 'button',
    text: label,
    title,
    disabled: disabled || busy,
    dataset: { sandboxAction: action }
  });
}

function renderHeader() {
  const selected = selectedNode()?.kind === 'component-instance' ? selectedNode() : null;
  const viewport = snapshot.viewport;
  const header = el('header', { className: 'studio-canvas-sandbox-header' });
  header.append(
    el('div', { className: 'studio-canvas-sandbox-title' }, [
      el('span', { className: 'studio-canvas-sandbox-mark', text: 'G' }),
      el('div', {}, [
        el('strong', { text: 'Canvas GraphProjection' }),
        el('small', { text: `${snapshot.source === 'authored-blueprint-graph' ? 'Authored Blueprint graph' : 'Recovery fixture'} • ${snapshot.durabilityState} • semantic journal` })
      ])
    ]),
    el('div', { className: 'studio-canvas-sandbox-tools' }, [
      el('div', { className: 'studio-canvas-sandbox-segment' }, ['select', 'pan'].map((value) => el('button', {
        className: tool === value ? 'is-active' : '',
        type: 'button',
        text: value === 'select' ? 'Select' : 'Pan',
        dataset: { sandboxTool: value }
      }))),
      el('div', { className: 'studio-canvas-sandbox-segment' }, Object.keys(DEVICE_LABELS).map((value) => el('button', {
        className: viewport.device === value ? 'is-active' : '',
        type: 'button',
        text: DEVICE_LABELS[value],
        dataset: { sandboxDevice: value }
      }))),
      iconButton('↶', 'undo', 'Undo durable semantic transaction', !snapshot.canUndo),
      iconButton('↷', 'redo', 'Redo durable semantic transaction', !snapshot.canRedo),
      iconButton('−', 'zoom-out', 'Zoom out'),
      el('span', { className: 'studio-canvas-sandbox-zoom', text: `${Math.round(viewport.zoom * 100)}%` }),
      iconButton('+', 'zoom-in', 'Zoom in'),
      iconButton('Reset', 'reset-view', 'Reset viewport'),
      iconButton('Add', 'insert', 'Insert a component'),
      iconButton('Duplicate', 'duplicate', 'Duplicate selected component', !selected),
      iconButton('Delete', 'delete', 'Delete selected component', !selected),
      iconButton('Save point', 'checkpoint', 'Create local Canvas checkpoint'),
      iconButton('×', 'close', 'Close Canvas sandbox')
    ])
  );
  return header;
}

function renderLayers() {
  const flat = flattenGraphProjection(projection()).filter((node) => node.kind !== 'workspace');
  const selected = selectedIds();
  const hovered = selection().hoveredId;
  const panel = el('aside', { className: 'studio-canvas-sandbox-panel studio-canvas-sandbox-layers' });
  panel.append(el('div', { className: 'studio-canvas-sandbox-panel-heading' }, [
    el('strong', { text: 'Graph Layers' }),
    el('span', { text: `${flat.length} nodes` })
  ]));
  const list = el('div', { className: 'studio-canvas-sandbox-layer-list' });
  flat.forEach((node) => {
    const button = el('button', {
      className: `${selected.has(node.id) ? 'is-selected ' : ''}${hovered === node.id ? 'is-hovered' : ''}`.trim(),
      type: 'button',
      dataset: { sandboxLayerId: node.id },
      attrs: { 'aria-pressed': selected.has(node.id) ? 'true' : 'false' }
    }, [
      el('span', { className: 'studio-canvas-sandbox-layer-indent', text: '·'.repeat(Math.min(4, node.depth)) }),
      el('span', { className: 'studio-canvas-sandbox-layer-kind', text: node.componentType === node.kind ? node.kind.slice(0, 1).toUpperCase() : 'C' }),
      el('span', { className: 'studio-canvas-sandbox-layer-copy' }, [
        el('strong', { text: node.name }),
        el('small', { text: `${node.componentType} • ${node.layout.mode}` })
      ])
    ]);
    button.style.setProperty('--layer-depth', String(node.depth));
    list.append(button);
  });
  panel.append(list);
  return panel;
}

function renderComponentContent(node) {
  const content = node.content || {};
  if (node.componentType === 'hero-block') {
    return el('div', { className: 'studio-canvas-graph-hero' }, [
      el('span', { text: content.eyebrow || 'EVARA GRAPH' }),
      el('h2', { text: content.title || node.name }),
      el('p', { text: content.body || '' }),
      el('button', { type: 'button', text: content.action || node.action?.label || 'Continue', attrs: { tabindex: '-1' } })
    ]);
  }
  if (node.componentType === 'metric-card') {
    return el('div', { className: 'studio-canvas-graph-metric' }, [
      el('small', { text: content.label || node.name }),
      el('strong', { text: content.value || '0' }),
      el('em', { text: content.trend || '+0%' })
    ]);
  }
  if (node.componentType === 'map-block') {
    return el('div', { className: 'studio-canvas-graph-map' }, [
      el('h3', { text: content.title || node.name }),
      el('div', { className: 'studio-canvas-graph-map-surface' }, [el('span'), el('span'), el('span'), el('span')])
    ]);
  }
  return el('div', { className: 'studio-canvas-graph-card' }, [
    el('span', { text: node.icon?.id ? '◇' : '✦' }),
    el('h3', { text: content.title || content.label || node.name }),
    el('p', { text: content.body || content.notes || 'Graph-projected component' })
  ]);
}

function renderProjectedComponent(node) {
  const selected = selectedIds().has(node.id);
  const hovered = selection().hoveredId === node.id;
  const article = el('article', {
    className: `studio-canvas-graph-node${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}`,
    draggable: tool === 'select' && !busy,
    dataset: { sandboxNodeId: node.id, componentType: node.componentType, span: node.layout.span },
    attrs: {
      role: 'button',
      tabindex: '0',
      'aria-label': `${node.name}, ${node.componentType}`,
      'aria-pressed': selected ? 'true' : 'false'
    }
  }, [
    el('span', { className: 'studio-canvas-graph-node-label', text: node.componentType.replaceAll('-', ' ') }),
    renderComponentContent(node)
  ]);
  article.style.gridColumn = `span ${node.layout.span}`;
  article.style.minHeight = `${node.layout.height}px`;
  article.style.setProperty('--sandbox-radius', `${Number(node.style?.radius || 24)}px`);
  if (selected && node.kind === 'component-instance') {
    article.append(
      el('button', {
        className: 'studio-canvas-graph-resize-handle',
        type: 'button',
        title: 'Resize component',
        dataset: { sandboxResizeHandle: node.id },
        attrs: { 'aria-label': 'Resize component' }
      }),
      el('span', { className: 'studio-canvas-graph-size-label', text: `${node.layout.span}/12` })
    );
  }
  return article;
}

function renderGraphGrid() {
  const frame = frameProjection();
  const mode = frame?.layout?.mode || 'grid';
  const grid = el('section', {
    className: `studio-canvas-graph-grid is-${mode}`,
    dataset: { sandboxGrid: 'true', frameId: frame?.id || '', layoutMode: mode }
  });
  componentProjections().forEach((node) => grid.append(renderProjectedComponent(node)));
  grid.append(
    el('div', { className: 'studio-canvas-graph-drop-end', text: 'Drop at end', dataset: { sandboxDropEnd: 'true' } }),
    el('div', { className: 'studio-canvas-graph-snap-guide', dataset: { sandboxSnapGuide: 'true' } })
  );
  return grid;
}

function renderStage() {
  const viewport = snapshot.viewport;
  const stage = el('main', { className: `studio-canvas-sandbox-stage is-${tool}`, dataset: { sandboxStage: 'true' } });
  const surface = el('div', { className: 'studio-canvas-sandbox-surface', dataset: { sandboxSurface: 'true' } });
  const deviceFrame = el('div', {
    className: 'studio-canvas-sandbox-viewport',
    dataset: { sandboxViewport: 'true', device: viewport.device }
  }, [
    el('div', { className: 'studio-canvas-sandbox-device-bar' }, [
      el('span'),
      el('strong', { text: `${DEVICE_LABELS[viewport.device]} • ${frameProjection()?.layout?.mode || 'grid'} layout` }),
      el('em', { text: `r${snapshot.graphRevision}` })
    ]),
    renderGraphGrid()
  ]);
  deviceFrame.style.width = `${projection().viewportWidth}px`;
  deviceFrame.style.transform = `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`;
  surface.append(deviceFrame);
  stage.append(surface, el('div', {
    className: 'studio-canvas-sandbox-stage-help',
    text: tool === 'pan'
      ? 'Drag to pan. Ctrl/⌘ + wheel zooms. Viewport changes are session metadata, not graph transactions.'
      : 'Completed drag and resize gestures become one durable semantic transaction.'
  }));
  return stage;
}

function titleProperty(node) {
  if (node.content?.title !== undefined) return 'content.title';
  if (node.content?.label !== undefined) return 'content.label';
  return 'content.title';
}

function renderTransactionLog() {
  const list = el('div', { className: 'studio-canvas-sandbox-transaction-list' });
  const transactions = session.getHistory().transactions.slice(-MAX_LOG_ITEMS).reverse();
  if (!transactions.length) {
    list.append(el('div', { className: 'studio-canvas-sandbox-empty is-compact' }, [
      el('p', { text: 'No durable Canvas transactions yet.' })
    ]));
    return list;
  }
  transactions.forEach((item) => list.append(el('article', { className: 'studio-canvas-sandbox-transaction' }, [
    el('strong', { text: item.intent.replaceAll('.', ' › ') }),
    el('span', { text: `revision ${item.acceptedHeadRevision} • ${item.operations.length} operation${item.operations.length === 1 ? '' : 's'}` }),
    el('small', { text: `${item.durabilityState} • ${new Date(item.createdAtClient).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` })
  ])));
  return list;
}

function renderInspector() {
  const node = selectedNode();
  const panel = el('aside', { className: 'studio-canvas-sandbox-panel studio-canvas-sandbox-inspector' });
  panel.append(el('div', { className: 'studio-canvas-sandbox-panel-heading' }, [
    el('strong', { text: node ? 'Graph Inspector' : 'Session Status' }),
    el('span', { text: `Revision ${snapshot.graphRevision}` })
  ]));
  if (node?.kind === 'component-instance') {
    const property = titleProperty(node);
    const value = property === 'content.label' ? node.content?.label : node.content?.title;
    panel.append(
      el('label', { className: 'studio-canvas-sandbox-field' }, [
        el('span', { text: 'Title / label' }),
        el('input', { type: 'text', value: value || node.name, dataset: { sandboxProperty: property, nodeId: node.id }, attrs: { maxlength: '180' } })
      ]),
      el('label', { className: 'studio-canvas-sandbox-field' }, [
        el('span', { text: 'Grid width' }),
        (() => {
          const select = el('select', { dataset: { sandboxSpan: node.id } });
          ALLOWED_SPANS.forEach((span) => {
            const option = el('option', { value: span, text: `${span}/12` });
            option.selected = Number(node.layout.sourceSpan) === span;
            select.append(option);
          });
          return select;
        })()
      ]),
      el('label', { className: 'studio-canvas-sandbox-toggle' }, [
        el('span', { text: 'Owner visibility' }),
        el('input', { type: 'checkbox', checked: node.visibility?.roles?.owner !== false, dataset: { sandboxVisibility: node.id, role: 'owner' } })
      ]),
      el('div', { className: 'studio-canvas-sandbox-inspector-actions' }, [
        el('button', { type: 'button', text: 'Bind accent token', dataset: { sandboxBinding: 'token', nodeId: node.id } }),
        el('button', { type: 'button', text: 'Bind demo data', dataset: { sandboxBinding: 'data', nodeId: node.id } })
      ]),
      el('dl', { className: 'studio-canvas-sandbox-node-meta' }, [
        el('div', {}, [el('dt', { text: 'Node' }), el('dd', { text: node.id })]),
        el('div', {}, [el('dt', { text: 'Parent' }), el('dd', { text: node.parentId || 'none' })]),
        el('div', {}, [el('dt', { text: 'Layout' }), el('dd', { text: `${node.layout.mode} • Flow/Grid/Spatial ready` })]),
        el('div', {}, [el('dt', { text: 'Source' }), el('dd', { text: snapshot.source })])
      ])
    );
  } else {
    panel.append(el('div', { className: 'studio-canvas-sandbox-empty' }, [
      el('strong', { text: snapshot.durabilityState }),
      el('p', { text: `${snapshot.transactionCount} durable transactions. Selection, hover, marquee, pan, and zoom remain ephemeral or session-only.` })
    ]));
  }
  panel.append(
    el('div', { className: 'studio-canvas-sandbox-panel-heading is-log' }, [
      el('strong', { text: 'Semantic Journal' }),
      el('span', { text: `${snapshot.transactionCount} transactions` })
    ]),
    renderTransactionLog()
  );
  return panel;
}

function renderOverlay() {
  if (!open || !snapshot?.ready) return;
  overlay?.remove();
  overlay = el('section', {
    className: 'studio-canvas-sandbox',
    dataset: { canvasSandbox: 'true', durabilityState: snapshot.durabilityState },
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Canvas GraphProjection' }
  });
  overlay.append(renderHeader(), el('div', { className: 'studio-canvas-sandbox-body' }, [renderLayers(), renderStage(), renderInspector()]));
  document.body.append(overlay);
  document.body.classList.add('is-canvas-sandbox-open');
  bindOverlayEvents();
}

function refreshEphemeralUI() {
  if (!overlay || !snapshot) return;
  const selected = selectedIds();
  overlay.querySelectorAll('[data-sandbox-node-id]').forEach((node) => {
    const active = selected.has(node.dataset.sandboxNodeId);
    node.classList.toggle('is-selected', active);
    node.classList.toggle('is-hovered', selection().hoveredId === node.dataset.sandboxNodeId);
    node.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  overlay.querySelectorAll('[data-sandbox-layer-id]').forEach((node) => {
    const active = selected.has(node.dataset.sandboxLayerId);
    node.classList.toggle('is-selected', active);
    node.classList.toggle('is-hovered', selection().hoveredId === node.dataset.sandboxLayerId);
    node.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const viewport = overlay.querySelector('[data-sandbox-viewport]');
  if (viewport) viewport.style.transform = `translate(${snapshot.viewport.panX}px, ${snapshot.viewport.panY}px) scale(${snapshot.viewport.zoom})`;
  const zoomLabel = overlay.querySelector('.studio-canvas-sandbox-zoom');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(snapshot.viewport.zoom * 100)}%`;
}

function refreshBusyState() {
  overlay?.querySelectorAll('button,input,select').forEach((control) => {
    if (busy) control.setAttribute('aria-busy', 'true');
    else control.removeAttribute('aria-busy');
  });
}

async function insertComponent() {
  const frame = frameProjection();
  if (!frame) return;
  const result = await command('canvas.component.insert', {
    parentId: frame.id,
    componentType: 'glass-card',
    name: 'Graph Canvas Card',
    span: 4,
    content: { title: 'New governed component', body: 'Inserted after the transaction became durable.' }
  });
  const created = result?.acceptedOperations?.find((operation) => operation.type === 'node.create')?.payload?.node?.id;
  if (created) session.selection.replace([created]);
}

async function duplicateSelection() {
  const node = selectedNode();
  if (!node || node.kind !== 'component-instance') return;
  const result = await command('canvas.component.duplicate', { nodeId: node.id });
  const created = result?.acceptedOperations?.find((operation) => operation.type === 'node.create')?.payload?.node?.id;
  if (created) session.selection.replace([created]);
}

async function deleteSelection() {
  const node = selectedNode();
  if (!node || node.kind !== 'component-instance') return;
  if (!window.confirm(`Delete ${node.name} from the local Canvas draft?`)) return;
  session.selection.clear();
  await command('canvas.component.delete', { nodeId: node.id });
}

function clearDropIndicators() {
  overlay?.querySelectorAll('.is-drop-before,.is-drop-after').forEach((node) => node.classList.remove('is-drop-before', 'is-drop-after'));
  overlay?.querySelector('[data-sandbox-drop-end]')?.classList.remove('is-active');
}

async function completeMove(targetId, position) {
  if (!dragState?.nodeId) return;
  const siblings = componentProjections();
  const fromIndex = siblings.findIndex((node) => node.id === dragState.nodeId);
  let toIndex;
  if (!targetId) toIndex = siblings.length - 1;
  else {
    const targetIndex = siblings.findIndex((node) => node.id === targetId);
    toIndex = targetIndex + (position === 'after' ? 1 : 0);
    if (fromIndex < toIndex) toIndex -= 1;
  }
  toIndex = Math.max(0, Math.min(siblings.length - 1, toIndex));
  const gesture = session.interaction.complete(() => ({ type: 'canvas.component.move', payload: { nodeId: dragState.nodeId, toIndex } }));
  if (toIndex !== fromIndex && gesture) await command(gesture.type, gesture.payload);
}

function startResize(event, nodeId) {
  const article = overlay?.querySelector(`[data-sandbox-node-id="${CSS.escape(nodeId)}"]`);
  const grid = overlay?.querySelector('[data-sandbox-grid]');
  if (!article || !grid) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = article.getBoundingClientRect();
  resizeState = { nodeId, article, grid, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, span: Number(article.dataset.span || 4) };
  session.interaction.begin('resize', { nodeId, width: rect.width, height: rect.height, span: resizeState.span });
  article.classList.add('is-resizing');
  overlay?.querySelector('[data-sandbox-snap-guide]')?.classList.add('is-active');
}

function updateResize(event) {
  if (!resizeState) return;
  const viewport = snapshot.viewport;
  const gridRect = resizeState.grid.getBoundingClientRect();
  const width = Math.max(140, resizeState.width + (event.clientX - resizeState.startX) / viewport.zoom);
  const height = Math.max(90, resizeState.height + (event.clientY - resizeState.startY) / viewport.zoom);
  const approximateSpan = Math.round((width / Math.max(1, gridRect.width / viewport.zoom)) * 12);
  const span = ALLOWED_SPANS.reduce((best, candidate) => Math.abs(candidate - approximateSpan) < Math.abs(best - approximateSpan) ? candidate : best, resizeState.span);
  const snapped = session.snapResolver.resolve({ mode: 'grid', rect: { x: 0, y: 0, width, height }, gridSize: 8, threshold: 7 });
  resizeState.nextWidth = Math.round(snapped.rect.width);
  resizeState.nextHeight = Math.round(snapped.rect.height);
  resizeState.nextSpan = span;
  session.interaction.update({ nodeId: resizeState.nodeId, width: resizeState.nextWidth, height: resizeState.nextHeight, span });
  resizeState.article.style.gridColumn = `span ${span}`;
  resizeState.article.style.minHeight = `${resizeState.nextHeight}px`;
  const label = resizeState.article.querySelector('.studio-canvas-graph-size-label');
  if (label) label.textContent = `${span}/12 • ${resizeState.nextWidth}×${resizeState.nextHeight}`;
}

async function finishResize() {
  if (!resizeState) return;
  const state = resizeState;
  resizeState = null;
  overlay?.querySelector('[data-sandbox-snap-guide]')?.classList.remove('is-active');
  const gesture = session.interaction.complete((completed) => ({
    type: 'canvas.component.resize',
    payload: {
      nodeId: state.nodeId,
      width: completed.current.width || state.width,
      height: completed.current.height || state.height,
      span: completed.current.span || state.span
    }
  }));
  if (gesture) await command(gesture.type, gesture.payload);
}

function startPan(event) {
  if (tool !== 'pan' && event.button !== 1) return false;
  if (event.target.closest('[data-sandbox-node-id],button,input,select')) return false;
  event.preventDefault();
  panState = { startX: event.clientX, startY: event.clientY, panX: snapshot.viewport.panX, panY: snapshot.viewport.panY };
  session.interaction.begin('pan', panState);
  overlay?.querySelector('[data-sandbox-stage]')?.classList.add('is-panning');
  return true;
}

function updatePan(event) {
  if (!panState) return;
  const panX = panState.panX + event.clientX - panState.startX;
  const panY = panState.panY + event.clientY - panState.startY;
  session.interaction.update({ panX, panY });
  session.viewport.setPan(panX, panY);
}

function finishPan() {
  if (!panState) return;
  panState = null;
  session.interaction.complete();
  overlay?.querySelector('[data-sandbox-stage]')?.classList.remove('is-panning');
}

function startMarquee(event) {
  if (tool !== 'select' || event.button !== 0) return false;
  if (!event.target.matches('[data-sandbox-grid],[data-sandbox-surface]')) return false;
  const surface = overlay?.querySelector('[data-sandbox-surface]');
  if (!surface) return false;
  const rect = surface.getBoundingClientRect();
  const marquee = el('div', { className: 'studio-canvas-sandbox-marquee', dataset: { sandboxMarquee: 'true' } });
  surface.append(marquee);
  marqueeState = { surface, marquee, rect, startX: event.clientX - rect.left, startY: event.clientY - rect.top, additive: event.shiftKey };
  session.interaction.begin('marquee', { x: marqueeState.startX, y: marqueeState.startY });
  event.preventDefault();
  return true;
}

function updateMarquee(event) {
  if (!marqueeState) return;
  const currentX = event.clientX - marqueeState.rect.left;
  const currentY = event.clientY - marqueeState.rect.top;
  const left = Math.min(marqueeState.startX, currentX);
  const top = Math.min(marqueeState.startY, currentY);
  const width = Math.abs(currentX - marqueeState.startX);
  const height = Math.abs(currentY - marqueeState.startY);
  Object.assign(marqueeState.marquee.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  marqueeState.selectionRect = { left: marqueeState.rect.left + left, top: marqueeState.rect.top + top, right: marqueeState.rect.left + left + width, bottom: marqueeState.rect.top + top + height };
  session.selection.setMarquee(marqueeState.selectionRect);
  session.interaction.update(marqueeState.selectionRect);
}

function finishMarquee() {
  if (!marqueeState) return;
  const { selectionRect, additive, marquee } = marqueeState;
  marqueeState = null;
  marquee.remove();
  session.selection.setMarquee(null);
  session.interaction.complete();
  if (!selectionRect || selectionRect.right - selectionRect.left < 4 || selectionRect.bottom - selectionRect.top < 4) return;
  const next = additive ? new Set(selection().selectedIds) : new Set();
  overlay?.querySelectorAll('[data-sandbox-node-id]').forEach((node) => {
    const rect = node.getBoundingClientRect();
    const intersects = rect.left < selectionRect.right && rect.right > selectionRect.left && rect.top < selectionRect.bottom && rect.bottom > selectionRect.top;
    if (intersects) next.add(node.dataset.sandboxNodeId);
  });
  session.selection.replace([...next]);
}

function bindOverlayEvents() {
  if (!overlay) return;
  overlay.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-sandbox-action]');
    if (action) {
      const value = action.dataset.sandboxAction;
      if (value === 'close') closeSandbox();
      else if (value === 'undo') { await session.undo(); snapshot = session.snapshot(); }
      else if (value === 'redo') { await session.redo(); snapshot = session.snapshot(); }
      else if (value === 'zoom-in') session.viewport.zoomBy(0.08);
      else if (value === 'zoom-out') session.viewport.zoomBy(-0.08);
      else if (value === 'reset-view') session.viewport.reset();
      else if (value === 'insert') await insertComponent();
      else if (value === 'duplicate') await duplicateSelection();
      else if (value === 'delete') await deleteSelection();
      else if (value === 'checkpoint') { await session.checkpoint(); showMessage('Local Canvas recovery checkpoint created.'); }
      return;
    }
    const toolButton = event.target.closest('[data-sandbox-tool]');
    if (toolButton) { tool = toolButton.dataset.sandboxTool === 'pan' ? 'pan' : 'select'; renderOverlay(); return; }
    const deviceButton = event.target.closest('[data-sandbox-device]');
    if (deviceButton) { session.viewport.setDevice(deviceButton.dataset.sandboxDevice); return; }
    const layer = event.target.closest('[data-sandbox-layer-id]');
    if (layer) { session.selection.select(layer.dataset.sandboxLayerId, { additive: event.shiftKey, toggle: event.shiftKey }); return; }
    const node = event.target.closest('[data-sandbox-node-id]');
    if (node && !event.target.closest('[data-sandbox-resize-handle]')) session.selection.select(node.dataset.sandboxNodeId, { additive: event.shiftKey, toggle: event.shiftKey });
  });

  overlay.addEventListener('change', async (event) => {
    if (event.target.matches('[data-sandbox-property]')) {
      await command('canvas.property.set', { nodeId: event.target.dataset.nodeId, property: event.target.dataset.sandboxProperty, value: text(event.target.value, 180) });
    } else if (event.target.matches('[data-sandbox-span]')) {
      await command('canvas.layout.set', { nodeId: event.target.dataset.sandboxSpan, layout: { span: Number(event.target.value) } });
    } else if (event.target.matches('[data-sandbox-visibility]')) {
      await command('canvas.visibility.set', { nodeId: event.target.dataset.sandboxVisibility, role: event.target.dataset.role, visible: event.target.checked });
    }
  });

  overlay.addEventListener('click', async (event) => {
    const binding = event.target.closest('[data-sandbox-binding]');
    if (!binding) return;
    if (binding.dataset.sandboxBinding === 'token') await command('canvas.token.bind', { nodeId: binding.dataset.nodeId, name: 'accent', value: 'color.accent.primary' });
    else await command('canvas.data.bind', { nodeId: binding.dataset.nodeId, name: 'value', value: 'sandbox.metrics.example' });
  });

  overlay.addEventListener('pointerover', (event) => {
    const node = event.target.closest('[data-sandbox-node-id]');
    session.selection.setHovered(node?.dataset.sandboxNodeId || null);
  });

  overlay.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-sandbox-resize-handle]');
    if (handle) { startResize(event, handle.dataset.sandboxResizeHandle); return; }
    if (startPan(event)) return;
    startMarquee(event);
  });

  overlay.addEventListener('wheel', (event) => {
    if (!event.target.closest('[data-sandbox-stage]') || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    session.viewport.zoomBy(event.deltaY < 0 ? 0.06 : -0.06);
  }, { passive: false });

  overlay.addEventListener('dragstart', (event) => {
    const node = event.target.closest('[data-sandbox-node-id]');
    if (!node || tool !== 'select' || busy) return;
    dragState = { nodeId: node.dataset.sandboxNodeId, targetId: null, position: null };
    session.interaction.begin('move', { nodeId: dragState.nodeId });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/x-evara-canvas-node', dragState.nodeId);
    node.classList.add('is-dragging');
  });

  overlay.addEventListener('dragover', (event) => {
    if (!dragState) return;
    const node = event.target.closest('[data-sandbox-node-id]');
    const end = event.target.closest('[data-sandbox-drop-end]');
    if (!node && !end) return;
    event.preventDefault();
    clearDropIndicators();
    if (end) {
      end.classList.add('is-active');
      dragState.targetId = null;
      dragState.position = 'end';
      return;
    }
    if (node.dataset.sandboxNodeId === dragState.nodeId) return;
    const rect = node.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    node.classList.add(position === 'before' ? 'is-drop-before' : 'is-drop-after');
    dragState.targetId = node.dataset.sandboxNodeId;
    dragState.position = position;
    session.interaction.update({ nodeId: dragState.nodeId, targetId: dragState.targetId, position });
  });

  overlay.addEventListener('drop', async (event) => {
    if (!dragState) return;
    event.preventDefault();
    const state = { ...dragState };
    await completeMove(state.targetId, state.position);
    dragState = null;
    clearDropIndicators();
  });

  overlay.addEventListener('dragend', () => {
    if (dragState) session.interaction.cancel();
    dragState = null;
    clearDropIndicators();
  });
}

function bindGlobalPointerEvents() {
  window.addEventListener('pointermove', (event) => {
    updateResize(event);
    updatePan(event);
    updateMarquee(event);
  });
  window.addEventListener('pointerup', async () => {
    await finishResize();
    finishPan();
    finishMarquee();
  });
}

function injectToggle() {
  const actions = document.querySelector('.studio-top-actions');
  if (!actions || actions.querySelector('[data-canvas-sandbox-toggle]')) return;
  const button = el('button', {
    className: 'studio-text-button studio-canvas-sandbox-toggle',
    type: 'button',
    text: 'Graph',
    title: 'Open journaled Canvas GraphProjection',
    dataset: { canvasSandboxToggle: 'true' }
  });
  button.addEventListener('click', openSandbox);
  actions.prepend(button);
}

async function openSandbox() {
  open = true;
  try {
    await ensureSession();
    snapshot = session.snapshot();
    renderOverlay();
  } catch (error) {
    open = false;
    showMessage(error?.message || 'CanvasSession could not initialize.', 'error');
  }
}

function closeSandbox() {
  open = false;
  overlay?.remove();
  overlay = null;
  document.body.classList.remove('is-canvas-sandbox-open');
}

function boot() {
  bindGlobalPointerEvents();
  const root = document.querySelector('#appRoot');
  if (!root) return;
  observer = new MutationObserver(injectToggle);
  observer.observe(root, { childList: true, subtree: true });
  injectToggle();
}

window.EvaraCanvasSandbox = Object.freeze({
  open: openSandbox,
  close: closeSandbox,
  commands: CANVAS_SEMANTIC_COMMANDS,
  getSession: () => session,
  getGraph: () => session?.getGraph() || null,
  getProjection: () => session?.getProjection() || null,
  dispatch: (type, payload) => command(type, payload, { throwOnError: true }),
  undo: () => session?.undo(),
  redo: () => session?.redo(),
  pendingTransactions: () => session?.pendingTransactions() || Promise.resolve([])
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
