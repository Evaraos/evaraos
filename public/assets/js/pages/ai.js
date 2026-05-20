const form = document.getElementById('evaAiPageForm');
const input = document.getElementById('evaAiPageInput');
const thread = document.getElementById('evaAiThread');
const suggestions = document.querySelectorAll('[data-ai-prompt]');

function autoGrow() {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 142)}px`;
}

function appendMessage(role, text) {
  if (!thread || !text?.trim()) return;

  const card = document.createElement('article');
  card.className = `eva-ai-message-card ${role}`;

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

  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

function fakeAiResponse(prompt) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes('lead')) {
    return 'Lead visibility, routing, and sales operations are being expanded through the Operations layer.';
  }

  if (normalized.includes('customer')) {
    return 'Customer architecture includes service history, messaging, invoices, notifications, and future subscriptions.';
  }

  if (normalized.includes('build')) {
    return 'Next recommended milestone: finalize dashboard hierarchy, AI routing, and Firebase live data synchronization.';
  }

  if (normalized.includes('settings')) {
    return 'Settings architecture controls themes, permissions, alerts, organization visibility, and account management.';
  }

  return 'Evaraos AI is still being expanded. More operational intelligence and workspace memory are coming soon.';
}

function submitPrompt(promptText) {
  const value = String(promptText || input?.value || '').trim();
  if (!value) return;

  appendMessage('user', value);

  if (input) {
    input.value = '';
    autoGrow();
  }

  window.setTimeout(() => {
    appendMessage('assistant', fakeAiResponse(value));
  }, 420);
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
  button.addEventListener('click', () => {
    submitPrompt(button.dataset.aiPrompt || '');
  });
});

autoGrow();
