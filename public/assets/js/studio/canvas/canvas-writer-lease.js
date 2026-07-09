function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clean(value, fallback = 'graph') {
  return String(value || fallback).replace(/[^a-z0-9:._-]+/gi, '-').slice(0, 180) || fallback;
}

export class CanvasWriterLease {
  #graphId;
  #instanceId = randomId();
  #state = 'acquiring';
  #method = 'none';
  #listeners = new Set();
  #releaseLock = null;
  #lockRetryTimer = 0;
  #channel = null;
  #heartbeatTimer = 0;
  #electionTimer = 0;
  #peers = new Map();
  #released = false;

  constructor(graphId) {
    this.#graphId = clean(graphId);
    addEventListener('pagehide', () => this.release(), { once: true });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Canvas writer-lease subscribers must be functions.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  snapshot() {
    return {
      graphId: this.#graphId,
      instanceId: this.#instanceId,
      state: this.#state,
      method: this.#method,
      canWrite: this.#state === 'writer'
    };
  }

  #emit(reason) {
    const snapshot = this.snapshot();
    this.#listeners.forEach((listener) => listener(snapshot, { reason }));
    dispatchEvent(new CustomEvent('evara:canvas-writer-lease', { detail: { ...snapshot, reason } }));
  }

  #setState(state, reason) {
    if (this.#state === state) return;
    this.#state = state;
    this.#emit(reason);
  }

  async acquire() {
    if (this.#released) throw new Error('Released Canvas writer leases cannot be reacquired.');
    if (navigator.locks?.request) {
      this.#method = 'web-locks';
      await this.#tryWebLock();
      return this.snapshot();
    }
    this.#method = 'broadcast-election';
    this.#startBroadcastElection();
    await new Promise((resolve) => setTimeout(resolve, 380));
    return this.snapshot();
  }

  async #tryWebLock() {
    if (this.#released || this.#releaseLock) return;
    const name = `evaraos:canvas-writer:${this.#graphId}`;
    let resolved;
    const acquired = new Promise((resolve) => { resolved = resolve; });
    navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock || this.#released) {
        this.#setState('read-only', 'writer-held-in-another-tab');
        resolved();
        return;
      }
      let release;
      const hold = new Promise((resolve) => { release = resolve; });
      this.#releaseLock = release;
      this.#setState('writer', 'writer-lock-acquired');
      resolved();
      await hold;
      this.#releaseLock = null;
    }).catch((error) => {
      this.#setState('read-only', `writer-lock-error:${String(error?.message || error).slice(0, 80)}`);
      resolved();
    });
    await acquired;
    if (this.#state !== 'writer' && !this.#released) {
      clearTimeout(this.#lockRetryTimer);
      this.#lockRetryTimer = setTimeout(() => this.#tryWebLock(), 1200);
    }
  }

  #startBroadcastElection() {
    if (this.#channel || this.#released) return;
    this.#channel = new BroadcastChannel(`evaraos:canvas-writer:${this.#graphId}`);
    this.#peers.set(this.#instanceId, Date.now());
    this.#channel.addEventListener('message', (event) => {
      const message = event.data || {};
      if (message.graphId !== this.#graphId || !message.instanceId) return;
      if (message.type === 'release') this.#peers.delete(message.instanceId);
      else this.#peers.set(message.instanceId, Date.now());
      if (message.type === 'hello') this.#post('heartbeat');
      this.#elect();
    });
    this.#post('hello');
    this.#heartbeatTimer = setInterval(() => {
      const cutoff = Date.now() - 3500;
      for (const [id, timestamp] of this.#peers) if (timestamp < cutoff) this.#peers.delete(id);
      this.#peers.set(this.#instanceId, Date.now());
      this.#post('heartbeat');
      this.#elect();
    }, 1000);
    this.#electionTimer = setTimeout(() => this.#elect(), 320);
    this.#setState('read-only', 'writer-election-pending');
  }

  #post(type) {
    this.#channel?.postMessage({ type, graphId: this.#graphId, instanceId: this.#instanceId, timestamp: Date.now() });
  }

  #elect() {
    if (this.#released) return;
    const candidates = [...this.#peers.keys(), this.#instanceId].sort();
    this.#setState(candidates[0] === this.#instanceId ? 'writer' : 'read-only', candidates[0] === this.#instanceId ? 'writer-elected' : 'writer-elected-elsewhere');
  }

  release() {
    if (this.#released) return;
    this.#released = true;
    clearTimeout(this.#lockRetryTimer);
    clearTimeout(this.#electionTimer);
    clearInterval(this.#heartbeatTimer);
    this.#post('release');
    this.#channel?.close();
    this.#channel = null;
    this.#releaseLock?.();
    this.#releaseLock = null;
    this.#setState('released', 'writer-lease-released');
  }
}

export const CanvasWriterLeaseController = Object.freeze({
  create: (graphId) => new CanvasWriterLease(graphId)
});
