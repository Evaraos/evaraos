import {
  HOME_DRAFT_PAGE_ID,
  HOME_DRAFT_SCHEMA_VERSION,
  HOME_DRAFT_SOURCE_FINGERPRINT,
  HOME_TEXT_DRAFT_SLOT_IDS,
  isValidHomeDraftText
} from './studio-home-draft-contract.js';

const DATABASE_NAME = 'evaraos-studio-page-drafts';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
let databasePromise = null;

function draftKey(ownerUid) {
  const uid = String(ownerUid || '').trim();
  if (!uid) throw new Error('A verified owner UID is required for a Home draft.');
  return `home::${uid}`;
}

function randomDraftId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local Home draft storage.'));
    request.onblocked = () => reject(new Error('Local Home draft storage is blocked.'));
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local Home draft storage request failed.'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Local Home draft storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Local Home draft storage transaction was aborted.'));
  });
}

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validDraftId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9-]{16,128}$/.test(value);
}

export function validateHomeDraft(record, ownerUid) {
  const expectedUid = String(ownerUid || '').trim();
  if (!record || typeof record !== 'object' || !expectedUid) return null;
  if (record.key !== draftKey(expectedUid)
    || record.schemaVersion !== HOME_DRAFT_SCHEMA_VERSION
    || record.sourceFingerprint !== HOME_DRAFT_SOURCE_FINGERPRINT
    || record.ownerUid !== expectedUid
    || record.pageId !== HOME_DRAFT_PAGE_ID
    || !validDraftId(record.draftId)
    || !Number.isSafeInteger(record.revision)
    || record.revision < 1
    || !validTimestamp(record.createdAtMs)
    || !validTimestamp(record.updatedAtMs)
    || record.updatedAtMs < record.createdAtMs
    || !record.slots
    || typeof record.slots !== 'object'
    || Array.isArray(record.slots)) return null;

  const entries = Object.entries(record.slots);
  if (!entries.length || entries.some(([editId, slot]) => !HOME_TEXT_DRAFT_SLOT_IDS.includes(editId)
    || !slot
    || typeof slot !== 'object'
    || !isValidHomeDraftText(editId, slot.value)
    || !validTimestamp(slot.updatedAtMs)
    || slot.updatedAtMs > record.updatedAtMs)) return null;

  return Object.freeze({
    key: record.key,
    schemaVersion: record.schemaVersion,
    sourceFingerprint: record.sourceFingerprint,
    ownerUid: record.ownerUid,
    pageId: record.pageId,
    draftId: record.draftId,
    revision: record.revision,
    createdAtMs: record.createdAtMs,
    updatedAtMs: record.updatedAtMs,
    slots: Object.freeze(Object.fromEntries(entries.map(([editId, slot]) => [editId, Object.freeze({ value: slot.value, updatedAtMs: slot.updatedAtMs })])))
  });
}

function cleanSlotSnapshot(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) throw new Error('Home draft slots are invalid.');
  const entries = Object.entries(slots);
  if (!entries.length || entries.some(([editId, slot]) => !HOME_TEXT_DRAFT_SLOT_IDS.includes(editId)
    || !slot
    || typeof slot !== 'object'
    || !isValidHomeDraftText(editId, slot.value))) throw new Error('Home draft contains an invalid text slot.');
  return Object.fromEntries(entries.map(([editId, slot]) => [editId, { value: slot.value }]));
}

export async function loadHomeDraft(ownerUid) {
  const key = draftKey(ownerUid);
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const completed = transactionComplete(transaction);
  const raw = await requestResult(transaction.objectStore(STORE_NAME).get(key));
  await completed;
  if (!raw) return null;
  const record = validateHomeDraft(raw, ownerUid);
  if (!record) throw new Error('Stored Home draft is invalid and was not applied.');
  return record;
}

export async function saveHomeDraft(ownerUid, slots) {
  const key = draftKey(ownerUid);
  const snapshot = cleanSlotSnapshot(slots);
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(STORE_NAME);
  const existingRaw = await requestResult(store.get(key));
  const existing = existingRaw ? validateHomeDraft(existingRaw, ownerUid) : null;
  if (existingRaw && !existing) {
    transaction.abort();
    await completed.catch(() => {});
    throw new Error('Stored Home draft is invalid and was not overwritten.');
  }
  const now = Date.now();
  const nextSlots = Object.fromEntries(Object.entries(snapshot).map(([editId, slot]) => {
    const prior = existing?.slots?.[editId];
    return [editId, {
      value: slot.value,
      updatedAtMs: prior?.value === slot.value ? prior.updatedAtMs : now
    }];
  }));
  const next = {
    key,
    schemaVersion: HOME_DRAFT_SCHEMA_VERSION,
    sourceFingerprint: HOME_DRAFT_SOURCE_FINGERPRINT,
    ownerUid: String(ownerUid).trim(),
    pageId: HOME_DRAFT_PAGE_ID,
    draftId: existing?.draftId || randomDraftId(),
    revision: (existing?.revision || 0) + 1,
    createdAtMs: existing?.createdAtMs || now,
    updatedAtMs: now,
    slots: nextSlots
  };
  store.put(next);
  await completed;
  return validateHomeDraft(next, ownerUid);
}

export async function deleteHomeDraft(ownerUid) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(STORE_NAME).delete(draftKey(ownerUid));
  await completed;
}

export const HOME_DRAFT_STORAGE = Object.freeze({ database: DATABASE_NAME, store: STORE_NAME });
