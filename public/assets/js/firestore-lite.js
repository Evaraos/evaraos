import { collection, query, limit, onSnapshot, getDocs } from './firebase.js';
import { registerCleanup } from './page-lifecycle.js';

export const DEFAULT_LIMIT = 50;
export const DASHBOARD_LIMIT = 100;

export function limitedCollection(db, collectionName, max = DEFAULT_LIMIT) {
  return query(collection(db, collectionName), limit(max));
}

export function listenLimitedCollection(db, collectionName, callback, options = {}) {
  const max = Number(options.limit || DEFAULT_LIMIT);
  const ref = limitedCollection(db, collectionName, max);

  const unsubscribe = onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    callback(rows, snapshot);
  }, (error) => {
    if (typeof options.onError === 'function') options.onError(error);
    else console.warn(collectionName + ' listener failed:', error);
  });

  registerCleanup(unsubscribe);
  return unsubscribe;
}

export async function getLimitedCollection(db, collectionName, options = {}) {
  const max = Number(options.limit || DEFAULT_LIMIT);
  const ref = limitedCollection(db, collectionName, max);
  const snapshot = await getDocs(ref);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

export function scheduleRender(callback) {
  let raf = null;

  return (...args) => {
    if (raf) cancelAnimationFrame(raf);

    raf = requestAnimationFrame(() => {
      raf = null;
      callback(...args);
    });
  };
}

export function safeText(value) {
  return String(value || '').replace(/[<>]/g, '');
}
