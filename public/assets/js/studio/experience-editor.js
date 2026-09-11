import { functions, httpsCallable } from '../firebase.js';
import { EXPERIENCE_DELIVERY } from '../experience/experience-deployment.js';

const EXPERIENCE_EDITOR_VERSION = 'experience-editor-v2';
const ROOT_ID = 'evaraExperienceEditor';
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const callable = Object.freeze({
  getState: httpsCallable(functions, 'getExperienceEditorState'),
  saveDraft: httpsCallable(functions, 'saveExperienceDraft'),
  publish: httpsCallable(functions, 'publishExperienceConfig'),
  rollback: httpsCallable(functions, 'rollbackExperienceConfig'),
  uploadAsset: httpsCallable(functions, 'uploadExperienceAsset')
});

const state = {
  authorized: false,
  loaded: false,
  busy: false,
  dirty: false,
  bootstrapPromise: null,
  draftRevision: 0,
  publishedVersion: 0,
  draft: null,
  root: null,
  form: null,
  status: null,
  version: null,
  trigger: null,
  preview: null
};

function text(value, maxLength = 2000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLength);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 2000);
  if (options.type) node.type = options.type;
  if (options.name) node.name = options.name;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.checked !== undefined) node.checked = Boolean(options.checked);
  if (options.placeholder) node.placeholder = text(options.placeholder, 220);
  if (options.maxLength) node.maxLength = options.maxLength;
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.hidden !== undefined) node.hidden = Boolean(options.hidden);
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
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

function safePreviewAssetUrl(value) {
  const candidate = text(value, 2200).trim();
  if (!candidate) return '';
  if (candidate.startsWith('/assets/') && !candidate.includes('..') && !candidate.includes('\\')) return candidate;
  try {
    const url = new URL(candidate, location.origin);
    const expectedPrefix = '/v0/b/evaraos-web.firebasestorage.app/o/';
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return '';
    if (!url.pathname.startsWith(expectedPrefix) || url.searchParams.get('alt') !== 'media') return '';
    return url.href;
  } catch {
    return '';
  }
}

function setStatus(message, tone = 'neutral') {
  if (!state.status) return;
  state.status.textContent = text(message, 320);
  state.status.dataset.tone = tone;
}

function updateVersionSummary() {
  if (state.version) state.version.textContent = `Draft r${state.draftRevision} · Published v${state.publishedVersion}`;
  const rollbackButton = state.root?.querySelector('[data-experience-action="rollback"]');
  if (rollbackButton) rollbackButton.disabled = state.busy || state.publishedVersion < 2;
}

function setBusy(nextBusy) {
  state.busy = Boolean(nextBusy);
  state.root?.querySelectorAll('button, input, textarea, select').forEach((control) => {
    if (control.dataset.keepEnabled === 'true') return;
    control.disabled = state.busy;
  });
  updateVersionSummary();
}

function field(label, name, options = {}) {
  let control;
  if (options.type === 'checkbox') {
    control = element('input', { type: 'checkbox', name });
    return element('label', { className: 'experience-editor-toggle' }, [
      element('span', { text: label }),
      control
    ]);
  }
  if (options.multiline) {
    control = element('textarea', {
      name,
      maxLength: options.maxLength || 500,
      placeholder: options.placeholder || '',
      attrs: { rows: options.rows || 3 }
    });
  } else {
    control = element('input', {
      type: options.type || 'text',
      name,
      maxLength: options.maxLength || 180,
      placeholder: options.placeholder || '',
      attrs: {
        ...(options.min !== undefined ? { min: options.min } : {}),
        ...(options.max !== undefined ? { max: options.max } : {}),
        ...(options.step !== undefined ? { step: options.step } : {})
      }
    });
  }
  return element('label', { className: 'experience-editor-field' }, [element('span', { text: label }), control]);
}

function uploadField(label, targetName) {
  const input = element('input', {
    type: 'file',
    name: `${targetName}Upload`,
    attrs: { accept: 'image/png,image/jpeg,image/webp', 'data-upload-target': targetName }
  });
  return element('label', { className: 'experience-editor-upload' }, [
    element('span', { text: label }),
    input,
    element('small', { text: 'PNG, JPEG, or WebP under 2 MB. Uploads are validated and stored by the trusted backend.' })
  ]);
}

