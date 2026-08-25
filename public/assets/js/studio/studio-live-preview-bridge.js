const PROTOCOL = 'evara:studio-preview:';
const PROTOCOL_VERSION = 1;
const ORIGIN = window.location.origin;
const EDIT_SLOT_CONFIG = Object.freeze({
  'home.hero.kicker': Object.freeze({ maxLength: 180, experienceControlled: true, linePolicy: 'single' }),
  'home.hero.title': Object.freeze({ maxLength: 260, experienceControlled: true, linePolicy: 'single' }),
  'home.hero.subtitle': Object.freeze({ maxLength: 1200, experienceControlled: true, linePolicy: 'single' }),
  'home.platform.heading': Object.freeze({ maxLength: 180, experienceControlled: false, linePolicy: 'single' }),
  'home.platform.copy': Object.freeze({ maxLength: 1200, experienceControlled: false, linePolicy: 'single' })
});
const EDIT_SLOT_IDS = new Set(Object.keys(EDIT_SLOT_CONFIG));

const params = new URLSearchParams(window.location.search);
const nonce = params.get('studioNonce') || '';
const requestedPreview = params.get('studioPreview') === 'edit';
const validNonce = /^[A-Za-z0-9_-]{32,128}$/.test(nonce);

function hasAuthorizedParent() {
  if (!requestedPreview || !validNonce || window.parent === window) return false;
  try {
    return window.parent.location.origin === ORIGIN
      && window.parent.location.pathname === '/website-builder.html';
  } catch {
    return false;
  }
}

function message(type, extra = {}) {
  return { type: `${PROTOCOL}${type}`, protocolVersion: PROTOCOL_VERSION, nonce, ...extra };
}

function editableTarget(target) {
  if (!(target instanceof Element)) return null;
  const element = target.closest('[data-evara-page="home"][data-evara-editable="text"][data-evara-region="content"][data-evara-edit-id]');
  if (!element || !EDIT_SLOT_IDS.has(element.dataset.evaraEditId || '')) return null;
  return element;
}

function slotForElement(element) {
  return EDIT_SLOT_CONFIG[element?.dataset.evaraEditId || ''] || null;
}

function isProtectedAction(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('a, button, input, select, textarea, form, [role="button"], #universalNavRoot, .eva-bottom-nav, [data-eva-shell-motion]'));
}

function createSelectionOverlay() {
  const outline = document.createElement('div');
  outline.className = 'evara-studio-preview-outline';
  outline.hidden = true;
  outline.setAttribute('aria-hidden', 'true');
  const label = document.createElement('div');
  label.className = 'evara-studio-preview-label';
  label.hidden = true;
  label.setAttribute('aria-hidden', 'true');
  document.body.append(outline, label);
  return { outline, label };
}

function normalizeSlotText(value, slot) {
  const source = String(value ?? '');
  const normalized = slot.linePolicy === 'single'
    ? source
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    : source;
  return Array.from(normalized)
    .slice(0, slot.maxLength)
    .join('');
}

function focusWithoutScroll(element) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function setCaretToEnd(element) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectionInside(element) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const contains = (node) => node === element
    || (node.nodeType === Node.ELEMENT_NODE ? element.contains(node) : element.contains(node.parentElement));
  return contains(range.startContainer) && contains(range.endContainer) ? range : null;
}

function rawTextAfterInsertion(element, text) {
  const current = Array.from(element.textContent || '');
  const range = selectionInside(element);
  if (!range) return `${current.join('')}${text}`;
  const before = range.cloneRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  const after = range.cloneRange();
  after.selectNodeContents(element);
  after.setStart(range.endContainer, range.endOffset);
  const start = Array.from(before.toString()).length;
  const end = current.length - Array.from(after.toString()).length;
  return [...current.slice(0, start), ...Array.from(text), ...current.slice(end)].join('');
}

function textAfterInsertion(element, text, slot) {
  return normalizeSlotText(rawTextAfterInsertion(element, text), slot);
}

function setPlainText(element, value, slot, placeCaret = false) {
  const normalized = normalizeSlotText(value, slot);
  const hasSingleTextNode = element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE;
  if (element.textContent !== normalized || !hasSingleTextNode) element.textContent = normalized;
  if (placeCaret) setCaretToEnd(element);
  return normalized;
}

