import {
  loadExperienceEditorState,
  saveExperienceDraftPatch,
  publishExperienceDraft,
  uploadExperienceAsset
} from '../experience/experience-config-client.js';
import { normalizeExperienceConfig } from '../experience/experience-runtime.js';
import { getSavedUserProfile, getSavedUserRole, normalizeRole } from '../firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'platform_admin', 'admin']);
const TABS = ['brand', 'welcome', 'page', 'resume', 'home', 'overrides'];
let mounted = false;
let shell = null;
let activeTab = 'brand';
let state = null;
let draft = null;
let busy = false;
let previewMode = 'welcome';

const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value, max = 4000) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);

function role() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function allowed() {
  const current = role();
  if (current === 'admin') return Boolean((getSavedUserProfile?.() || {}).platformAccess);
  return OWNER_ROLES.has(current);
}

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.checked !== undefined) node.checked = Boolean(options.checked);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) node.setAttribute(key, String(value));
  });
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function getPath(object, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], object);
}

function setPath(object, path, value) {
  const parts = String(path).split('.');
  let target = object;
  parts.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  });
  target[parts.at(-1)] = value;
}

function field(label, path, options = {}) {
  const current = getPath(draft, path);
  let control;
  if (options.type === 'textarea') {
    control = el('textarea', { dataset: { experienceField: path }, attrs: { maxlength: options.max || 1200 } });
    control.value = current || '';
  } else if (options.type === 'checkbox') {
    control = el('input', { type: 'checkbox', checked: current, dataset: { experienceField: path } });
    return el('label', { className: 'experience-toggle' }, [el('span', { text: label }), control]);
  } else if (options.type === 'color') {
    const picker = el('input', { type: 'color', value: current, dataset: { experienceField: path, colorPeer: 'picker' } });
    const textInput = el('input', { type: 'text', value: current, dataset: { experienceField: path, colorPeer: 'text' }, attrs: { maxlength: 7, pattern: '#[0-9a-fA-F]{6}' } });
    control = el('div', { className: 'experience-color-input' }, [picker, textInput]);
  } else {
    control = el('input', {
      type: options.type || 'text',
      value: options.transformOut ? options.transformOut(current) : current,
      dataset: { experienceField: path, transform: options.transform || '' },
      attrs: {
        min: options.min,
        max: options.max,
        step: options.step,
        maxlength: options.maxLength ?? 2200,
        placeholder: options.placeholder || ''
      }
    });
  }
  return el('label', { className: 'experience-field' }, [el('span', { text: label }), control]);
}

function section(title, copy, children) {
  return el('section', { className: 'experience-section' }, [el('h2', { text: title }), el('p', { text: copy }), ...(Array.isArray(children) ? children : [children])]);
}

function renderBrand(fields) {
  const preview = el('span', { className: 'experience-upload-preview' }, [el('img', { attrs: { src: draft.brand.markUrl, alt: '' } })]);
  const fileInput = el('input', { type: 'file', attrs: { accept: 'image/png,image/jpeg,image/webp' }, dataset: { experienceUpload: 'brand-mark' } });
  fields.append(section('Brand assets', 'Upload a PNG, JPEG, or WebP under 2 MB, or use an approved secure URL.', [
    el('div', { className: 'experience-upload' }, [preview, el('div', { className: 'experience-upload-actions' }, [
      el('label', { className: 'experience-file-button' }, [el('span', { text: 'Upload new logo' }), fileInput]),
      el('small', { text: 'The uploaded file becomes a versioned public asset after you save and publish.' })
    ])]),
    field('Visible logo URL', 'brand.markUrl', { placeholder: '/assets/brand/evaraos-mark.png' }),
    field('App icon URL', 'brand.appIconUrl', { placeholder: '/assets/brand/evaraos-app-icon.png' }),
    field('Brand alt text', 'brand.alt')
  ]));
  fields.append(section('Loader appearance', 'These values apply to welcome, page-transition, and resume loaders.', [
    el('div', { className: 'experience-field-row' }, [field('Accent', 'loaderTheme.accent', { type: 'color' }), field('Background', 'loaderTheme.background', { type: 'color' })]),
    el('div', { className: 'experience-field-row' }, [field('Card radius', 'loaderTheme.radius', { type: 'number', min: 16, max: 52 }), field('Logo size', 'loaderTheme.markSize', { type: 'number', min: 24, max: 96 })]),
    field('Show progress bar', 'loaderTheme.showProgress', { type: 'checkbox' })
  ]));
}

