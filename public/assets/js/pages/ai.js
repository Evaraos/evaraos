const form = document.getElementById('evaAiPageForm');
const input = document.getElementById('evaAiPageInput');
const thread = document.getElementById('evaAiThread');
const suggestions = document.querySelectorAll('[data-ai-prompt]');
const newChat = document.getElementById('evaAiNewChat');

let thinkingCard = null;
let submitLock = false;

function markReady() {
  document.body?.classList.remove('app-loading');
  document.body?.classList.add('app-ready');
  window.EvaraLoader?.markAppReady?.();
  window.dispatchEvent(new CustomEvent('evara:session-ready', {
    detail: { source: 'ai-page', mode: 'public', at: Date.now() }
  }));
}

function autoGrow() {
  if (!input) return;
  input.style.height = 'auto';
  const nextHeight = Math.min(input.scrollHeight, 128);
  input.style.height = `${nextHeight}px`;
  document.documentElement.style.setProperty('--ai-input-height', `${nextHeight}px`);
}

function scrollToLatest(node, behavior = 'auto') {
  if (!node) return;
  requestAnimationFrame(() => {
    try {
      node.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' });
    } catch {
      window.scrollTo({ top: document.body.scrollHeight, behavior });
    }
  });
}

function appendMessage(role, text, options = {}) {
  if (!thread || !String(text || '').trim()) return null;

  const card = document.createElement('article');
  card.className = `eva-ai-message-card ${role}`;
  if (options.loading) card.classList.add('is-thinking');

  const avatar = document.createElement('div');
  avatar.className = 'eva-ai-avatar';
  avatar.textContent = role === 'user' ? 'You' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'eva-ai-bubble';

  const p = document.createElement('p');
  p.textContent = text;

  bubble.appendChild(p);
  card.appendChild(avatar);
  card.appendChild(bubble);
  thread.appendChild(card);

  scrollToLatest(card, options.smooth ? 'smooth' : 'auto');
  return card;
}

function showThinking() {
  removeThinking();
  thinkingCard = appendMessage('assistant', 'Thinking...', { loading: true });
}

function removeThinking() {
  thinkingCard?.remove?.();
  thinkingCard = null;
}

function fakeAiResponse(prompt) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('lead')) return 'For leads, connect capture, assigned rep, source, map status, and follow-up reminders into one live pipeline.';
  if (normalized.includes('customer')) return 'For customers, build service history, messaging, invoices, photos, subscriptions, and support into one private portal.';
  if (normalized.includes('dashboard')) return 'Dashboard hierarchy should scale by access level: customer, staff, manager, admin, owner.';
  if (normalized.includes('settings')) return 'Settings should control profile, security, theme, company access, alerts, role visibility, and future AI memory permissions.';
  if (normalized.includes('build')) return 'Next build priority: finalize role dashboards, connect Firebase live data, then add AI command actions.';
  if (normalized.includes('ui') || normalized.includes('spacing')) return 'For UI polish, prioritize one shared page shell, stable nav spacing, consistent glass cards, and mobile-safe composer spacing.';
  return 'I’m ready. Tell me what part of Evaraos you want to build, fix, open, or improve next.';
}

function setBusy(isBusy) {
  submitLock = Boolean(isBusy);
  form?.classList.toggle('is-busy', submitLock);
}

function submitPrompt(promptText) {
  if (submitLock) return;

  const value = String(promptText || input?.value || '').trim();
  if (!value) return;

  setBusy(true);
  appendMessage('user', value, { smooth: false });

  if (input) {
    input.value = '';
    autoGrow();
    input.focus({ preventScroll: true });
  }

  showThinking();
  window.setTimeout(() => {
    removeThinking();
    appendMessage('assistant', fakeAiResponse(value), { smooth: false });
    setBusy(false);
  }, 360);
}

function resetChat() {
  if (!thread) return;
  removeThinking();
  setBusy(false);
  thread.innerHTML = '';
  appendMessage('assistant', 'Fresh workspace opened. What do you want to build, fix, or run next?');
  if (input) {
    input.value = '';
    autoGrow();
    input.focus({ preventScroll: true });
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopPropagation();
  submitPrompt();
});

input?.addEventListener('input', autoGrow);

input?.addEventListener('focus', () => {
  document.body?.classList.add('ai-keyboard-active');
  window.setTimeout(() => scrollToLatest(thread?.lastElementChild), 90);
});

input?.addEventListener('blur', () => {
  window.setTimeout(() => document.body?.classList.remove('ai-keyboard-active'), 120);
});

input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    submitPrompt();
  }
});

suggestions.forEach((button) => button.addEventListener('click', () => submitPrompt(button.dataset.aiPrompt || '')));
newChat?.addEventListener('click', resetChat);

window.addEventListener('pageshow', markReady, { once: true });
window.addEventListener('load', markReady, { once: true });

autoGrow();
markReady();
