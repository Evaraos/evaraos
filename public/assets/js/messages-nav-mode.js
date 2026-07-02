const app = document.querySelector('.messages-app');
const conversationList = document.getElementById('conversationList');
const backButton = document.getElementById('showConversationList');

function isCompactLayout() {
  return window.matchMedia('(max-width: 800px)').matches;
}

function enterConversation() {
  document.body.classList.add('messages-chat-active');
  app?.classList.remove('show-list');
  document.documentElement.dataset.messagesView = 'chat';
}

function leaveConversation() {
  document.body.classList.remove('messages-chat-active');
  app?.classList.add('show-list');
  document.documentElement.dataset.messagesView = 'center';
}

function initializeMessagesView() {
  document.body.classList.remove('messages-chat-active');
  document.documentElement.dataset.messagesView = 'center';
  if (isCompactLayout()) app?.classList.add('show-list');
}

conversationList?.addEventListener('click', (event) => {
  if (!event.target.closest('[data-conversation]')) return;
  enterConversation();
});

backButton?.addEventListener('click', () => {
  leaveConversation();
});

window.addEventListener('popstate', () => {
  if (document.body.classList.contains('messages-chat-active')) leaveConversation();
});

window.addEventListener('pageshow', initializeMessagesView);
window.addEventListener('resize', () => {
  if (!document.body.classList.contains('messages-chat-active') && isCompactLayout()) {
    app?.classList.add('show-list');
  }
}, { passive: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMessagesView, { once: true });
} else {
  initializeMessagesView();
}