function renderWelcome(fields) {
  fields.append(section('Welcome loader', 'Shown on true app launches, reloads, and external entry.', [
    field('Enabled', 'loaders.welcome.enabled', { type: 'checkbox' }),
    field('Eyebrow', 'loaders.welcome.eyebrow'),
    field('Title', 'loaders.welcome.title'),
    field('Subtitle', 'loaders.welcome.subtitle', { type: 'textarea', max: 320 }),
    field('Minimum display time (ms)', 'loaders.welcome.minimumMs', { type: 'number', min: 400, max: 5000 })
  ]));
}

function renderPage(fields) {
  fields.append(section('Page loader', 'Used for internal navigation while the next route opens.', [
    field('Enabled', 'loaders.page.enabled', { type: 'checkbox' }),
    field('Accessibility label', 'loaders.page.label')
  ]));
}

function renderResume(fields) {
  fields.append(section('Resume loader', 'Shown when the installed app returns after being backgrounded.', [
    field('Enabled', 'loaders.resume.enabled', { type: 'checkbox' }),
    field('Title', 'loaders.resume.title'),
    field('Subtitle', 'loaders.resume.subtitle', { type: 'textarea', max: 320 }),
    field('Minimum time away (seconds)', 'loaders.resume.minimumAwayMs', { type: 'number', min: 10, max: 600, transform: 'seconds', transformOut: (value) => Math.round(Number(value || 45000) / 1000) })
  ]));
}

function renderHome(fields) {
  fields.append(section('Homepage entry copy', 'These published values update the live homepage without another code deployment.', [
    field('Kicker', 'home.kicker'),
    field('Headline', 'home.title', { type: 'textarea', max: 260 }),
    field('Supporting copy', 'home.subtitle', { type: 'textarea', max: 1200 }),
    el('div', { className: 'experience-field-row' }, [field('Primary button', 'home.primaryAction'), field('Secondary button', 'home.secondaryAction')])
  ]));
}

function overrideCounts() {
  const pages = Object.values(draft.pageOverrides || {});
  return {
    pages: pages.length,
    text: pages.reduce((sum, page) => sum + Object.keys(page.text || {}).length, 0),
    media: pages.reduce((sum, page) => sum + Object.keys(page.media || {}).length, 0)
  };
}

function renderOverrides(fields) {
  const counts = overrideCounts();
  fields.append(section('Existing page overrides', 'Use Live Edit on any page to publish existing text, images, card radius, padding, and glass. New placeholder blocks remain drafts until they are converted into registered Studio components.', [
    el('div', { className: 'experience-overrides-summary' }, [
      el('div', {}, [el('strong', { text: counts.pages }), el('span', { text: 'Pages' })]),
      el('div', {}, [el('strong', { text: counts.text }), el('span', { text: 'Text edits' })]),
      el('div', {}, [el('strong', { text: counts.media }), el('span', { text: 'Media edits' })])
    ]),
    el('button', { type: 'button', className: 'experience-file-button', text: 'Open homepage in Live Edit', dataset: { experienceOpenLiveEdit: 'true' } })
  ]));
}

function renderFields() {
  const fields = el('div', { className: 'experience-builder-fields' });
  if (activeTab === 'brand') renderBrand(fields);
  else if (activeTab === 'welcome') renderWelcome(fields);
  else if (activeTab === 'page') renderPage(fields);
  else if (activeTab === 'resume') renderResume(fields);
  else if (activeTab === 'home') renderHome(fields);
  else renderOverrides(fields);
  return fields;
}

