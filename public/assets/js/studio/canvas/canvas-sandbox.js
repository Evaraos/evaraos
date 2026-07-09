import { createCanvasSandboxFixture } from './canvas-sandbox-fixture.js';
import {
  findProjectedNode,
  flattenGraphProjection,
  projectCanvasPage
} from './graph-projection.js';
import {
  CANVAS_SEMANTIC_COMMANDS,
  MockOperationDispatcher
} from './mock-operation-dispatcher.js';

const DEVICE_LABELS = Object.freeze({ desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' });
const ALLOWED_SPANS = Object.freeze([3, 4, 6, 8, 12]);
const MAX_LOG_ITEMS = 16;

let dispatcher = null;
let projection = null;
let overlay = null;
let open = false;
let tool = 'select';
let device = 'desktop';
let zoom = 0.78;
let panX = 0;
let panY = 0;
let selectedIds = new Set();
let hoveredId = null;
let transactionLog = [];
let dragState = null;
let resizeState = null;
let panState = null;
let marqueeState = null;
let observer = null;

function text(value, max = 400) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 2000);
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

function frameProjection() {
  return projection?.page?.children?.find((node) => ['frame', 'container', 'panel'].includes(node.kind)) || projection?.page;
}

function componentProjections() {
  return (frameProjection()?.children || []).filter((node) => node.kind === 'component-instance');
}

function selectedNode() {
  const id = [...selectedIds][0];
  return id ? findProjectedNode(projection, id) : null;
}

function ensureDispatcher() {
  if (dispatcher) return;
  dispatcher = new MockOperationDispatcher(createCanvasSandboxFixture());
  dispatcher.subscribe((event, graph) => {
    transactionLog.unshift({
      intent: event.intent,
      transactionId: event.transactionId,
      revision: event.graphRevision,
      operationCount: event.acceptedOperations.length,
      inverseCount: event.inverseOperations.length,
      occurredAt: new Date().toISOString()
    });
    transactionLog = transactionLog.slice(0, MAX_LOG_ITEMS);
    projection = projectCanvasPage(graph, { device });
    selectedIds = new Set([...selectedIds].filter((id) => findProjectedNode(projection, id)));
    if (open) renderOverlay();
  });
  projection = projectCanvasPage(dispatcher.getGraph(), { device });
}

function dispatch(type, payload) {
  ensureDispatcher();
  try {
    return dispatcher.dispatch({ type, payload });
  } catch (error) {
    showMessage(error?.message || 'Canvas command failed.', 'error');
    return null;
  }
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

function iconButton(label, action, title, disabled = false) {
  return el('button', {
    className: 'studio-canvas-sandbox-icon-button',
    type: 'button',
    text: label,
    title,
    disabled,
    dataset: { sandboxAction: action }
  });
}

function renderHeader() {
  const selected = selectedNode()?.kind === 'component-instance' ? selectedNode() : null;
  const header = el('header', { className: 'studio-canvas-sandbox-header' });
  header.append(
    el('div', { className: 'studio-canvas-sandbox-title' }, [
      el('span', { className: 'studio-canvas-sandbox-mark', text: 'G' }),
      el('div', {}, [
        el('strong', { text: 'Canvas GraphProjection Sandbox' }),
        el('small', { text: 'Evara Graph fixture • mock dispatcher • no production writes' })
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
        className: device === value ? 'is-active' : '',
        type: 'button',
        text: DEVICE_LABELS[value],
        dataset: { sandboxDevice: value }
      }))),
      iconButton('−', 'zoom-out', 'Zoom out'),
      el('span', { className: 'studio-canvas-sandbox-zoom', text: `${Math.round(zoom * 100)}%` }),
      iconButton('+', 'zoom-in', 'Zoom in'),
      iconButton('Reset', 'reset-view', 'Reset viewport'),
      iconButton('Add', 'insert', 'Insert a component'),
      iconButton('Duplicate', 'duplicate', 'Duplicate selected component', !selected),
      iconButton('Delete', 'delete', 'Delete selected component', !selected),
      iconButton('×', 'close', 'Close Canvas sandbox')
    ])
  );
  return header;
}

