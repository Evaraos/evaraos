const AUTO_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1';
const HISTORY_LIMIT = 30;
const DIRECTIONS = new Set(['row', 'column']);
const ALIGNMENTS = new Set(['start', 'center', 'end', 'stretch']);

let autoState = readAutoState();
let autoHistory = [];
let autoFuture = [];
let activeGroupId = null;
let panelOpen = false;
let applyingLayout = false;
let enhancementFrame = 0;
let lastPageId = '';

const studioRoot = () => document.querySelector('#appRoot');
const workspace = () => document.querySelector('.studio-workspace');
const nodeGrid = () => document.querySelector('.studio-node-grid');
const currentPageId = () => document.querySelector('[data-page-picker]')?.value || 'owner-dashboard';
const selectedNodeElement = () => document.querySelector('.studio-node.is-selected[data-node-id]');
const studioNodes = () => [...document.querySelectorAll('.studio-node[data-node-id]')];
const editableNodes = () => studioNodes().filter((node) => node?.dataset.nodeType !== 'hero-block');
const nodeById = (nodeId) => nodeId ? document.querySelector(`.studio-node[data-node-id="${CSS.escape(nodeId)}"]`) : null;
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
const uid = () => `stack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.checked !== undefined) node.checked = Boolean(options.checked);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.draggable !== undefined) node.draggable = Boolean(options.draggable);
  if (options.title) node.title = String(options.title);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function normalizeGroup(raw, index) {
  const children = Array.isArray(raw?.children)
    ? [...new Set(raw.children.filter((id) => /^[a-z0-9-]{3,120}$/i.test(String(id))).map(String))].slice(0, 40)
    : [];
  return {
    id: /^[a-z0-9-]{3,120}$/i.test(String(raw?.id || '')) ? String(raw.id) : uid(),
    name: String(raw?.name || `Stack ${index + 1}`).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80),
    direction: DIRECTIONS.has(raw?.direction) ? raw.direction : 'row',
    gap: clamp(raw?.gap, 0, 48),
    padding: clamp(raw?.padding, 0, 48),
    align: ALIGNMENTS.has(raw?.align) ? raw.align : 'stretch',
    wrap: raw?.wrap !== false,
    children
  };
}

function normalizeAutoState(raw) {
  const pages = {};
  if (raw?.pages && typeof raw.pages === 'object') {
    Object.entries(raw.pages).slice(0, 30).forEach(([pageId, page]) => {
      const used = new Set();
      const groups = Array.isArray(page?.groups) ? page.groups.slice(0, 30).map(normalizeGroup).map((group) => {
        group.children = group.children.filter((id) => !used.has(id) && used.add(id));
        return group;
      }) : [];
      pages[String(pageId).slice(0, 100)] = { groups };
    });
  }
  return { version: 1, pages };
}

function readAutoState() {
  try { return normalizeAutoState(JSON.parse(localStorage.getItem(AUTO_LAYOUT_KEY) || 'null')); }
  catch { return { version: 1, pages: {} }; }
}

function pageState(pageId = currentPageId()) {
  if (!autoState.pages[pageId]) autoState.pages[pageId] = { groups: [] };
  return autoState.pages[pageId];
}

function persistAutoState() {
  localStorage.setItem(AUTO_LAYOUT_KEY, JSON.stringify(autoState));
}

function setSaveStatus(label = 'Saved') {
  const status = document.querySelector('[data-layout-save-status]');
  if (!status) return;
  status.textContent = label;
  status.dataset.state = label === 'Saved' ? 'saved' : 'saving';
}

function snapshotAutoState() {
  autoHistory.push(clone(autoState));
  if (autoHistory.length > HISTORY_LIMIT) autoHistory.shift();
  autoFuture = [];
}

function mutateAuto(callback) {
  snapshotAutoState();
  callback(pageState());
  autoState = normalizeAutoState(autoState);
  persistAutoState();
  setSaveStatus('Saving...');
  applyAutoLayout();
  renderPanel(true);
  setTimeout(() => setSaveStatus('Saved'), 350);
}

function undoAuto() {
  if (!autoHistory.length) return;
  autoFuture.push(clone(autoState));
  autoState = normalizeAutoState(autoHistory.pop());
  persistAutoState();
  applyAutoLayout();
  renderPanel(true);
}

function redoAuto() {
  if (!autoFuture.length) return;
  autoHistory.push(clone(autoState));
  autoState = normalizeAutoState(autoFuture.pop());
  persistAutoState();
  applyAutoLayout();
  renderPanel(true);
}

function activeGroup() {
  return pageState().groups.find((group) => group.id === activeGroupId) || null;
}

function prunePageState() {
  const ids = new Set(editableNodes().map((node) => node.dataset.nodeId));
  const page = pageState();
  let changed = false;
  page.groups.forEach((group) => {
    const filtered = group.children.filter((id) => ids.has(id));
    if (filtered.length !== group.children.length) changed = true;
    group.children = filtered;
  });
  const groups = page.groups.filter((group) => group.children.length > 0);
  if (groups.length !== page.groups.length) changed = true;
  page.groups = groups;
  if (activeGroupId && !page.groups.some((group) => group.id === activeGroupId)) activeGroupId = null;
  if (changed) persistAutoState();
}

function selectStudioNode(nodeId) {
  nodeById(nodeId)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function clearAppliedLayout() {
  const grid = nodeGrid();
  if (!grid) return;
  const nodes = editableNodes();
  nodes.forEach((node) => {
    node.removeAttribute('data-auto-layout-parent');
    node.style.removeProperty('--auto-span');
    grid.append(node);
  });
  document.querySelectorAll('[data-auto-layout-group]').forEach((frame) => frame.remove());
}

function createCanvasFrame(group) {
  const frame = make('section', {
    className: `studio-auto-layout-frame${group.id === activeGroupId ? ' is-selected' : ''}`,
    dataset: {
      autoLayoutGroup: group.id,
      autoDirection: group.direction,
      autoAlign: group.align,
      autoWrap: String(group.wrap)
    }
  });
  frame.style.setProperty('--auto-gap', `${group.gap}px`);
  frame.style.setProperty('--auto-padding', `${group.padding}px`);
  const header = make('button', {
    className: 'studio-auto-layout-frame-header',
    type: 'button',
    dataset: { autoGroupSelect: group.id },
    attrs: { 'aria-label': `Edit ${group.name}` }
  }, [make('strong', { text: group.name }), make('span', { text: `${group.direction} · ${group.children.length}` })]);
  const items = make('div', { className: 'studio-auto-layout-items', dataset: { autoLayoutItems: group.id } });
  frame.append(header, items);
  return { frame, items };
}

function applyAutoLayout() {
  if (applyingLayout || !nodeGrid()) return;
  applyingLayout = true;
  prunePageState();
  clearAppliedLayout();
  const grid = nodeGrid();
  const page = pageState();

  page.groups.forEach((group) => {
    const children = group.children.map(nodeById).filter(Boolean);
    if (!children.length) return;
    const { frame, items } = createCanvasFrame(group);
    grid.insertBefore(frame, children[0]);
    children.forEach((node) => {
      node.dataset.autoLayoutParent = group.id;
      node.style.setProperty('--auto-span', node.dataset.span || '4');
      items.append(node);
    });
  });

  setTimeout(() => { applyingLayout = false; }, 0);
}

function ungroupedNodeIds() {
  const grouped = new Set(pageState().groups.flatMap((group) => group.children));
  return editableNodes().map((node) => node.dataset.nodeId).filter((id) => !grouped.has(id));
}

function createStack() {
  const selectedId = selectedNodeElement()?.dataset.nodeId;
  const available = ungroupedNodeIds();
  const first = selectedId && available.includes(selectedId) ? selectedId : available[0];
  if (!first) return;
  const next = available.find((id) => id !== first);
  const groupId = uid();
  mutateAuto((page) => {
    page.groups.push({
      id: groupId,
      name: `Stack ${page.groups.length + 1}`,
      direction: 'row',
      gap: 16,
      padding: 16,
      align: 'stretch',
      wrap: true,
      children: [first, next].filter(Boolean)
    });
  });
  activeGroupId = groupId;
  panelOpen = true;
  applyAutoLayout();
  renderPanel(true);
}

function assignNodeToGroup(nodeId, groupId) {
  const node = nodeById(nodeId);
  if (!node || node.dataset.nodeType === 'hero-block') return;
  mutateAuto((page) => {
    page.groups.forEach((group) => { group.children = group.children.filter((id) => id !== nodeId); });
    const target = page.groups.find((group) => group.id === groupId);
    if (target && !target.children.includes(nodeId)) target.children.push(nodeId);
    page.groups = page.groups.filter((group) => group.children.length > 0);
  });
  activeGroupId = groupId;
}

function removeNodeFromGroup(nodeId) {
  mutateAuto((page) => {
    page.groups.forEach((group) => { group.children = group.children.filter((id) => id !== nodeId); });
    page.groups = page.groups.filter((group) => group.children.length > 0);
  });
}

function deleteGroup(groupId) {
  mutateAuto((page) => { page.groups = page.groups.filter((group) => group.id !== groupId); });
  activeGroupId = null;
}

function updateGroup(groupId, field, value) {
  mutateAuto((page) => {
    const group = page.groups.find((item) => item.id === groupId);
    if (!group) return;
    if (field === 'direction') group.direction = DIRECTIONS.has(value) ? value : 'row';
    else if (field === 'align') group.align = ALIGNMENTS.has(value) ? value : 'stretch';
    else if (field === 'gap') group.gap = clamp(value, 0, 48);
    else if (field === 'padding') group.padding = clamp(value, 0, 48);
    else if (field === 'wrap') group.wrap = Boolean(value);
  });
}

function nodeLabel(node) {
  const heading = node?.querySelector('h1, h2, h3, strong, [data-field="title"], [data-field="label"]');
  return heading?.textContent?.trim()?.slice(0, 40) || (node?.dataset.nodeType || 'Component').replaceAll('-', ' ');
}

function nodeRow(nodeId, nested = false) {
  const node = nodeById(nodeId);
  if (!node) return null;
  return make('button', {
    className: `studio-auto-layout-node-row${nested ? ' is-nested' : ''}${node.classList.contains('is-selected') ? ' is-selected' : ''}`,
    type: 'button',
    draggable: true,
    dataset: { autoNode: nodeId }
  }, [
    make('span', { className: 'studio-auto-layout-grip', text: '::', attrs: { 'aria-hidden': 'true' } }),
    make('span', { className: 'studio-auto-layout-node-copy' }, [
      make('strong', { text: nodeLabel(node) }),
      make('small', { text: `${(node.dataset.nodeType || 'component').replaceAll('-', ' ')} · ${node.dataset.span || 4}/12` })
    ])
  ]);
}

function groupTree(group) {
  const section = make('section', { className: `studio-auto-layout-group${group.id === activeGroupId ? ' is-selected' : ''}` });
  const row = make('button', {
    className: 'studio-auto-layout-group-row',
    type: 'button',
    dataset: { autoGroup: group.id }
  }, [
    make('span', { className: 'studio-auto-layout-group-icon', text: group.direction === 'row' ? '↔' : '↕' }),
    make('span', { className: 'studio-auto-layout-node-copy' }, [
      make('strong', { text: group.name }),
      make('small', { text: `${group.direction} · ${group.gap}px gap · ${group.children.length} children` })
    ])
  ]);
  const children = make('div', { className: 'studio-auto-layout-children' });
  group.children.forEach((nodeId) => {
    const rowNode = nodeRow(nodeId, true);
    if (rowNode) children.append(rowNode);
  });
  section.append(row, children);
  return section;
}

function option(value, label, selected) {
  const item = make('option', { value, text: label });
  item.selected = selected;
  return item;
}

function groupControls(group) {
  if (!group) return make('div', { className: 'studio-empty-state', text: 'Choose a stack to edit its direction, spacing, alignment, and wrapping.' });
  const direction = make('div', { className: 'studio-auto-layout-segmented' }, [
    make('button', { type: 'button', className: group.direction === 'row' ? 'is-active' : '', text: 'Horizontal', dataset: { autoSet: 'direction', value: 'row', groupId: group.id } }),
    make('button', { type: 'button', className: group.direction === 'column' ? 'is-active' : '', text: 'Vertical', dataset: { autoSet: 'direction', value: 'column', groupId: group.id } })
  ]);
  const align = make('select', { dataset: { autoField: 'align', groupId: group.id } }, [
    option('start', 'Start', group.align === 'start'),
    option('center', 'Center', group.align === 'center'),
    option('end', 'End', group.align === 'end'),
    option('stretch', 'Stretch', group.align === 'stretch')
  ]);
  const gap = make('input', { type: 'range', value: group.gap, dataset: { autoField: 'gap', groupId: group.id }, attrs: { min: 0, max: 48, step: 4 } });
  const padding = make('input', { type: 'range', value: group.padding, dataset: { autoField: 'padding', groupId: group.id }, attrs: { min: 0, max: 48, step: 4 } });
  const wrap = make('input', { type: 'checkbox', checked: group.wrap, dataset: { autoField: 'wrap', groupId: group.id } });
  const selectedId = selectedNodeElement()?.dataset.nodeId;
  const selectedMember = selectedId && group.children.includes(selectedId);
  return make('div', { className: 'studio-auto-layout-controls' }, [
    make('h3', { text: group.name }),
    direction,
    make('label', { className: 'studio-auto-layout-field' }, [make('span', { text: 'Alignment' }), align]),
    make('label', { className: 'studio-auto-layout-field' }, [make('span', { text: `Gap ${group.gap}px` }), gap]),
    make('label', { className: 'studio-auto-layout-field' }, [make('span', { text: `Padding ${group.padding}px` }), padding]),
    make('label', { className: 'studio-auto-layout-toggle' }, [make('span', { text: 'Wrap on smaller widths' }), wrap]),
    make('div', { className: 'studio-auto-layout-actions' }, [
      make('button', { type: 'button', text: selectedMember ? 'Remove selected' : 'Add selected', disabled: !selectedId, dataset: { autoAction: selectedMember ? 'remove-selected' : 'add-selected', groupId: group.id } }),
      make('button', { type: 'button', text: 'Ungroup', dataset: { autoAction: 'delete-group', groupId: group.id } })
    ])
  ]);
}

function renderPanel(force = false) {
  const mount = workspace();
  const existing = mount?.querySelector('[data-auto-layout-panel]');
  document.querySelector('[data-auto-layout-tool]')?.classList.toggle('is-active', panelOpen);
  if (!panelOpen || !mount) {
    existing?.remove();
    return;
  }
  if (existing && !force) return;
  applyingLayout = true;
  existing?.remove();
  const panel = make('aside', { className: 'studio-sheet studio-auto-layout-panel', dataset: { autoLayoutPanel: 'true' } });
  const header = make('div', { className: 'studio-sheet-header' }, [
    make('div', {}, [make('h2', { text: 'Auto Layout' }), make('p', { text: 'Build responsive horizontal and vertical stacks.' })]),
    make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { autoAction: 'close' }, attrs: { 'aria-label': 'Close Auto Layout' } })
  ]);
  const toolbar = make('div', { className: 'studio-auto-layout-toolbar' }, [
    make('button', { type: 'button', text: 'Create stack', dataset: { autoAction: 'create' } }),
    make('button', { type: 'button', text: 'Undo', disabled: !autoHistory.length, dataset: { autoAction: 'undo' } }),
    make('button', { type: 'button', text: 'Redo', disabled: !autoFuture.length, dataset: { autoAction: 'redo' } })
  ]);
  const tree = make('div', { className: 'studio-auto-layout-tree' });
  pageState().groups.forEach((group) => tree.append(groupTree(group)));
  const ungrouped = make('section', { className: 'studio-auto-layout-ungrouped', dataset: { autoUngrouped: 'true' } }, [make('strong', { text: 'Ungrouped' })]);
  ungroupedNodeIds().forEach((nodeId) => {
    const row = nodeRow(nodeId);
    if (row) ungrouped.append(row);
  });
  tree.append(ungrouped);
  panel.append(header, toolbar, tree, groupControls(activeGroup()));
  mount.append(panel);
  setTimeout(() => { applyingLayout = false; }, 0);
}

function injectTool() {
  const dock = document.querySelector('.studio-dock');
  if (!dock || dock.querySelector('[data-auto-layout-tool]')) return;
  dock.append(make('button', {
    className: `studio-dock-button${panelOpen ? ' is-active' : ''}`,
    type: 'button',
    dataset: { autoLayoutTool: 'true' },
    title: 'Auto Layout',
    attrs: { 'aria-label': 'Open Auto Layout' }
  }, [make('span', { text: 'A' }), make('small', { text: 'Layout' })]));
}

function enhance() {
  if (!document.querySelector('[data-visual-studio]')) return;
  const pageId = currentPageId();
  if (pageId !== lastPageId) {
    lastPageId = pageId;
    activeGroupId = null;
  }
  injectTool();
  applyAutoLayout();
  if (panelOpen && !workspace()?.querySelector('[data-auto-layout-panel]')) renderPanel(true);
}

function scheduleEnhance() {
  if (applyingLayout) return;
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = requestAnimationFrame(enhance);
}

function openPanel() {
  const activeNative = document.querySelector('.studio-dock-button.is-active[data-sheet]');
  activeNative?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const layers = document.querySelector('[data-layout-tool="layers"].is-active');
  layers?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  panelOpen = true;
  renderPanel(true);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet], [data-layout-tool="layers"]') && panelOpen) {
      panelOpen = false;
      renderPanel(true);
    }
    if (event.target.closest('[data-auto-layout-tool]')) {
      event.preventDefault();
      panelOpen ? (panelOpen = false, renderPanel(true)) : openPanel();
      return;
    }
    const selectGroup = event.target.closest('[data-auto-group-select], [data-auto-group]');
    if (selectGroup) {
      event.preventDefault();
      activeGroupId = selectGroup.dataset.autoGroupSelect || selectGroup.dataset.autoGroup;
      panelOpen = true;
      renderPanel(true);
      applyAutoLayout();
      return;
    }
    const nodeRow = event.target.closest('[data-auto-node]');
    if (nodeRow) {
      event.preventDefault();
      selectStudioNode(nodeRow.dataset.autoNode);
      return;
    }
    const set = event.target.closest('[data-auto-set]');
    if (set) {
      event.preventDefault();
      updateGroup(set.dataset.groupId, set.dataset.autoSet, set.dataset.value);
      return;
    }
    const action = event.target.closest('[data-auto-action]');
    if (!action) return;
    event.preventDefault();
    const groupId = action.dataset.groupId;
    if (action.dataset.autoAction === 'close') { panelOpen = false; renderPanel(true); }
    else if (action.dataset.autoAction === 'create') createStack();
    else if (action.dataset.autoAction === 'undo') undoAuto();
    else if (action.dataset.autoAction === 'redo') redoAuto();
    else if (action.dataset.autoAction === 'delete-group') deleteGroup(groupId);
    else if (action.dataset.autoAction === 'add-selected') {
      const nodeId = selectedNodeElement()?.dataset.nodeId;
      if (nodeId) assignNodeToGroup(nodeId, groupId);
    } else if (action.dataset.autoAction === 'remove-selected') {
      const nodeId = selectedNodeElement()?.dataset.nodeId;
      if (nodeId) removeNodeFromGroup(nodeId);
    }
  }, true);

  document.addEventListener('change', (event) => {
    const control = event.target.closest('[data-auto-field]');
    if (!control) return;
    const value = control.dataset.autoField === 'wrap' ? control.checked : control.value;
    updateGroup(control.dataset.groupId, control.dataset.autoField, value);
  });

  document.addEventListener('input', (event) => {
    const control = event.target.closest('[data-auto-field="gap"], [data-auto-field="padding"]');
    if (!control) return;
    const group = pageState().groups.find((item) => item.id === control.dataset.groupId);
    if (!group) return;
    group[control.dataset.autoField] = clamp(control.value, 0, 48);
    persistAutoState();
    applyAutoLayout();
  });

  document.addEventListener('dragover', (event) => {
    const groupTarget = event.target.closest('[data-auto-group], [data-auto-layout-group]');
    const ungroupedTarget = event.target.closest('[data-auto-ungrouped]');
    const nodeId = event.dataTransfer?.getData('text/x-evara-studio-node');
    if (!nodeId || (!groupTarget && !ungroupedTarget)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    (groupTarget || ungroupedTarget).classList.add('is-auto-drop-target');
  });

  document.addEventListener('dragleave', (event) => {
    event.target.closest('.is-auto-drop-target')?.classList.remove('is-auto-drop-target');
  });

  document.addEventListener('drop', (event) => {
    const groupTarget = event.target.closest('[data-auto-group], [data-auto-layout-group]');
    const ungroupedTarget = event.target.closest('[data-auto-ungrouped]');
    const nodeId = event.dataTransfer?.getData('text/x-evara-studio-node');
    document.querySelectorAll('.is-auto-drop-target').forEach((item) => item.classList.remove('is-auto-drop-target'));
    if (!nodeId || (!groupTarget && !ungroupedTarget)) return;
    event.preventDefault();
    if (ungroupedTarget) removeNodeFromGroup(nodeId);
    else assignNodeToGroup(nodeId, groupTarget.dataset.autoGroup || groupTarget.dataset.autoLayoutGroup);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      panelOpen ? (panelOpen = false, renderPanel(true)) : openPanel();
    }
  });
}

function boot() {
  const root = studioRoot();
  if (!root) return;
  bindEvents();
  new MutationObserver(scheduleEnhance).observe(root, { childList: true, subtree: true });
  scheduleEnhance();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