function renderPreview() {
  const config = normalizeExperienceConfig(clone(draft));
  const source = previewMode === 'resume'
    ? config.loaders.resume
    : previewMode === 'page'
      ? { title: config.loaders.page.label, subtitle: '' }
      : config.loaders.welcome;
  const card = el('section', { className: 'experience-loader-preview' }, [
    el('div', { className: 'experience-loader-orbit' }, [el('img', { attrs: { src: config.brand.markUrl, alt: '' } })]),
    el('small', { text: previewMode === 'welcome' ? config.loaders.welcome.eyebrow : 'EVARAOS' }),
    el('strong', { text: source.title || config.loaders.page.label }),
    el('p', { text: source.subtitle || '' }),
    el('span', { className: 'experience-preview-progress', attrs: { 'aria-hidden': 'true' } })
  ]);
  if (!config.loaderTheme.showProgress || previewMode === 'page') card.querySelector('.experience-preview-progress').hidden = true;
  const stage = el('div', { className: `experience-preview-stage${previewMode === 'page' ? ' experience-preview-page' : ''}` }, [card]);
  stage.style.setProperty('--experience-preview-background', config.loaderTheme.background);
  stage.style.setProperty('--experience-preview-accent', config.loaderTheme.accent);
  stage.style.setProperty('--experience-preview-radius', `${config.loaderTheme.radius}px`);
  stage.style.setProperty('--experience-preview-mark-size', `${config.loaderTheme.markSize}px`);
  return el('section', { className: 'experience-builder-preview' }, [
    el('div', { className: 'experience-preview-toolbar' }, [el('strong', { text: 'Live loader preview' }), el('div', {}, [
      ...['welcome', 'page', 'resume'].map((mode) => el('button', { type: 'button', className: mode === previewMode ? 'is-active' : '', text: mode, dataset: { experiencePreview: mode } }))
    ])]),
    stage
  ]);
}

function refreshPreview() {
  const current = shell?.querySelector('.experience-builder-preview');
  if (current) current.replaceWith(renderPreview());
}

function render() {
  if (!shell || !draft) return;
  const panel = el('section', { className: 'experience-builder-panel' });
  panel.append(
    el('header', { className: 'experience-builder-head' }, [el('div', {}, [el('h1', { text: 'Owner Experience Builder' }), el('p', { text: 'Edit live loaders, logos, homepage copy, and registered page content.' })]), el('button', { type: 'button', className: 'experience-builder-close', text: '×', attrs: { 'aria-label': 'Close' }, dataset: { experienceClose: 'true' } })]),
    el('nav', { className: 'experience-builder-tabs', attrs: { 'aria-label': 'Experience sections' } }, TABS.map((tab) => el('button', { type: 'button', className: tab === activeTab ? 'is-active' : '', text: tab, dataset: { experienceTab: tab } }))),
    renderFields(),
    el('footer', { className: 'experience-builder-actions' }, [
      el('button', { type: 'button', text: 'Save draft', disabled: busy, dataset: { experienceSave: 'true' } }),
      el('button', { type: 'button', text: 'Publish live', disabled: busy, dataset: { experiencePublish: 'true' } }),
      el('div', { className: 'experience-builder-status', text: busy ? 'Working…' : `Draft r${state?.draftRevision || 0} • Live v${state?.publishedVersion || 0}`, dataset: { experienceStatus: 'true' } })
    ])
  );
  shell.replaceChildren(panel, renderPreview());
}

function editablePatch() {
  const normalized = normalizeExperienceConfig(clone(draft));
  return clone({ brand: normalized.brand, loaderTheme: normalized.loaderTheme, loaders: normalized.loaders, home: normalized.home });
}

function setBusy(next, message = '') {
  busy = next;
  render();
  const status = shell?.querySelector('[data-experience-status]');
  if (status && message) status.textContent = message;
}

async function saveDraft() {
  setBusy(true, 'Saving secure draft…');
  try {
    state = await saveExperienceDraftPatch(editablePatch());
    draft = normalizeExperienceConfig(state.draft);
    window.EvaraExperience?.applyConfig?.(draft);
    setBusy(false, `Draft r${state.draftRevision} saved`);
  } catch (error) {
    setBusy(false, error.message || 'Unable to save the draft.');
  }
}