function renderLayers() {
  const flat = flattenGraphProjection(projection).filter((node) => node.kind !== 'workspace');
  const panel = el('aside', { className: 'studio-canvas-sandbox-panel studio-canvas-sandbox-layers' });
  panel.append(
    el('div', { className: 'studio-canvas-sandbox-panel-heading' }, [
      el('strong', { text: 'Graph Layers' }),
      el('span', { text: `${flat.length} nodes` })
    ])
  );
  const list = el('div', { className: 'studio-canvas-sandbox-layer-list' });
  flat.forEach((node) => {
    const button = el('button', {
      className: `${selectedIds.has(node.id) ? 'is-selected ' : ''}${hoveredId === node.id ? 'is-hovered' : ''}`.trim(),
      type: 'button',
      dataset: { sandboxLayerId: node.id },
      attrs: { 'aria-pressed': selectedIds.has(node.id) ? 'true' : 'false' }
    }, [
      el('span', { className: 'studio-canvas-sandbox-layer-indent', text: '·'.repeat(Math.min(4, node.depth)) }),
      el('span', { className: 'studio-canvas-sandbox-layer-kind', text: node.componentType === node.kind ? node.kind.slice(0, 1).toUpperCase() : 'C' }),
      el('span', { className: 'studio-canvas-sandbox-layer-copy' }, [
        el('strong', { text: node.name }),
        el('small', { text: node.componentType })
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
      el('button', { type: 'button', text: content.action || 'Continue', attrs: { tabindex: '-1' } })
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
      el('div', { className: 'studio-canvas-graph-map-surface' }, [
        el('span', { text: '•' }), el('span', { text: '•' }), el('span', { text: '•' }), el('span', { text: '•' })
      ])
    ]);
  }
  return el('div', { className: 'studio-canvas-graph-card' }, [
    el('span', { text: '✦' }),
    el('h3', { text: content.title || node.name }),
    el('p', { text: content.body || 'Graph-projected component' })
  ]);
}

function renderProjectedComponent(node) {
  const selected = selectedIds.has(node.id);
  const article = el('article', {
    className: `studio-canvas-graph-node${selected ? ' is-selected' : ''}${hoveredId === node.id ? ' is-hovered' : ''}`,
    draggable: tool === 'select',
    dataset: {
      sandboxNodeId: node.id,
      componentType: node.componentType,
      span: node.layout.span
    },
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
  const grid = el('section', {
    className: 'studio-canvas-graph-grid',
    dataset: { sandboxGrid: 'true', frameId: frame?.id || '' }
  });
  componentProjections().forEach((node) => grid.append(renderProjectedComponent(node)));
  grid.append(
    el('div', { className: 'studio-canvas-graph-drop-end', text: 'Drop at end', dataset: { sandboxDropEnd: 'true' } }),
    el('div', { className: 'studio-canvas-graph-snap-guide', dataset: { sandboxSnapGuide: 'true' } })
  );
  return grid;
}

function renderStage() {
  const stage = el('main', {
    className: `studio-canvas-sandbox-stage is-${tool}`,
    dataset: { sandboxStage: 'true' }
  });
  const surface = el('div', { className: 'studio-canvas-sandbox-surface', dataset: { sandboxSurface: 'true' } });
  const viewport = el('div', {
    className: 'studio-canvas-sandbox-viewport',
    dataset: { sandboxViewport: 'true', device }
  }, [
    el('div', { className: 'studio-canvas-sandbox-device-bar' }, [
      el('span'),
      el('strong', { text: `${DEVICE_LABELS[device]} Graph Fixture` }),
      el('em', { text: `r${projection.graphRevision}` })
    ]),
    renderGraphGrid()
  ]);
  viewport.style.width = `${projection.viewportWidth}px`;
  surface.append(viewport);
  stage.append(
    surface,
    el('div', { className: 'studio-canvas-sandbox-stage-help', text: tool === 'pan'
      ? 'Drag the stage to pan. Use Ctrl/⌘ + wheel or the zoom controls.'
      : 'Click or Shift-click to select. Drag components to reorder. Drag empty space for marquee selection.' })
  );
  requestAnimationFrame(applyViewportTransform);
  return stage;
}

function renderInspector() {
  const node = selectedNode();
  const panel = el('aside', { className: 'studio-canvas-sandbox-panel studio-canvas-sandbox-inspector' });
  panel.append(el('div', { className: 'studio-canvas-sandbox-panel-heading' }, [
    el('strong', { text: node ? 'Graph Inspector' : 'Sandbox Status' }),
    el('span', { text: `Revision ${projection.graphRevision}` })
  ]));

  if (node?.kind === 'component-instance') {
    const titleValue = node.content?.title || node.content?.label || node.name;
    panel.append(
      el('label', { className: 'studio-canvas-sandbox-field' }, [
        el('span', { text: 'Title / label' }),
        el('input', {
          type: 'text',
          value: titleValue,
          dataset: { sandboxProperty: node.content?.label !== undefined ? 'content.label' : 'content.title', nodeId: node.id },
          attrs: { maxlength: '180' }
        })
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
        el('input', {
          type: 'checkbox',
          checked: node.visibility?.roles?.owner !== false,
          dataset: { sandboxVisibility: node.id, role: 'owner' }
        })
      ]),
      el('div', { className: 'studio-canvas-sandbox-inspector-actions' }, [
        el('button', { type: 'button', text: 'Bind accent token', dataset: { sandboxBinding: 'token', nodeId: node.id } }),
        el('button', { type: 'button', text: 'Bind demo data', dataset: { sandboxBinding: 'data', nodeId: node.id } })
      ]),
      el('dl', { className: 'studio-canvas-sandbox-node-meta' }, [
        el('div', {}, [el('dt', { text: 'Node' }), el('dd', { text: node.id })]),
        el('div', {}, [el('dt', { text: 'Parent' }), el('dd', { text: node.parentId || 'none' })]),
        el('div', {}, [el('dt', { text: 'Kind' }), el('dd', { text: node.kind })]),
        el('div', {}, [el('dt', { text: 'Component' }), el('dd', { text: node.componentType })])
      ])
    );
  } else {
    panel.append(el('div', { className: 'studio-canvas-sandbox-empty' }, [
      el('strong', { text: 'Select a component' }),
      el('p', { text: 'Selection and hover remain ephemeral. Persistent changes must pass through the mock Operation Dispatcher.' })
    ]));
  }

  panel.append(
    el('div', { className: 'studio-canvas-sandbox-panel-heading is-log' }, [
      el('strong', { text: 'Semantic Transactions' }),
      el('span', { text: `${transactionLog.length} recent` })
    ]),
    renderTransactionLog()
  );
  return panel;
}

function renderTransactionLog() {
  const list = el('div', { className: 'studio-canvas-sandbox-transaction-list' });
  if (!transactionLog.length) {
    list.append(el('div', { className: 'studio-canvas-sandbox-empty is-compact' }, [
      el('p', { text: 'Complete a drag, resize, insert, duplicate, delete, property, layout, visibility, token, or data action.' })
    ]));
    return list;
  }
  transactionLog.forEach((item) => list.append(el('article', { className: 'studio-canvas-sandbox-transaction' }, [
    el('strong', { text: item.intent.replaceAll('.', ' › ') }),
    el('span', { text: `revision ${item.revision} • ${item.operationCount} operation${item.operationCount === 1 ? '' : 's'}` }),
    el('small', { text: `${item.inverseCount} inverse • ${new Date(item.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` })
  ])));
  return list;
}

function renderOverlay() {
  if (!open) return;
  ensureDispatcher();
  overlay?.remove();
  overlay = el('section', {
    className: 'studio-canvas-sandbox',
    dataset: { canvasSandbox: 'true' },
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Canvas GraphProjection Sandbox' }
  });
  overlay.append(
    renderHeader(),
    el('div', { className: 'studio-canvas-sandbox-body' }, [
      renderLayers(),
      renderStage(),
      renderInspector()
    ])
  );
  document.body.append(overlay);
  document.body.classList.add('is-canvas-sandbox-open');
  bindOverlayEvents();
}

function applyViewportTransform() {
  const viewport = overlay?.querySelector('[data-sandbox-viewport]');
  if (!viewport) return;
  viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function setDevice(nextDevice) {
  if (!Object.hasOwn(DEVICE_LABELS, nextDevice)) return;
  device = nextDevice;
  projection = projectCanvasPage(dispatcher.getGraph(), { device });
  renderOverlay();
}

function setZoom(nextZoom) {
  zoom = Math.min(1.4, Math.max(0.42, Number(nextZoom) || 0.78));
  const label = overlay?.querySelector('.studio-canvas-sandbox-zoom');
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
  applyViewportTransform();
}

function select(id, additive = false) {
  if (!id || !findProjectedNode(projection, id)) return;
  if (!additive) selectedIds.clear();
  if (additive && selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderOverlay();
}

function insertComponent() {
  const frame = frameProjection();
  if (!frame) return;
  const result = dispatch('canvas.component.insert', {
    parentId: frame.id,
    componentType: 'glass-card',
    name: 'Graph Sandbox Card',
    span: 4,
    content: { title: 'New governed component', body: 'Inserted through canvas.component.insert.' }
  });
  const created = result?.acceptedOperations?.find((operation) => operation.type === 'node.create')?.payload?.node?.id;
  if (created) { selectedIds = new Set([created]); renderOverlay(); }
}

function duplicateSelection() {
  const node = selectedNode();
  if (!node?.id || node.kind !== 'component-instance') return;
  const result = dispatch('canvas.component.duplicate', { nodeId: node.id });
  const created = result?.acceptedOperations?.find((operation) => operation.type === 'node.create')?.payload?.node?.id;
  if (created) { selectedIds = new Set([created]); renderOverlay(); }
}

function deleteSelection() {
  const node = selectedNode();
  if (!node?.id || node.kind !== 'component-instance') return;
  if (!window.confirm(`Delete ${node.name} from the sandbox graph?`)) return;
  selectedIds.delete(node.id);
  dispatch('canvas.component.delete', { nodeId: node.id });
}

function clearDropIndicators() {
  overlay?.querySelectorAll('.is-drop-before, .is-drop-after').forEach((node) => node.classList.remove('is-drop-before', 'is-drop-after'));
  overlay?.querySelector('[data-sandbox-drop-end]')?.classList.remove('is-active');
}

function completeMove(targetId, position) {
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
  if (toIndex !== fromIndex) dispatch('canvas.component.move', { nodeId: dragState.nodeId, toIndex });
}

function startResize(event, nodeId) {
  const article = overlay?.querySelector(`[data-sandbox-node-id="${CSS.escape(nodeId)}"]`);
  const grid = overlay?.querySelector('[data-sandbox-grid]');
  if (!article || !grid) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = article.getBoundingClientRect();
  resizeState = {
    nodeId,
    article,
    grid,
    startX: event.clientX,
    startY: event.clientY,
    width: rect.width,
    height: rect.height,
    span: Number(article.dataset.span || 4)
  };
  article.classList.add('is-resizing');
  overlay?.querySelector('[data-sandbox-snap-guide]')?.classList.add('is-active');
}

function updateResize(event) {
  if (!resizeState) return;
  const gridRect = resizeState.grid.getBoundingClientRect();
  const width = Math.max(140, resizeState.width + (event.clientX - resizeState.startX) / zoom);
  const height = Math.max(90, resizeState.height + (event.clientY - resizeState.startY) / zoom);
  const approximateSpan = Math.round((width / Math.max(1, gridRect.width / zoom)) * 12);
  const span = ALLOWED_SPANS.reduce((best, candidate) => Math.abs(candidate - approximateSpan) < Math.abs(best - approximateSpan) ? candidate : best, resizeState.span);
  resizeState.nextWidth = Math.round(width);
  resizeState.nextHeight = Math.round(height);
  resizeState.nextSpan = span;
  resizeState.article.style.gridColumn = `span ${span}`;
  resizeState.article.style.minHeight = `${Math.round(height)}px`;
  const label = resizeState.article.querySelector('.studio-canvas-graph-size-label');
  if (label) label.textContent = `${span}/12 • ${Math.round(width)}×${Math.round(height)}`;
}

function finishResize() {
  if (!resizeState) return;
  const state = resizeState;
  resizeState = null;
  overlay?.querySelector('[data-sandbox-snap-guide]')?.classList.remove('is-active');
  dispatch('canvas.component.resize', {
    nodeId: state.nodeId,
    width: state.nextWidth || state.width,
    height: state.nextHeight || state.height,
    span: state.nextSpan || state.span
  });
}

function startPan(event) {
  if (tool !== 'pan' && event.button !== 1) return false;
  if (event.target.closest('[data-sandbox-node-id], button, input, select')) return false;
  event.preventDefault();
  panState = { startX: event.clientX, startY: event.clientY, panX, panY };
  overlay?.querySelector('[data-sandbox-stage]')?.classList.add('is-panning');
  return true;
}

function updatePan(event) {
  if (!panState) return;
  panX = panState.panX + event.clientX - panState.startX;
  panY = panState.panY + event.clientY - panState.startY;
  applyViewportTransform();
}

function finishPan() {
  if (!panState) return;
  panState = null;
  overlay?.querySelector('[data-sandbox-stage]')?.classList.remove('is-panning');
}

function startMarquee(event) {
  if (tool !== 'select' || event.button !== 0) return false;
  if (!event.target.matches('[data-sandbox-grid], [data-sandbox-surface]')) return false;
  const surface = overlay?.querySelector('[data-sandbox-surface]');
  if (!surface) return false;
  const rect = surface.getBoundingClientRect();
  const marquee = el('div', { className: 'studio-canvas-sandbox-marquee', dataset: { sandboxMarquee: 'true' } });
  surface.append(marquee);
  marqueeState = {
    surface,
    marquee,
    rect,
    startX: event.clientX - rect.left,
    startY: event.clientY - rect.top,
    additive: event.shiftKey
  };
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
  Object.assign(marqueeState.marquee.style, {
    left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`
  });
  marqueeState.selectionRect = {
    left: marqueeState.rect.left + left,
    top: marqueeState.rect.top + top,
    right: marqueeState.rect.left + left + width,
    bottom: marqueeState.rect.top + top + height
  };
}

function finishMarquee() {
  if (!marqueeState) return;
  const { selectionRect, additive, marquee } = marqueeState;
  marqueeState = null;
  marquee.remove();
  if (!selectionRect || selectionRect.right - selectionRect.left < 4 || selectionRect.bottom - selectionRect.top < 4) return;
  const next = additive ? new Set(selectedIds) : new Set();
  overlay?.querySelectorAll('[data-sandbox-node-id]').forEach((node) => {
    const rect = node.getBoundingClientRect();
    const intersects = rect.left < selectionRect.right && rect.right > selectionRect.left && rect.top < selectionRect.bottom && rect.bottom > selectionRect.top;
    if (intersects) next.add(node.dataset.sandboxNodeId);
  });
  selectedIds = next;
  renderOverlay();
}

function bindOverlayEvents() {
  if (!overlay) return;

  overlay.addEventListener('click', (event) => {
    const action = event.target.closest('[data-sandbox-action]');
    if (action) {
      const value = action.dataset.sandboxAction;
      if (value === 'close') closeSandbox();
      else if (value === 'zoom-in') setZoom(zoom + 0.08);
      else if (value === 'zoom-out') setZoom(zoom - 0.08);
      else if (value === 'reset-view') { zoom = 0.78; panX = 0; panY = 0; renderOverlay(); }
      else if (value === 'insert') insertComponent();
      else if (value === 'duplicate') duplicateSelection();
      else if (value === 'delete') deleteSelection();
      return;
    }

    const layer = event.target.closest('[data-sandbox-layer-id]');
    if (layer) { select(layer.dataset.sandboxLayerId, event.shiftKey); return; }

    const node = event.target.closest('[data-sandbox-node-id]');
    if (node && !event.target.closest('[data-sandbox-resize-handle]')) {
      select(node.dataset.sandboxNodeId, event.shiftKey);
    }
  });

  overlay.addEventListener('click', (event) => {
    const toolButton = event.target.closest('[data-sandbox-tool]');
    if (toolButton) { tool = toolButton.dataset.sandboxTool === 'pan' ? 'pan' : 'select'; renderOverlay(); return; }
    const deviceButton = event.target.closest('[data-sandbox-device]');
    if (deviceButton) setDevice(deviceButton.dataset.sandboxDevice);
  });

  overlay.addEventListener('change', (event) => {
    if (event.target.matches('[data-sandbox-property]')) {
      dispatch('canvas.property.set', {
        nodeId: event.target.dataset.nodeId,
        property: event.target.dataset.sandboxProperty,
        value: text(event.target.value, 180)
      });
    } else if (event.target.matches('[data-sandbox-span]')) {
      dispatch('canvas.layout.set', {
        nodeId: event.target.dataset.sandboxSpan,
        layout: { span: Number(event.target.value) }
      });
    } else if (event.target.matches('[data-sandbox-visibility]')) {
      dispatch('canvas.visibility.set', {
        nodeId: event.target.dataset.sandboxVisibility,
        role: event.target.dataset.role,
        visible: event.target.checked
      });
    }
  });

  overlay.addEventListener('click', (event) => {
    const binding = event.target.closest('[data-sandbox-binding]');
    if (!binding) return;
    if (binding.dataset.sandboxBinding === 'token') {
      dispatch('canvas.token.bind', { nodeId: binding.dataset.nodeId, name: 'accent', value: 'color.accent.primary' });
      showMessage('Token binding added to the sandbox graph.');
    } else {
      dispatch('canvas.data.bind', { nodeId: binding.dataset.nodeId, name: 'value', value: 'sandbox.metrics.example' });
      showMessage('Data binding added to the sandbox graph.');
    }
  });

  overlay.addEventListener('pointerover', (event) => {
    const node = event.target.closest('[data-sandbox-node-id]');
    const id = node?.dataset.sandboxNodeId || null;
    if (id === hoveredId) return;
    hoveredId = id;
    overlay.querySelectorAll('.is-hovered').forEach((item) => item.classList.remove('is-hovered'));
    if (id) {
      node.classList.add('is-hovered');
      overlay.querySelector(`[data-sandbox-layer-id="${CSS.escape(id)}"]`)?.classList.add('is-hovered');
    }
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
    setZoom(zoom + (event.deltaY < 0 ? 0.06 : -0.06));
  }, { passive: false });

  overlay.addEventListener('dragstart', (event) => {
    const node = event.target.closest('[data-sandbox-node-id]');
    if (!node || tool !== 'select') return;
    dragState = { nodeId: node.dataset.sandboxNodeId, targetId: null, position: null };
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
    event.dataTransfer.dropEffect = 'move';
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
  });

  overlay.addEventListener('drop', (event) => {
    if (!dragState) return;
    event.preventDefault();
    completeMove(dragState.targetId, dragState.position);
    dragState = null;
    clearDropIndicators();
  });

  overlay.addEventListener('dragend', () => {
    dragState = null;
    clearDropIndicators();
    overlay?.querySelectorAll('.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
  });
}

function bindGlobalPointerEvents() {
  window.addEventListener('pointermove', (event) => {
    updateResize(event);
    updatePan(event);
    updateMarquee(event);
  });
  window.addEventListener('pointerup', () => {
    finishResize();
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
    title: 'Open Canvas GraphProjection Sandbox',
    dataset: { canvasSandboxToggle: 'true' }
  });
  button.addEventListener('click', openSandbox);
  actions.prepend(button);
}

function openSandbox() {
  open = true;
  ensureDispatcher();
  renderOverlay();
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
  getGraph: () => dispatcher?.getGraph() || createCanvasSandboxFixture(),
  getProjection: () => projection,
  dispatch
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
