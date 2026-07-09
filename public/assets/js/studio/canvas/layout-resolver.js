export const CANVAS_LAYOUT_MODES = Object.freeze(['flow', 'grid', 'spatial']);

const MODE_SET = new Set(CANVAS_LAYOUT_MODES);

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max, fallback = min) {
  return Math.min(max, Math.max(min, finite(value, fallback)));
}

function normalizeBox(value, fallback = 0) {
  if (typeof value === 'number') {
    const safe = Math.max(0, value);
    return { top: safe, right: safe, bottom: safe, left: safe };
  }
  return {
    top: Math.max(0, finite(value?.top, fallback)),
    right: Math.max(0, finite(value?.right, fallback)),
    bottom: Math.max(0, finite(value?.bottom, fallback)),
    left: Math.max(0, finite(value?.left, fallback))
  };
}

function normalizeChildren(children = []) {
  return [...children].sort((left, right) => {
    const leftOrder = finite(left?.layout?.order, 0);
    const rightOrder = finite(right?.layout?.order, 0);
    return leftOrder - rightOrder || String(left?.id || '').localeCompare(String(right?.id || ''));
  });
}

function alignOffset(align, available, size) {
  if (align === 'center') return Math.max(0, (available - size) / 2);
  if (align === 'end') return Math.max(0, available - size);
  return 0;
}

export function resolveGridLayout(container, children, context = {}) {
  const layout = container?.layout || {};
  const columns = Math.round(clamp(layout.columns, 1, 24, 12));
  const gap = Math.max(0, finite(layout.gap, 20));
  const padding = normalizeBox(layout.padding, 24);
  const width = Math.max(240, finite(context.viewportWidth, layout.width || 1180));
  const innerWidth = Math.max(1, width - padding.left - padding.right);
  const columnWidth = Math.max(1, (innerWidth - gap * (columns - 1)) / columns);
  const ordered = normalizeChildren(children);
  const items = [];
  let column = 0;
  let cursorY = padding.top;
  let rowHeight = 0;
  let row = 0;

  ordered.forEach((child) => {
    const span = Math.round(clamp(child?.layout?.span, 1, columns, columns));
    if (column > 0 && column + span > columns) {
      cursorY += rowHeight + gap;
      column = 0;
      row += 1;
      rowHeight = 0;
    }
    const itemWidth = columnWidth * span + gap * Math.max(0, span - 1);
    const itemHeight = Math.max(finite(child?.layout?.minHeight, 60), finite(child?.layout?.height, 160));
    items.push({
      nodeId: child.id,
      mode: 'grid',
      x: padding.left + column * (columnWidth + gap),
      y: cursorY,
      width: itemWidth,
      height: itemHeight,
      row,
      column,
      span
    });
    column += span;
    rowHeight = Math.max(rowHeight, itemHeight);
    if (column >= columns) {
      cursorY += rowHeight + gap;
      column = 0;
      row += 1;
      rowHeight = 0;
    }
  });

  const occupiedHeight = items.length ? Math.max(...items.map((item) => item.y + item.height)) : padding.top;
  return {
    mode: 'grid',
    width,
    height: occupiedHeight + padding.bottom,
    columns,
    gap,
    padding,
    items,
    guides: Array.from({ length: columns + 1 }, (_, index) => padding.left + index * (columnWidth + gap) - (index === columns ? gap : 0))
  };
}

export function resolveFlowLayout(container, children, context = {}) {
  const layout = container?.layout || {};
  const direction = layout.direction === 'row' ? 'row' : 'column';
  const wrap = layout.wrap !== false;
  const gap = Math.max(0, finite(layout.gap, 16));
  const padding = normalizeBox(layout.padding, 24);
  const align = ['start', 'center', 'end', 'stretch'].includes(layout.align) ? layout.align : 'stretch';
  const width = Math.max(240, finite(context.viewportWidth, layout.width || 1180));
  const innerWidth = Math.max(1, width - padding.left - padding.right);
  const ordered = normalizeChildren(children);
  const items = [];

  if (direction === 'column') {
    let cursorY = padding.top;
    ordered.forEach((child, index) => {
      const requestedWidth = Math.max(finite(child?.layout?.minWidth, 80), finite(child?.layout?.width, innerWidth));
      const itemWidth = align === 'stretch' ? innerWidth : Math.min(innerWidth, requestedWidth);
      const itemHeight = Math.max(finite(child?.layout?.minHeight, 60), finite(child?.layout?.height, 160));
      items.push({
        nodeId: child.id,
        mode: 'flow',
        x: padding.left + alignOffset(align, innerWidth, itemWidth),
        y: cursorY,
        width: itemWidth,
        height: itemHeight,
        line: index,
        index
      });
      cursorY += itemHeight + gap;
    });
    const height = (items.at(-1)?.y || padding.top) + (items.at(-1)?.height || 0) + padding.bottom;
    return { mode: 'flow', direction, wrap, align, width, height, gap, padding, items, guides: items.map((item) => item.y) };
  }

  let cursorX = padding.left;
  let cursorY = padding.top;
  let lineHeight = 0;
  let line = 0;
  ordered.forEach((child, index) => {
    const itemWidth = Math.min(innerWidth, Math.max(finite(child?.layout?.minWidth, 80), finite(child?.layout?.width, 260)));
    const itemHeight = Math.max(finite(child?.layout?.minHeight, 60), finite(child?.layout?.height, 160));
    if (wrap && cursorX > padding.left && cursorX + itemWidth > padding.left + innerWidth) {
      cursorX = padding.left;
      cursorY += lineHeight + gap;
      lineHeight = 0;
      line += 1;
    }
    items.push({ nodeId: child.id, mode: 'flow', x: cursorX, y: cursorY, width: itemWidth, height: itemHeight, line, index });
    cursorX += itemWidth + gap;
    lineHeight = Math.max(lineHeight, itemHeight);
  });
  const occupiedHeight = items.length ? Math.max(...items.map((item) => item.y + item.height)) : padding.top;
  return { mode: 'flow', direction, wrap, align, width, height: occupiedHeight + padding.bottom, gap, padding, items, guides: [...new Set(items.map((item) => item.y))] };
}

