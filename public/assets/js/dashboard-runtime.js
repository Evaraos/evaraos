const runtimeRegistry = new Map();
const cleanupRegistry = new Map();
const subscriptionRegistry = new Map();

let runtimeCounter = 0;

function runtimeId() {
  runtimeCounter += 1;
  return `runtime_${Date.now()}_${runtimeCounter}`;
}

function now() {
  return Date.now();
}

function normalizeName(value = '') {
  return String(value || 'dashboard-runtime').trim();
}

function safeCall(fn, context = 'runtime') {
  try {
    return typeof fn === 'function' ? fn() : null;
  } catch (error) {
    console.error(`[EvaraRuntime:${context}]`, error);
    return null;
  }
}

export function createDashboardRuntime(config = {}) {
  const id = config.id || runtimeId();

  const runtime = {
    id,
    name: normalizeName(config.name),
    createdAtMs: now(),
    startedAtMs: null,
    stoppedAtMs: null,
    status: 'idle',
    bootSteps: [],
    metadata: config.metadata || {}
  };

  runtimeRegistry.set(id, runtime);
  cleanupRegistry.set(id, []);
  subscriptionRegistry.set(id, []);

  return runtime;
}

export function registerRuntimeCleanup(runtimeIdValue, cleanup) {
  if (typeof cleanup !== 'function') return false;

  const rows = cleanupRegistry.get(runtimeIdValue) || [];
  rows.push(cleanup);
  cleanupRegistry.set(runtimeIdValue, rows);
  return true;
}

export function registerRuntimeSubscription(runtimeIdValue, unsubscribe) {
  if (typeof unsubscribe !== 'function') return false;

  const rows = subscriptionRegistry.get(runtimeIdValue) || [];
  rows.push(unsubscribe);
  subscriptionRegistry.set(runtimeIdValue, rows);
  return true;
}

export async function startDashboardRuntime(runtimeIdValue, bootSteps = []) {
  const runtime = runtimeRegistry.get(runtimeIdValue);
  if (!runtime) throw new Error('Dashboard runtime not found.');

  runtime.status = 'starting';
  runtime.startedAtMs = now();
  runtime.bootSteps = [];

  for (const step of bootSteps) {
    const label = normalizeName(step?.label || 'runtime-step');
    const startedAtMs = now();

    try {
      const result = await step.run?.();

      runtime.bootSteps.push({
        label,
        status: 'success',
        startedAtMs,
        completedAtMs: now()
      });

      if (typeof result === 'function') {
        registerRuntimeCleanup(runtimeIdValue, result);
      }
    } catch (error) {
      runtime.bootSteps.push({
        label,
        status: 'failed',
        startedAtMs,
        completedAtMs: now(),
        error: error?.message || String(error)
      });

      runtime.status = 'failed';
      console.error(`[EvaraRuntime:${label}]`, error);
      throw error;
    }
  }

  runtime.status = 'running';
  return runtime;
}

export function stopDashboardRuntime(runtimeIdValue) {
  const runtime = runtimeRegistry.get(runtimeIdValue);
  if (!runtime) return false;

  runtime.status = 'stopping';

  const subscriptions = subscriptionRegistry.get(runtimeIdValue) || [];
  subscriptions.forEach((unsubscribe) => safeCall(unsubscribe, 'unsubscribe'));
  subscriptionRegistry.set(runtimeIdValue, []);

  const cleanups = cleanupRegistry.get(runtimeIdValue) || [];
  [...cleanups].reverse().forEach((cleanup) => safeCall(cleanup, 'cleanup'));
  cleanupRegistry.set(runtimeIdValue, []);

  runtime.status = 'stopped';
  runtime.stoppedAtMs = now();

  return true;
}

export function destroyDashboardRuntime(runtimeIdValue) {
  stopDashboardRuntime(runtimeIdValue);
  runtimeRegistry.delete(runtimeIdValue);
  cleanupRegistry.delete(runtimeIdValue);
  subscriptionRegistry.delete(runtimeIdValue);
  return true;
}

export function getDashboardRuntime(runtimeIdValue) {
  return runtimeRegistry.get(runtimeIdValue) || null;
}

export function getDashboardRuntimes() {
  return [...runtimeRegistry.values()].sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

window.EvaraDashboardRuntime = {
  createDashboardRuntime,
  registerRuntimeCleanup,
  registerRuntimeSubscription,
  startDashboardRuntime,
  stopDashboardRuntime,
  destroyDashboardRuntime,
  getDashboardRuntime,
  getDashboardRuntimes
};
