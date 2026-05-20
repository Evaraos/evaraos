const form = document.getElementById('evaAiPageForm');
const input = document.getElementById('evaAiPageInput');
const thread = document.getElementById('evaAiThread');
const suggestions = document.querySelectorAll('[data-ai-prompt]');
const newChat = document.getElementById('evaAiNewChat');

let thinkingCard = null;

function autoGrow() {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
}

function scrollToLatest(node) {
  requestAnimationFrame(() => node?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
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

  scrollToLatest(card);
  return card;
}

function showThinking() {
  removeThinking();
  thinkingCard = appendMessage('assistant', 'Thinking', { loading: true });
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
  return 'I’m ready. Tell me what part of Evaraos you want to build, fix, open, or improve next.';
}

function submitPrompt(promptText) {
  const value = String(promptText || input?.value || '').trim();
  if (!value) return;

  appendMessage('user', value);

  if (input) {
    input.value = '';
    autoGrow();
    input.focus({ preventScroll: true });
  }

  showThinking();
  window.setTimeout(() => {
    removeThinking();
    appendMessage('assistant', fakeAiResponse(value));
  }, 460);
}

function resetChat() {
  if (!thread) return;
  removeThinking();
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

input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    submitPrompt();
  }
});

suggestions.forEach((button) => button.addEventListener('click', () => submitPrompt(button.dataset.aiPrompt || '')));
newChat?.addEventListener('click', resetChat);

autoGrow();