function formValue(name) {
  return state.form?.elements.namedItem(name);
}

function populateForm(config = {}) {
  if (!state.form) return;
  const values = {
    markUrl: readPath(config, 'brand.markUrl'),
    appIconUrl: readPath(config, 'brand.appIconUrl'),
    brandAlt: readPath(config, 'brand.alt'),
    accent: readPath(config, 'loaderTheme.accent') || '#f2172d',
    background: readPath(config, 'loaderTheme.background') || '#eef5fb',
    radius: readPath(config, 'loaderTheme.radius') ?? 34,
    markSize: readPath(config, 'loaderTheme.markSize') ?? 42,
    showProgress: readPath(config, 'loaderTheme.showProgress') !== false,
    welcomeEnabled: readPath(config, 'loaders.welcome.enabled') !== false,
    welcomeEyebrow: readPath(config, 'loaders.welcome.eyebrow'),
    welcomeTitle: readPath(config, 'loaders.welcome.title'),
    welcomeSubtitle: readPath(config, 'loaders.welcome.subtitle'),
    welcomeMinimumMs: readPath(config, 'loaders.welcome.minimumMs') ?? 450,
    pageEnabled: readPath(config, 'loaders.page.enabled') !== false,
    pageLabel: readPath(config, 'loaders.page.label'),
    pageDelayMs: readPath(config, 'loaders.page.delayMs') ?? 20,
    resumeEnabled: readPath(config, 'loaders.resume.enabled') === true,
    resumeTitle: readPath(config, 'loaders.resume.title'),
    resumeSubtitle: readPath(config, 'loaders.resume.subtitle'),
    resumeMinimumAwaySeconds: Math.round(Number(readPath(config, 'loaders.resume.minimumAwayMs') || 45000) / 1000),
    kicker: readPath(config, 'home.kicker'),
    title: readPath(config, 'home.title'),
    subtitle: readPath(config, 'home.subtitle'),
    primaryAction: readPath(config, 'home.primaryAction'),
    secondaryAction: readPath(config, 'home.secondaryAction')
  };

  Object.entries(values).forEach(([name, value]) => {
    const control = formValue(name);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = text(value, 2200);
  });
  state.dirty = false;
  renderPreview();
}

function buildPatch() {
  return {
    brand: {
      markUrl: text(formValue('markUrl')?.value, 2200),
      appIconUrl: text(formValue('appIconUrl')?.value, 2200),
      alt: text(formValue('brandAlt')?.value, 120)
    },
    loaderTheme: {
      accent: text(formValue('accent')?.value, 16),
      background: text(formValue('background')?.value, 16),
      radius: integer(formValue('radius')?.value, 34, 16, 52),
      markSize: integer(formValue('markSize')?.value, 42, 24, 96),
      showProgress: Boolean(formValue('showProgress')?.checked)
    },
    loaders: {
      welcome: {
        enabled: Boolean(formValue('welcomeEnabled')?.checked),
        eyebrow: text(formValue('welcomeEyebrow')?.value, 80),
        title: text(formValue('welcomeTitle')?.value, 180),
        subtitle: text(formValue('welcomeSubtitle')?.value, 320),
        minimumMs: integer(formValue('welcomeMinimumMs')?.value, 450, 250, 2000)
      },
      page: {
        enabled: Boolean(formValue('pageEnabled')?.checked),
        label: text(formValue('pageLabel')?.value, 160),
        delayMs: integer(formValue('pageDelayMs')?.value, 20, 0, 250)
      },
      resume: {
        enabled: Boolean(formValue('resumeEnabled')?.checked),
        title: text(formValue('resumeTitle')?.value, 180),
        subtitle: text(formValue('resumeSubtitle')?.value, 320),
        minimumAwayMs: integer(formValue('resumeMinimumAwaySeconds')?.value, 45, 10, 600) * 1000
      }
    },
    home: {
      kicker: text(formValue('kicker')?.value, 180),
      title: text(formValue('title')?.value, 260),
      subtitle: text(formValue('subtitle')?.value, 1200),
      primaryAction: text(formValue('primaryAction')?.value, 100),
      secondaryAction: text(formValue('secondaryAction')?.value, 100)
    }
  };
}

