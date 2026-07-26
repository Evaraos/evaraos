import { functions, httpsCallable } from '../firebase.js';
import { normalizeExperienceConfig } from './experience-runtime.js';

const callables = Object.freeze({
  getState: httpsCallable(functions, 'getExperienceEditorState'),
  saveDraft: httpsCallable(functions, 'saveExperienceDraft'),
  publish: httpsCallable(functions, 'publishExperienceConfig'),
  uploadAsset: httpsCallable(functions, 'uploadExperienceAsset')
});

let editorState = null;
let requestQueue = Promise.resolve();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function enqueue(task) {
  const next = requestQueue.catch(() => undefined).then(task);
  requestQueue = next;
  return next;
}

export async function loadExperienceEditorState({ force = false } = {}) {
  if (editorState && !force) return clone(editorState);
  const response = await callables.getState({});
  const data = response.data || {};
  editorState = {
    draft: normalizeExperienceConfig(data.draft || {}),
    published: normalizeExperienceConfig(data.published || {}),
    draftRevision: Number(data.draftRevision || 0),
    publishedVersion: Number(data.publishedVersion || 0),
    publishedAtMs: data.publishedAtMs || null
  };
  return clone(editorState);
}

export async function saveExperienceDraftPatch(patch) {
  return enqueue(async () => {
    const response = await callables.saveDraft({ patch: clone(patch || {}) });
    const data = response.data || {};
    editorState = {
      ...(editorState || {}),
      draft: normalizeExperienceConfig(data.draft || editorState?.draft || {}),
      draftRevision: Number(data.draftRevision || 0)
    };
    return clone(editorState);
  });
}

export async function publishExperienceDraft() {
  return enqueue(async () => {
    if (!editorState) await loadExperienceEditorState();
    const response = await callables.publish({ expectedDraftRevision: editorState?.draftRevision || 0 });
    const data = response.data || {};
    editorState = {
      ...(editorState || {}),
      draft: normalizeExperienceConfig(data.published || editorState?.draft || {}),
      published: normalizeExperienceConfig(data.published || editorState?.draft || {}),
      draftRevision: Number(data.draftRevision || editorState?.draftRevision || 0),
      publishedVersion: Number(data.publishedVersion || 0),
      publishedAtMs: Date.now()
    };
    window.EvaraExperience?.applyConfig?.(editorState.published);
    return clone(editorState);
  });
}

export async function uploadExperienceAsset(file) {
  if (!(file instanceof File)) throw new TypeError('Choose an image file first.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new TypeError('Use a PNG, JPEG, or WebP image.');
  if (file.size > 2 * 1024 * 1024) throw new RangeError('Experience images must be smaller than 2 MB.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read the image.'));
    reader.readAsDataURL(file);
  });
  const response = await callables.uploadAsset({ dataUrl, fileName: file.name });
  return clone(response.data || {});
}

export function getCachedExperienceEditorState() {
  return clone(editorState);
}

window.EvaraExperienceEditor = Object.freeze({
  version: 'experience-editor-client-v1',
  loadState: loadExperienceEditorState,
  saveDraftPatch: saveExperienceDraftPatch,
  publish: publishExperienceDraft,
  uploadAsset: uploadExperienceAsset,
  getState: getCachedExperienceEditorState
});
