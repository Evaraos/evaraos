const cleanups = new Set();
const initKeys = new Set();

export function oncePerPage(key, callback) {
  if (!key || initKeys.has(key)) return false;
  initKeys.add(key);

  if (typeof callback === 'function') callback();
  return true;
}

export function registerCleanup(callback) {
  if (typeof callback !== 'function') return () => {};

  cleanups.add(callback);

  return () => {
    cleanups.delete(callback);
  };
}

export function runPageCleanups() {
  cleanups.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.warn('Page cleanup skipped:', error);
    }
  });

  cleanups.clear();
}

window.EvaraPageLifecycle = {
  oncePerPage,
  registerCleanup,
  runPageCleanups
};

window.addEventListener('pagehide', runPageCleanups);
window.addEventListener('beforeunload', runPageCleanups);