function renderPreview() {
  if (!state.preview || !state.form) return;
  const config = buildPatch();
  const card = state.preview.querySelector('[data-experience-preview-card]');
  const image = state.preview.querySelector('img');
  const eyebrow = state.preview.querySelector('[data-experience-preview-eyebrow]');
  const title = state.preview.querySelector('[data-experience-preview-title]');
  const subtitle = state.preview.querySelector('[data-experience-preview-subtitle]');
  const progress = state.preview.querySelector('[data-experience-preview-progress]');
  const asset = safePreviewAssetUrl(config.brand.markUrl) || '/assets/brand/evaraos-mark.png';
  if (image) image.src = asset;
  if (image) image.alt = config.brand.alt || 'EvaraOS';
  if (eyebrow) eyebrow.textContent = config.loaders.welcome.eyebrow;
  if (title) title.textContent = config.loaders.welcome.title;
  if (subtitle) subtitle.textContent = config.loaders.welcome.subtitle;
  if (progress) progress.hidden = !config.loaderTheme.showProgress;
  if (card) {
    card.style.setProperty('--experience-preview-accent', config.loaderTheme.accent);
    card.style.setProperty('--experience-preview-background', config.loaderTheme.background);
    card.style.setProperty('--experience-preview-radius', `${config.loaderTheme.radius}px`);
    card.style.setProperty('--experience-preview-mark-size', `${config.loaderTheme.markSize}px`);
  }
}

function applyTrustedState(result) {
  state.authorized = true;
  state.loaded = true;
  state.draftRevision = Number(result.draftRevision || 0);
  state.publishedVersion = Number(result.publishedVersion || 0);
  state.draft = clone(result.draft || {});
  if (state.form) populateForm(state.draft);
  updateVersionSummary();
}

