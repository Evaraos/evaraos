import {
  functions,
  httpsCallable,
  getSavedUserProfile,
  getSavedUserRole,
  normalizeRole
} from '../firebase.js';

const EXPERIENCE_EDITOR_VERSION = 'experience-editor-v1';
const ROOT_ID = 'evaraExperienceEditor';
const OWNER_ROLES = new Set(['owner', 'platform_admin']);
const callable = Object.freeze({
  getState: httpsCallable(functions, 'getExperienceEditorState'),
  saveDraft: httpsCallable(functions, 'saveExperienceDraft'),
  publish: httpsCallable(functions, 'publishExperienceConfig'),
  rollback: httpsCallable(functions, 'rollbackExperienceConfig')
});

const state = {
  loaded: false,
  busy: false,
  dirty: false,
  draftRevision: 0,
  publishedVersion: 0,
  draft: null,
  root: null,
  form: null,
  status: null,
  version: null,
  trigger: null
};

function text(value, maxLength = 2000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLength);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 2000);
  if (options.type) node.type = options.type;
  if (options.name) node.name = options.name;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.placeholder) node.placeholder = text(options.placeholder, 200);
  if (options.maxLength) node.maxLength = options.maxLength;
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.hidden !== undefined) node.hidden = Boolean(options.hidden);
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  }
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function canOpenEditor() {
  return OWNER_ROLES.has(currentRole());
}

function readPath(object, path) {
  return String(path || '').split('.').reduce((value, key) => value?.[key], object);
}

