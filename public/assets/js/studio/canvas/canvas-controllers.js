const DEVICE_WIDTHS = Object.freeze({ desktop: 1180, tablet: 820, mobile: 390, custom: 960 });

function clone(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

class SubscribableController {
  #listeners = new Set();

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Canvas controller subscribers must be functions.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(snapshot) {
    this.#listeners.forEach((listener) => listener(clone(snapshot)));
  }
}

export class SelectionController extends SubscribableController {
  #selected = new Set();
  #hovered = null;
  #focused = null;
  #marquee = null;

  snapshot() {
    return {
      selectedIds: [...this.#selected],
      hoveredId: this.#hovered,
      focusedId: this.#focused,
      marquee: this.#marquee ? clone(this.#marquee) : null
    };
  }

  replace(ids = []) {
    this.#selected = new Set(ids.filter(Boolean));
    this.emit(this.snapshot());
    return this.snapshot();
  }

  select(id, { additive = false, toggle = false } = {}) {
    if (!additive) this.#selected.clear();
    if (toggle && this.#selected.has(id)) this.#selected.delete(id);
    else if (id) this.#selected.add(id);
    this.#focused = id || null;
    this.emit(this.snapshot());
    return this.snapshot();
  }

  clear() {
    this.#selected.clear();
    this.#focused = null;
    this.emit(this.snapshot());
  }

  setHovered(id = null) {
    if (this.#hovered === id) return this.snapshot();
    this.#hovered = id || null;
    this.emit(this.snapshot());
    return this.snapshot();
  }

  setFocused(id = null) {
    this.#focused = id || null;
    this.emit(this.snapshot());
    return this.snapshot();
  }

  setMarquee(rect = null) {
    this.#marquee = rect ? clone(rect) : null;
    this.emit(this.snapshot());
    return this.snapshot();
  }

  prune(validIds = []) {
    const allowed = new Set(validIds);
    const next = [...this.#selected].filter((id) => allowed.has(id));
    const changed = next.length !== this.#selected.size;
    this.#selected = new Set(next);
    if (this.#hovered && !allowed.has(this.#hovered)) this.#hovered = null;
    if (this.#focused && !allowed.has(this.#focused)) this.#focused = null;
    if (changed) this.emit(this.snapshot());
    return this.snapshot();
  }
}

export class InteractionController extends SubscribableController {
  #gesture = null;

  begin(type, payload = {}) {
    if (this.#gesture) throw new Error(`Canvas gesture ${this.#gesture.type} is already active.`);
    this.#gesture = {
      type: String(type || 'unknown'),
      startedAt: performance.now(),
      start: clone(payload),
      current: clone(payload),
      samples: 1
    };
    this.emit(this.snapshot());
    return this.snapshot();
  }

  update(payload = {}) {
    if (!this.#gesture) return null;
    this.#gesture.current = clone(payload);
    this.#gesture.samples += 1;
    this.emit(this.snapshot());
    return this.snapshot();
  }

  complete(commandFactory) {
    if (!this.#gesture) return null;
    const completed = {
      ...clone(this.#gesture),
      completedAt: performance.now()
    };
    this.#gesture = null;
    this.emit(this.snapshot());
    return typeof commandFactory === 'function' ? commandFactory(completed) : completed;
  }

  cancel() {
    const previous = this.#gesture ? clone(this.#gesture) : null;
    this.#gesture = null;
    this.emit(this.snapshot());
    return previous;
  }

  snapshot() {
    return { gesture: this.#gesture ? clone(this.#gesture) : null };
  }
}

export class ViewportController extends SubscribableController {
  #state;

  constructor(initial = {}) {
    super();
    const device = Object.hasOwn(DEVICE_WIDTHS, initial.device) ? initial.device : 'desktop';
    this.#state = {
      device,
      width: Math.max(240, finite(initial.width, DEVICE_WIDTHS[device])),
      height: Math.max(240, finite(initial.height, 900)),
      zoom: Math.min(8, Math.max(0.1, finite(initial.zoom, 0.78))),
      panX: finite(initial.panX, 0),
      panY: finite(initial.panY, 0)
    };
  }

  snapshot() {
    return clone(this.#state);
  }

  setDevice(device) {
    const next = Object.hasOwn(DEVICE_WIDTHS, device) ? device : 'desktop';
    this.#state.device = next;
    if (next !== 'custom') this.#state.width = DEVICE_WIDTHS[next];
    this.emit(this.snapshot());
    return this.snapshot();
  }

  setZoom(value) {
    this.#state.zoom = Math.min(8, Math.max(0.1, finite(value, this.#state.zoom)));
    this.emit(this.snapshot());
    return this.snapshot();
  }

  zoomBy(delta) {
    return this.setZoom(this.#state.zoom + finite(delta, 0));
  }

  setPan(x, y) {
    this.#state.panX = finite(x, this.#state.panX);
    this.#state.panY = finite(y, this.#state.panY);
    this.emit(this.snapshot());
    return this.snapshot();
  }

  panBy(deltaX, deltaY) {
    return this.setPan(this.#state.panX + finite(deltaX, 0), this.#state.panY + finite(deltaY, 0));
  }

  setFrame({ width, height } = {}) {
    this.#state.device = 'custom';
    this.#state.width = Math.max(240, finite(width, this.#state.width));
    this.#state.height = Math.max(240, finite(height, this.#state.height));
    this.emit(this.snapshot());
    return this.snapshot();
  }

  reset() {
    const width = DEVICE_WIDTHS[this.#state.device] || DEVICE_WIDTHS.desktop;
    this.#state = { ...this.#state, width, zoom: 0.78, panX: 0, panY: 0 };
    this.emit(this.snapshot());
    return this.snapshot();
  }
}

export const CanvasControllers = Object.freeze({
  SelectionController,
  InteractionController,
  ViewportController,
  deviceWidths: DEVICE_WIDTHS
});