async function loadState() {
  setBusy(true);
  setStatus('Loading the trusted Experience state…');
  try {
    const result = await invoke(callable.getState);
    applyTrustedState(result);
    setStatus('Experience state loaded.', 'success');
    return result;
  } catch (error) {
    state.loaded = false;
    setStatus(errorMessage(error), 'error');
    throw error;
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
    applyTrustedState({ ...result, publishedVersion: state.publishedVersion });
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
    const result = await invoke(callable.publish, { expectedDraftRevision: Number(saved.draftRevision) });
    state.publishedVersion = Number(result.publishedVersion || state.publishedVersion);
    state.draft = clone(result.published || state.draft || {});
    state.dirty = false;
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
  if (!window.confirm(`Restore the previous published Experience and replace v${state.publishedVersion}?`)) return;
  setBusy(true);
  setStatus('Restoring the previous published Experience…');
  try {
    const result = await invoke(callable.rollback, { expectedPublishedVersion: state.publishedVersion });
    state.publishedVersion = Number(result.publishedVersion || state.publishedVersion);
    state.draft = clone(result.published || state.draft || {});
    state.dirty = false;
    populateForm(state.draft);
    updateVersionSummary();
    await window.EvaraExperience?.refresh?.();
    setStatus(`Restored published version ${result.restoredFromVersion} as v${state.publishedVersion}.`, 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function uploadAsset(input) {
  const file = input.files?.[0];
  const targetName = input.dataset.uploadTarget;
  if (!file || !targetName) return;
  if (!ALLOWED_ASSET_TYPES.has(file.type)) {
    setStatus('Use a PNG, JPEG, or WebP image.', 'error');
    input.value = '';
    return;
  }
  if (file.size > MAX_ASSET_BYTES) {
    setStatus('Experience images must be smaller than 2 MB.', 'error');
    input.value = '';
    return;
  }
  setBusy(true);
  setStatus('Uploading the protected Experience asset…');
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Unable to read the image.'));
      reader.readAsDataURL(file);
    });
    const result = await invoke(callable.uploadAsset, { dataUrl, fileName: file.name });
    const target = formValue(targetName);
    if (target) target.value = text(result.url, 2200);
    state.dirty = true;
    renderPreview();
    setStatus('Asset uploaded. Save the draft, then publish it live.', 'success');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    input.value = '';
    setBusy(false);
  }
}

function setOpen(isOpen) {
  if (!state.root || !state.trigger || !state.authorized) return;
  if (!isOpen && state.dirty && !window.confirm('Close the Experience editor with unsaved changes?')) return;
  state.root.hidden = !isOpen;
  state.trigger.setAttribute('aria-expanded', String(isOpen));
}

function mount() {
  if (!state.authorized || document.getElementById(ROOT_ID)) return;
  const close = element('button', { type: 'button', className: 'experience-editor-close', text: 'Close', attrs: { 'aria-label': 'Close Experience editor' } });
  close.dataset.keepEnabled = 'true';
  state.version = element('p', { className: 'experience-editor-version', text: 'Draft r0 · Published v0' });
  state.status = element('p', { className: 'experience-editor-status', text: 'Trusted owner authority verified.', attrs: { role: 'status', 'aria-live': 'polite' } });

  state.form = element('form', { className: 'experience-editor-form' }, [
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Brand assets' }),
      field('Visible logo URL', 'markUrl', { maxLength: 2200, placeholder: '/assets/brand/evaraos-mark.png' }),
      uploadField('Upload visible logo', 'markUrl'),
      field('App icon URL', 'appIconUrl', { maxLength: 2200, placeholder: '/assets/brand/evaraos-app-icon.png' }),
      uploadField('Upload app icon', 'appIconUrl'),
      field('Brand alt text', 'brandAlt', { maxLength: 120 })
    ]),
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Loader appearance' }),
      element('div', { className: 'experience-editor-grid' }, [
        field('Accent', 'accent', { type: 'color', maxLength: 16 }),
        field('Background', 'background', { type: 'color', maxLength: 16 }),
        field('Card radius', 'radius', { type: 'number', min: 16, max: 52 }),
        field('Logo size', 'markSize', { type: 'number', min: 24, max: 96 })
      ]),
      field('Show progress bar', 'showProgress', { type: 'checkbox' })
    ]),
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Welcome loader' }),
      field('Enabled', 'welcomeEnabled', { type: 'checkbox' }),
      field('Eyebrow', 'welcomeEyebrow', { maxLength: 80 }),
      field('Title', 'welcomeTitle', { maxLength: 180 }),
      field('Subtitle', 'welcomeSubtitle', { maxLength: 320, multiline: true, rows: 3 }),
      field('Minimum display time (ms)', 'welcomeMinimumMs', { type: 'number', min: 250, max: 2000 })
    ]),
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Page-transition loader' }),
      field('Enabled', 'pageEnabled', { type: 'checkbox' }),
      field('Accessibility label', 'pageLabel', { maxLength: 160 }),
      field('Start delay (ms)', 'pageDelayMs', { type: 'number', min: 0, max: 250 })
    ]),
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Resume loader' }),
      field('Enabled', 'resumeEnabled', { type: 'checkbox' }),
      field('Title', 'resumeTitle', { maxLength: 180 }),
      field('Subtitle', 'resumeSubtitle', { maxLength: 320, multiline: true, rows: 3 }),
      field('Minimum time away (seconds)', 'resumeMinimumAwaySeconds', { type: 'number', min: 10, max: 600 })
    ]),
    element('section', { className: 'experience-editor-section' }, [
      element('h3', { text: 'Homepage copy' }),
      field('Kicker', 'kicker', { maxLength: 180 }),
      field('Headline', 'title', { maxLength: 260, multiline: true, rows: 2 }),
      field('Supporting copy', 'subtitle', { maxLength: 1200, multiline: true, rows: 4 }),
      element('div', { className: 'experience-editor-grid' }, [
        field('Primary action', 'primaryAction', { maxLength: 100 }),
        field('Secondary action', 'secondaryAction', { maxLength: 100 })
      ])
    ])
  ]);

  state.preview = element('section', { className: 'experience-editor-live-preview' }, [
    element('span', { className: 'experience-editor-eyebrow', text: 'SAFE LOCAL PREVIEW' }),
    element('div', { className: 'experience-editor-preview-card', attrs: { 'data-experience-preview-card': 'true' } }, [
      element('img', { attrs: { src: '/assets/brand/evaraos-mark.png', alt: 'EvaraOS' } }),
      element('small', { text: 'EVARAOS', attrs: { 'data-experience-preview-eyebrow': 'true' } }),
      element('strong', { text: 'Welcome to Evaraos', attrs: { 'data-experience-preview-title': 'true' } }),
      element('p', { text: 'Preparing your operating system.', attrs: { 'data-experience-preview-subtitle': 'true' } }),
      element('span', { className: 'experience-editor-preview-progress', attrs: { 'data-experience-preview-progress': 'true', 'aria-hidden': 'true' } })
    ])
  ]);

  const refreshButton = element('button', { type: 'button', text: 'Refresh state' });
  refreshButton.addEventListener('click', () => loadState().catch(() => {}));
  const saveButton = element('button', { type: 'button', text: 'Save draft' });
  saveButton.addEventListener('click', () => saveDraft().catch(() => {}));
  const publishButton = element('button', { type: 'button', className: 'experience-editor-primary', text: 'Publish live' });
  publishButton.addEventListener('click', publishLive);
  const rollbackButton = element('button', { type: 'button', text: 'Restore previous', attrs: { 'data-experience-action': 'rollback' }, disabled: true });
  rollbackButton.addEventListener('click', rollbackPublished);
  const previewLink = element('a', { className: 'experience-editor-preview-link', text: 'Open homepage in a new tab', attrs: { href: '/', target: '_blank', rel: 'noopener' } });

  state.root = element('aside', {
    className: 'experience-editor-drawer',
    hidden: true,
    attrs: { id: ROOT_ID, role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'experienceEditorTitle', 'data-experience-editor-version': EXPERIENCE_EDITOR_VERSION }
  }, [
    element('header', { className: 'experience-editor-header' }, [
      element('div', {}, [
        element('span', { className: 'experience-editor-eyebrow', text: 'GLOBAL EXPERIENCE' }),
        element('h2', { text: 'Owner Experience', attrs: { id: 'experienceEditorTitle' } }),
        state.version
      ]),
      close
    ]),
    state.preview,
    state.form,
    state.status,
    element('div', { className: 'experience-editor-actions' }, [refreshButton, saveButton, publishButton, rollbackButton]),
    previewLink
  ]);

  state.trigger = element('button', {
    type: 'button',
    className: 'experience-editor-trigger',
    text: 'Experience',
    attrs: { 'aria-controls': ROOT_ID, 'aria-expanded': 'false' }
  });

  state.form.addEventListener('input', () => {
    state.dirty = true;
    renderPreview();
    setStatus('Unsaved Experience changes.', 'warning');
  });
  state.form.addEventListener('change', (event) => {
    const upload = event.target.closest('[data-upload-target]');
    if (upload) uploadAsset(upload);
    else renderPreview();
  });
  state.form.addEventListener('submit', (event) => event.preventDefault());
  state.trigger.addEventListener('click', () => setOpen(state.root.hidden));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !state.root.hidden) setOpen(false);
  });

  document.body.append(state.trigger, state.root);
  populateForm(state.draft || {});
  updateVersionSummary();
}