function errorMessage(error) {
  const code = text(error?.code || '', 120).replace(/^functions\//, '');
  const message = text(error?.message || 'The trusted Experience service could not complete the request.', 320);
  if (code === 'aborted') return `${message} Refresh the editor state and try again.`;
  if (code === 'permission-denied') return 'Your verified account does not have global Experience publishing authority.';
  if (code === 'unauthenticated') return 'Sign in again before editing the global Experience.';
  if (code === 'unavailable' || code === 'not-found') return 'The trusted Experience Functions are not available in this environment yet.';
  return message;
}

async function invoke(fn, payload = {}) {
  const response = await fn(payload);
  const data = response?.data || {};
  if (data.ok !== true) throw new Error('The trusted Experience service returned an invalid response.');
  return data;
}

function setStatus(message, tone = 'neutral') {
  if (!state.status) return;
  state.status.textContent = text(message, 320);
  state.status.dataset.tone = tone;
}

function updateVersionSummary() {
  if (!state.version) return;
  state.version.textContent = `Draft r${state.draftRevision} · Published v${state.publishedVersion}`;
  const rollbackButton = state.root?.querySelector('[data-experience-action="rollback"]');
  if (rollbackButton) rollbackButton.disabled = state.busy || state.publishedVersion < 2;
}

function setBusy(nextBusy) {
  state.busy = Boolean(nextBusy);
  state.root?.querySelectorAll('button, input, textarea').forEach((control) => {
    if (control.dataset.keepEnabled === 'true') return;
    control.disabled = state.busy;
  });
  updateVersionSummary();
}

function field(label, name, options = {}) {
  const control = options.multiline
    ? element('textarea', {
        name,
        maxLength: options.maxLength || 500,
        placeholder: options.placeholder || '',
        attrs: { rows: options.rows || 3 }
      })
    : element('input', {
        type: options.type || 'text',
        name,
        maxLength: options.maxLength || 180,
        placeholder: options.placeholder || ''
      });

  return element('label', { className: 'experience-editor-field' }, [
    element('span', { text: label }),
    control
  ]);
}

function populateForm(config = {}) {
  if (!state.form) return;
  const values = {
    kicker: readPath(config, 'home.kicker'),
    title: readPath(config, 'home.title'),
    subtitle: readPath(config, 'home.subtitle'),
    primaryAction: readPath(config, 'home.primaryAction'),
    secondaryAction: readPath(config, 'home.secondaryAction'),
    welcomeEyebrow: readPath(config, 'loaders.welcome.eyebrow'),
    welcomeTitle: readPath(config, 'loaders.welcome.title'),
    welcomeSubtitle: readPath(config, 'loaders.welcome.subtitle'),
    accent: readPath(config, 'loaderTheme.accent') || '#f2172d'
  };

  Object.entries(values).forEach(([name, value]) => {
    const control = state.form.elements.namedItem(name);
    if (control) control.value = text(value, 2000);
  });
  state.dirty = false;
}

function buildPatch() {
  const form = state.form;
  return {
    home: {
      kicker: text(form.elements.namedItem('kicker')?.value, 160),
      title: text(form.elements.namedItem('title')?.value, 240),
      subtitle: text(form.elements.namedItem('subtitle')?.value, 1000),
      primaryAction: text(form.elements.namedItem('primaryAction')?.value, 120),
      secondaryAction: text(form.elements.namedItem('secondaryAction')?.value, 120)
    },
    loaders: {
      welcome: {
        eyebrow: text(form.elements.namedItem('welcomeEyebrow')?.value, 120),
        title: text(form.elements.namedItem('welcomeTitle')?.value, 240),
        subtitle: text(form.elements.namedItem('welcomeSubtitle')?.value, 500)
      }
    },
    loaderTheme: {
      accent: text(form.elements.namedItem('accent')?.value, 20)
    }
  };
}

async function loadState() {
  setBusy(true);
  setStatus('Loading the trusted Experience state…');
  try {
    const result = await invoke(callable.getState);
    state.loaded = true;
    state.draftRevision = Number(result.draftRevision || 0);
    state.publishedVersion = Number(result.publishedVersion || 0);
    state.draft = clone(result.draft || {});
    populateForm(state.draft);
    updateVersionSummary();
    setStatus('Experience state loaded.', 'success');
  } catch (error) {
    state.loaded = false;
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function saveDraft({ quiet = false } = {}) {
  if (!state.loaded) await loadState();
  if (!state.loaded) throw new Error('Load the trusted Experience state before saving.');

  setBusy(true);
  if (!quiet) setStatus('Saving the protected draft…');
  try {
    const result = await invoke(callable.saveDraft, {
      patch: buildPatch(),
      expectedDraftRevision: state.draftRevision
    });
    state.draftRevision = Number(result.draftRevision || state.draftRevision);
    state.draft = clone(result.draft || state.draft || {});
    state.dirty = false;
    updateVersionSummary();
    if (!quiet) setStatus('Draft saved with revision protection.', 'success');
    return result;
  } catch (error) {
    setStatus(errorMessage(error), 'error');
    throw error;
  } finally {
    setBusy(false);
  }
}

async function publishLive() {
  setStatus('Saving and publishing the Experience…');
  try {
    const saved = await saveDraft({ quiet: true });
    setBusy(true);
    const result = await invoke(callable.publish, {
      expectedDraftRevision: Number(saved.draftRevision)
    });
    state.publishedVersion = Number(result.publishedVersion || state.publishedVersion);
    updateVersionSummary();
    await window.EvaraExperience?.refresh?.();
    setStatus(`Published Experience v${state.publishedVersion}.`, 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function rollbackPublished() {
  if (state.publishedVersion < 2) return;
  const approved = window.confirm(`Restore the previous published Experience and replace v${state.publishedVersion}?`);
  if (!approved) return;

  setBusy(true);
  setStatus('Restoring the previous published Experience…');
  try {
    const result = await invoke(callable.rollback, {
      expectedPublishedVersion: state.publishedVersion
    });
    state.publishedVersion = Number(result.publishedVersion || state.publishedVersion);
    updateVersionSummary();
    await window.EvaraExperience?.refresh?.();
    setStatus(`Restored published version ${result.restoredFromVersion} as v${state.publishedVersion}.`, 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

function setOpen(isOpen) {
  if (!state.root || !state.trigger) return;
  state.root.hidden = !isOpen;
  state.trigger.setAttribute('aria-expanded', String(isOpen));
  if (isOpen && !state.loaded && !state.busy) loadState();
}

function mount() {
  if (!canOpenEditor() || document.getElementById(ROOT_ID)) return;

  const close = element('button', {
    type: 'button',
    className: 'experience-editor-close',
    text: 'Close',
    attrs: { 'aria-label': 'Close Experience editor' }
  });
  close.dataset.keepEnabled = 'true';

  state.version = element('p', { className: 'experience-editor-version', text: 'Draft r0 · Published v0' });
  state.status = element('p', {
    className: 'experience-editor-status',
    text: 'Open the editor to load the trusted Experience state.',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });

  state.form = element('form', { className: 'experience-editor-form' }, [
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Homepage copy' }),
      field('Kicker', 'kicker', { maxLength: 160 }),
      field('Headline', 'title', { maxLength: 240, multiline: true, rows: 2 }),
      field('Supporting copy', 'subtitle', { maxLength: 1000, multiline: true, rows: 4 }),
      element('div', { className: 'experience-editor-grid' }, [
        field('Primary action', 'primaryAction', { maxLength: 120 }),
        field('Secondary action', 'secondaryAction', { maxLength: 120 })
      ])
    ]),
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Welcome loader' }),
      field('Eyebrow', 'welcomeEyebrow', { maxLength: 120 }),
      field('Title', 'welcomeTitle', { maxLength: 240 }),
      field('Subtitle', 'welcomeSubtitle', { maxLength: 500, multiline: true, rows: 3 }),
      field('Accent color', 'accent', { type: 'color', maxLength: 20 })
    ])
  ]);

  const refreshButton = element('button', { type: 'button', text: 'Refresh state' });
  refreshButton.addEventListener('click', loadState);

  const saveButton = element('button', { type: 'button', text: 'Save draft' });
  saveButton.addEventListener('click', () => saveDraft().catch(() => {}));

  const publishButton = element('button', {
    type: 'button',
    className: 'experience-editor-primary',
    text: 'Publish live'
  });
  publishButton.addEventListener('click', publishLive);

  const rollbackButton = element('button', {
    type: 'button',
    text: 'Restore previous',
    attrs: { 'data-experience-action': 'rollback' },
    disabled: true
  });
  rollbackButton.addEventListener('click', rollbackPublished);

  const previewLink = element('a', {
    className: 'experience-editor-preview',
    text: 'Open homepage preview',
    attrs: { href: '/', target: '_blank', rel: 'noopener' }
  });

  state.root = element('aside', {
    className: 'experience-editor-drawer',
    hidden: true,
    attrs: {
      id: ROOT_ID,
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'experienceEditorTitle',
      'data-experience-editor-version': EXPERIENCE_EDITOR_VERSION
    }
  }, [
    element('header', { className: 'experience-editor-header' }, [
      element('div', {}, [
        element('span', { className: 'experience-editor-eyebrow', text: 'GLOBAL EXPERIENCE' }),
        element('h2', { text: 'Homepage & loader', attrs: { id: 'experienceEditorTitle' } }),
        state.version
      ]),
      close
    ]),
    state.form,
    state.status,
    element('div', { className: 'experience-editor-actions' }, [
      refreshButton,
      saveButton,
      publishButton,
      rollbackButton
    ]),
    previewLink
  ]);

  state.trigger = element('button', {
    type: 'button',
    className: 'experience-editor-trigger',
    text: 'Experience',
    attrs: {
      'aria-controls': ROOT_ID,
      'aria-expanded': 'false'
    }
  });

  state.form.addEventListener('input', () => {
    state.dirty = true;
    setStatus('Unsaved Experience changes.', 'warning');
  });
  state.form.addEventListener('submit', (event) => event.preventDefault());
  state.trigger.addEventListener('click', () => setOpen(state.root.hidden));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !state.root.hidden) setOpen(false);
  });

  document.body.append(state.trigger, state.root);
}

function scheduleMount() {
  if (!canOpenEditor()) return;
  requestAnimationFrame(mount);
}

window.addEventListener('evara:session-ready', scheduleMount);
window.addEventListener('pageshow', scheduleMount);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleMount, { once: true });
} else {
  scheduleMount();
}