export function resolveSpatialLayout(container, children, context = {}) {
  const layout = container?.layout || {};
  const padding = normalizeBox(layout.padding, 0);
  const width = Math.max(240, finite(context.viewportWidth, layout.width || 1180));
  const ordered = normalizeChildren(children);
  const items = ordered.map((child, index) => {
    const childLayout = child?.layout || {};
    const itemWidth = Math.max(finite(childLayout.minWidth, 80), finite(childLayout.width, 260));
    const itemHeight = Math.max(finite(childLayout.minHeight, 60), finite(childLayout.height, 160));
    return {
      nodeId: child.id,
      mode: 'spatial',
      x: padding.left + finite(childLayout.x, (index % 3) * 280),
      y: padding.top + finite(childLayout.y, Math.floor(index / 3) * 190),
      width: itemWidth,
      height: itemHeight,
      zIndex: Math.round(finite(childLayout.zIndex, index))
    };
  });
  const occupiedHeight = items.length ? Math.max(...items.map((item) => item.y + item.height)) : padding.top;
  return {
    mode: 'spatial',
    width,
    height: Math.max(finite(layout.height, 0), occupiedHeight + padding.bottom),
    padding,
    items,
    guides: {
      vertical: items.flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width]),
      horizontal: items.flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height])
    }
  };
}

export function resolveCanvasLayout(container, children, context = {}) {
  const mode = MODE_SET.has(container?.layout?.mode) ? container.layout.mode : 'flow';
  if (mode === 'grid') return resolveGridLayout(container, children, context);
  if (mode === 'spatial') return resolveSpatialLayout(container, children, context);
  return resolveFlowLayout(container, children, context);
}

function nearest(value, candidates, threshold) {
  let best = null;
  let distance = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate) => {
    const current = Math.abs(value - candidate);
    if (current < distance && current <= threshold) {
      distance = current;
      best = candidate;
    }
  });
  return best;
}

export function resolveCanvasSnap({
  mode = 'grid',
  rect,
  parentRect,
  siblingRects = [],
  gridSize = 8,
  threshold = 6,
  breakpoints = [390, 820, 1180]
} = {}) {
  const source = {
    x: finite(rect?.x, 0),
    y: finite(rect?.y, 0),
    width: Math.max(1, finite(rect?.width, 1)),
    height: Math.max(1, finite(rect?.height, 1))
  };
  const candidatesX = [];
  const candidatesY = [];
  if (parentRect) {
    candidatesX.push(parentRect.x, parentRect.x + parentRect.width / 2, parentRect.x + parentRect.width);
    candidatesY.push(parentRect.y, parentRect.y + parentRect.height / 2, parentRect.y + parentRect.height);
  }
  siblingRects.forEach((sibling) => {
    candidatesX.push(sibling.x, sibling.x + sibling.width / 2, sibling.x + sibling.width);
    candidatesY.push(sibling.y, sibling.y + sibling.height / 2, sibling.y + sibling.height);
  });

  const snapped = { ...source };
  const guides = [];
  const grid = Math.max(1, finite(gridSize, 8));
  const gridX = Math.round(source.x / grid) * grid;
  const gridY = Math.round(source.y / grid) * grid;
  if (Math.abs(gridX - source.x) <= threshold) { snapped.x = gridX; guides.push({ axis: 'x', value: gridX, kind: 'grid' }); }
  if (Math.abs(gridY - source.y) <= threshold) { snapped.y = gridY; guides.push({ axis: 'y', value: gridY, kind: 'grid' }); }

  const edgeX = nearest(source.x, candidatesX, threshold);
  const edgeY = nearest(source.y, candidatesY, threshold);
  if (edgeX !== null) { snapped.x = edgeX; guides.push({ axis: 'x', value: edgeX, kind: 'edge' }); }
  if (edgeY !== null) { snapped.y = edgeY; guides.push({ axis: 'y', value: edgeY, kind: 'baseline' }); }

  const breakpoint = nearest(source.width, breakpoints, threshold * 2);
  if (breakpoint !== null) { snapped.width = breakpoint; guides.push({ axis: 'x', value: breakpoint, kind: 'breakpoint' }); }
  return { mode, rect: snapped, guides };
}

export const LayoutResolver = Object.freeze({
  modes: CANVAS_LAYOUT_MODES,
  resolve: resolveCanvasLayout,
  flow: resolveFlowLayout,
  grid: resolveGridLayout,
  spatial: resolveSpatialLayout
});

export const SnapResolver = Object.freeze({
  resolve: resolveCanvasSnap
});