async function publish() {
  setBusy(true, 'Saving and publishing…');
  try {
    state = await saveExperienceDraftPatch(editablePatch());
    state = await publishExperienceDraft();
    draft = normalizeExperienceConfig(state.draft);
    setBusy(false, `Published live version ${state.publishedVersion}`);
  } catch (error) {
    setBusy(false, error.message || 'Unable to publish the experience.');
  }
}

async function handleUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  setBusy(true, 'Uploading brand asset…');
  try {
    const result = await uploadExperienceAsset(file);
    draft.brand.markUrl = result.url;
    window.EvaraExperience?.applyConfig?.(normalizeExperienceConfig(draft));
    setBusy(false, 'Logo uploaded. Save the draft, then publish it live.');
  } catch (error) {
    setBusy(false, error.message || 'Unable to upload that image.');
  }
}

function syncColorPeers(control) {
  if (!control.dataset.colorPeer) return;
  const path = control.dataset.experienceField;
  shell?.querySelectorAll(`[data-experience-field="${CSS.escape(path)}"]`).forEach((peer) => {
    if (peer !== control && /^#[0-9a-f]{6}$/i.test(control.value)) peer.value = control.value;
  });
}

function bindShell() {
  if (!shell || shell.dataset.bound === 'true') return;
  shell.dataset.bound = 'true';
  shell.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-experience-tab]');
    if (tab) { activeTab = TABS.includes(tab.dataset.experienceTab) ? tab.dataset.experienceTab : 'brand'; render(); return; }
    if (event.target.closest('[data-experience-close]')) { close(); return; }
    if (event.target.closest('[data-experience-save]')) { saveDraft(); return; }
    if (event.target.closest('[data-experience-publish]')) { publish(); return; }
    const preview = event.target.closest('[data-experience-preview]');
    if (preview) { previewMode = preview.dataset.experiencePreview; refreshPreview(); return; }
    if (event.target.closest('[data-experience-open-live-edit]')) location.assign('/index.html?ownerEdit=1');
  });
  shell.addEventListener('input', (event) => {
    const control = event.target.closest('[data-experience-field]');
    if (!control) return;
    const path = control.dataset.experienceField;
    let value = control.type === 'checkbox' ? control.checked : control.value;
    if (control.dataset.transform === 'seconds') value = Math.round(Number(value || 45) * 1000);
    else if (control.type === 'number') value = Number(value);
    setPath(draft, path, value);
    syncColorPeers(control);
    window.EvaraExperience?.applyConfig?.(normalizeExperienceConfig(draft));
    refreshPreview();
  });
  shell.addEventListener('change', (event) => {
    const upload = event.target.closest('[data-experience-upload]');
    if (upload) handleUpload(upload);
  });
}

async function open() {
  if (shell) return;
  shell = el('div', { className: 'experience-builder-shell', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Owner Experience Builder' } });
  document.body.append(shell);
  shell.textContent = 'Loading Owner Experience Builder…';
  bindShell();
  try {
    state = await loadExperienceEditorState({ force: true });
    draft = normalizeExperienceConfig(state.draft);
    render();
  } catch (error) {
    shell.textContent = error.message || 'Unable to load the Owner Experience Builder.';
  }
}

function close() {
  shell?.remove();
  shell = null;
  window.EvaraExperience?.refresh?.().catch(() => undefined);
}

function installLaunchButton() {
  if (!allowed()) return;
  const actions = document.querySelector('.studio-top-actions');
  if (!actions || actions.querySelector('[data-experience-builder-launch]')) return;
  const button = el('button', { type: 'button', className: 'experience-builder-launch', text: 'Experience', dataset: { experienceBuilderLaunch: 'true' } });
  button.addEventListener('click', open);
  actions.prepend(button);
}

function boot() {
  if (mounted || !allowed()) return;
  mounted = true;
  installLaunchButton();
  const observer = new MutationObserver(installLaunchButton);
  observer.observe(document.getElementById('appRoot') || document.body, { childList: true, subtree: true });
}

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500), { once: true });
else setTimeout(boot, 500);