async function bootstrap() {
  if (EXPERIENCE_DELIVERY === 'hosting') {
    document.documentElement.dataset.evaraExperienceEditorAuthority = 'unavailable';
    if (!document.getElementById('evaraExperienceAvailability')) {
      const notice = element('p', {
        className: 'experience-editor-availability',
        text: 'Online site publishing is paused. Site updates continue through reviewed releases.',
        attrs: { id: 'evaraExperienceAvailability', role: 'status' }
      });
      document.body.append(notice);
    }
    return;
  }
  if (state.bootstrapPromise) return state.bootstrapPromise;
  state.bootstrapPromise = (async () => {
    try {
      const result = await invoke(callable.getState);
      applyTrustedState(result);
      mount();
      document.documentElement.dataset.evaraExperienceEditorAuthority = 'verified';
    } catch (error) {
      document.documentElement.dataset.evaraExperienceEditorAuthority = 'denied';
      window.dispatchEvent(new CustomEvent('evara:experience-editor-unavailable', {
        detail: { code: text(error?.code || 'unavailable', 120) }
      }));
    } finally {
      if (!state.authorized) state.bootstrapPromise = null;
    }
  })();
  return state.bootstrapPromise;
}

window.addEventListener('evara:session-ready', bootstrap, { once: true });
window.addEventListener('pageshow', () => { if (!state.authorized) bootstrap(); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 500), { once: true });
else setTimeout(bootstrap, 500);
