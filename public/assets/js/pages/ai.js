const form = document.getElementById('evaAiPageForm');
const input = document.getElementById('evaAiPageInput');
const thread = document.getElementById('evaAiThread');
const suggestions = document.querySelectorAll('[data-ai-prompt]');
const welcome = document.getElementById('evaAiWelcome');
const newChat = document.getElementById('evaAiNewChat');

let messageCount = 0;
let thinkingCard = null;

function autoGrow() {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

function collapseWelcome() {
  document.body.classList.add('eva-ai-chat-active');
  welcome?.setAttribute('aria-hidden', 'true');
}

function restoreWelcome() {
  document.body.classList.remove('eva-ai-chat-active');
  welcome?.removeAttribute('aria-hidden');
}

function scrollToLatest(node) {
  requestAnimationFrame(() => {
    node?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

  if (normalized.includes('lead')) return 'For leads, the cleanest next move is connecting lead capture, assigned rep, source, map status, and follow-up reminders into one live pipeline.';
  if (normalized.includes('customer')) return 'For customers, the strongest build is service history, messaging, booking status, invoices, photos, subscriptions, and support in one private portal.';
  if (normalized.includes('build')) return 'Next build priority: lock role dashboards, finish clean auth, connect Firebase live data, then add AI command actions that can open and explain every page.';
  if (normalized.includes('settings')) return 'Settings should control profile, security, theme, company access, notification preferences, role visibility, and future AI memory permissions.';
  if (normalized.includes('dashboard')) return 'Dashboard hierarchy should scale by access level: customers see their portal, staff see work, managers see departments, admins see operations, and owner sees everything.';
  if (normalized.includes('operation')) return 'Operations should center around jobs, leads, dispatch, map visibility, crew status, customer updates, and completion proof.';

  return 'I’m ready. Tell me what part of Evaraos you want to build, fix, open, or improve next.';
}

function submitPrompt(promptText) {
  const value = String(promptText || input?.value || '').trim();
  if (!value) return;

  messageCount += 1;
  collapseWelcome();
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
  }, 520);
}

function resetChat() {
  if (!thread) return;
  messageCount = 0;
  removeThinking();
  thread.innerHTML = '';
  appendMessage('assistant', 'Fresh workspace opened. What do you want to build, fix, or run next?');
  restoreWelcome();
  if (input) {
    input.value = '';
    autoGrow();
    input.focus({ preventScroll: true });
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitPrompt();
});

input?.addEventListener('input', autoGrow);

input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitPrompt();
  }
});

suggestions.forEach((button) => {
  button.addEventListener('click', () => submitPrompt(button.dataset.aiPrompt || ''));
});

newChat?.addEventListener('click', resetChat);

autoGrow();
