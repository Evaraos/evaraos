const app = document.querySelector('.messages-app');
const conversationList = document.getElementById('conversationList');
const backButton = document.getElementById('showConversationList');
let userOpenedConversation = false;

function isCompactLayout() {
  return window.matchMedia('(max-width: 800px)').matches;
}

function enterConversation() {
  userOpenedConversation = true;
  document.body.classList.add('messages-chat-active');
  app?.classList.remove('show-list');
  document.documentElement.dataset.messagesView = 'chat';
}

function leaveConversation() {
  userOpenedConversation = false;
  document.body.classList.remove('messages-chat-active');
  app?.classList.add('show-list');
  document.documentElement.dataset.messagesView = 'center';
}

function enforceMessageCenter() {
  if (userOpenedConversation || document.body.classList.contains('messages-chat-active')) return;
  document.documentElement.dataset.messagesView = 'center';
  if (isCompactLayout()) app?.classList.add('show-list');
}

function initializeMessagesView() {
  userOpenedConversation = false;
  document.body.classList.remove('messages-chat-active');
  document.documentElement.dataset.messagesView = 'center';
  if (isCompactLayout()) app?.classList.add('show-list');
}

conversationList?.addEventListener('click', (event) => {
  if (!event.target.closest('[data-conversation]')) return;
  enterConversation();
});

backButton?.addEventListener('click', leaveConversation);

window.addEventListener('popstate', () => {
  if (document.body.classList.contains('messages-chat-active')) leaveConversation();
});
window.addEventListener('pageshow', initializeMessagesView);
window.addEventListener('evara:session-ready', enforceMessageCenter);
window.addEventListener('resize', enforceMessageCenter, { passive: true });

/* messages-v2 selects the first available conversation while hydrating. Keep
   that background selection from forcing mobile users into a random chat. */
if (app) {
  new MutationObserver(enforceMessageCenter).observe(app, {
    attributes: true,
    attributeFilter: ['class']
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMessagesView, { once: true });
} else {
  initializeMessagesView();
}