function activatePreview(initialDrafts = {}) {
  let selected = null;
  let activeEdit = null;
  let composing = false;
  let pendingRebind = false;
  let pendingExperienceRebind = false;
  const drafts = new Map();
  const overlay = createSelectionOverlay();

  for (const [editId, slot] of Object.entries(EDIT_SLOT_CONFIG)) {
    const draft = initialDrafts?.[editId];
    if (draft && typeof draft.value === 'string') drafts.set(editId, normalizeSlotText(draft.value, slot));
  }

  const positionOverlay = () => {
    if (!selected) return;
    const rect = selected.getBoundingClientRect();
    overlay.outline.style.left = `${rect.left}px`;
    overlay.outline.style.top = `${rect.top}px`;
    overlay.outline.style.width = `${rect.width}px`;
    overlay.outline.style.height = `${rect.height}px`;
    overlay.label.style.left = `${rect.left}px`;
    overlay.label.style.top = `${Math.max(8, rect.top - 27)}px`;
  };

  const select = (element) => {
    if (activeEdit && element !== activeEdit.element) return;
    selected = element;
    overlay.label.textContent = element.dataset.evaraEditId || '';
    overlay.outline.hidden = false;
    overlay.label.hidden = false;
    positionOverlay();
    if (slotForElement(element)) {
      element.tabIndex = 0;
      focusWithoutScroll(element);
    }
    window.parent.postMessage(message('selection', { editId: element.dataset.evaraEditId, editable: 'text' }), ORIGIN);
  };

  const sendDraft = (element) => {
    const editId = element.dataset.evaraEditId || '';
    const slot = slotForElement(element);
    if (!slot) return '';
    const value = setPlainText(element, element.textContent || '', slot);
    drafts.set(editId, value);
    window.parent.postMessage(message('edit-draft', {
      elementId: editId,
      value
    }), ORIGIN);
    return value;
  };

  const finishEditing = (outcome) => {
    if (!activeEdit) return;
    const session = activeEdit;
    activeEdit = null;
    composing = false;
    delete session.element.dataset.evaraStudioEditing;
    session.element.removeAttribute('contenteditable');
    if (session.ariaLabel === null) session.element.removeAttribute('aria-label');
    else session.element.setAttribute('aria-label', session.ariaLabel);
    overlay.label.textContent = session.element.dataset.evaraEditId || '';
    positionOverlay();

    if (outcome === 'cancel') {
      drafts.set(session.editId, session.originalText);
      setPlainText(session.element, session.originalText, session.slot);
      window.parent.postMessage(message('edit-cancel', {
        elementId: session.editId,
        value: session.originalText
      }), ORIGIN);
      return;
    }

    const value = setPlainText(session.element, session.element.textContent || '', session.slot);
    drafts.set(session.editId, value);
    window.parent.postMessage(message('edit-commit', {
      elementId: session.editId,
      value
    }), ORIGIN);
  };

  const startEditing = (element) => {
    const editId = element?.dataset.evaraEditId || '';
    const slot = slotForElement(element);
    if (activeEdit || !slot || selected !== element) return;
    const originalText = setPlainText(element, element.textContent || '', slot);
    drafts.set(editId, originalText);
    activeEdit = {
      element,
      editId,
      slot,
      originalText,
      ariaLabel: element.getAttribute('aria-label')
    };
    element.dataset.evaraStudioEditing = 'true';
    element.setAttribute('contenteditable', 'plaintext-only');
    element.setAttribute('aria-label', `Editing ${editId}. Press Enter to save or Escape to cancel.`);
    overlay.label.textContent = `Editing · ${editId}`;
    positionOverlay();
    focusWithoutScroll(element);
    setCaretToEnd(element);
    window.parent.postMessage(message('edit-started', { elementId: editId, value: originalText }), ORIGIN);
  };

  const resolveSlotElement = (editId) => editableTarget(document.querySelector(`[data-evara-edit-id="${editId}"]`));

  const reapplyDrafts = (experienceControlledOnly = false) => {
    if (activeEdit && resolveSlotElement(activeEdit.editId) !== activeEdit.element) finishEditing('commit');

    const selectedId = selected?.dataset.evaraEditId || '';
    if (selectedId && EDIT_SLOT_IDS.has(selectedId)) {
      selected = resolveSlotElement(selectedId);
      if (!selected) {
        overlay.outline.hidden = true;
        overlay.label.hidden = true;
      }
    }

    for (const [editId, slot] of Object.entries(EDIT_SLOT_CONFIG)) {
      if (experienceControlledOnly && !slot.experienceControlled) continue;
      const draft = drafts.get(editId);
      if (draft === undefined) continue;
      const element = resolveSlotElement(editId);
      if (!element || (activeEdit?.element === element && composing)) continue;
      if (element.textContent !== draft) setPlainText(element, draft, slot, activeEdit?.element === element);
      if (selected === null || selected === element) {
        selected = element;
        positionOverlay();
      }
    }
  };

  window.addEventListener('click', (event) => {
    const element = editableTarget(event.target);
    if (element) {
      if (activeEdit?.element === element) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (activeEdit) finishEditing('commit');
      select(element);
      return;
    }
    if (isProtectedAction(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('dblclick', (event) => {
    const element = editableTarget(event.target);
    if (!element) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (activeEdit && activeEdit.element !== element) finishEditing('commit');
    if (selected !== element) select(element);
    startEditing(element);
  }, true);

  window.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (activeEdit?.element === event.target || activeEdit?.element.contains(event.target)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        finishEditing('cancel');
        return;
      }
      if (event.key === 'Enter' && !composing && !event.isComposing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        finishEditing('commit');
        return;
      }
      return;
    }
    if (event.key === 'Enter' && selected === event.target && slotForElement(selected)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startEditing(selected);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && isProtectedAction(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('beforeinput', (event) => {
    if (!activeEdit || event.target !== activeEdit.element) return;
    if ((event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') && !composing) {
      event.preventDefault();
      finishEditing('commit');
      return;
    }
    if (event.inputType === 'insertText' && typeof event.data === 'string' && !composing) {
      const slot = activeEdit.slot;
      const rawNext = rawTextAfterInsertion(activeEdit.element, event.data);
      const next = textAfterInsertion(activeEdit.element, event.data, slot);
      if (Array.from(rawNext).length > slot.maxLength) {
        event.preventDefault();
        setPlainText(activeEdit.element, next, slot, true);
        sendDraft(activeEdit.element);
      }
    }
  }, true);

  window.addEventListener('paste', (event) => {
    if (!activeEdit || event.target !== activeEdit.element) return;
    event.preventDefault();
    const plainText = event.clipboardData?.getData('text/plain') || '';
    const next = textAfterInsertion(activeEdit.element, plainText, activeEdit.slot);
    setPlainText(activeEdit.element, next, activeEdit.slot, true);
    sendDraft(activeEdit.element);
  }, true);

  window.addEventListener('compositionstart', (event) => {
    if (activeEdit?.element === event.target) composing = true;
  }, true);

  window.addEventListener('compositionend', (event) => {
    if (activeEdit?.element !== event.target) return;
    composing = false;
    sendDraft(activeEdit.element);
    if (pendingRebind) {
      pendingRebind = false;
      const experienceOnly = pendingExperienceRebind;
      pendingExperienceRebind = false;
      reapplyDrafts(experienceOnly);
    }
  }, true);

  window.addEventListener('input', (event) => {
    if (activeEdit?.element !== event.target || composing) return;
    sendDraft(activeEdit.element);
  }, true);

  window.addEventListener('focusout', (event) => {
    if (activeEdit?.element === event.target) finishEditing('commit');
  }, true);

  const scheduleRebind = (experienceControlledOnly = false) => {
    pendingExperienceRebind ||= experienceControlledOnly;
    if (pendingRebind) return;
    pendingRebind = true;
    requestAnimationFrame(() => {
      pendingRebind = false;
      if (composing) {
        pendingRebind = true;
        return;
      }
      const experienceOnly = pendingExperienceRebind;
      pendingExperienceRebind = false;
      reapplyDrafts(experienceOnly);
    });
  };

  window.addEventListener('evara:experience-applied', () => scheduleRebind(true));
  new MutationObserver(() => scheduleRebind()).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', positionOverlay);
  window.addEventListener('scroll', positionOverlay, true);
  reapplyDrafts();
}

if (hasAuthorizedParent()) {
  const onMessage = (event) => {
    const data = event.data;
    if (event.origin !== ORIGIN || event.source !== window.parent || !data || typeof data !== 'object') return;
    if (data.type !== `${PROTOCOL}activate` || data.protocolVersion !== PROTOCOL_VERSION || data.nonce !== nonce) return;
    window.removeEventListener('message', onMessage);
    activatePreview(data.drafts);
  };
  window.addEventListener('message', onMessage);
  window.parent.postMessage(message('ready', { page: 'home' }), ORIGIN);
}
