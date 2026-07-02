const app = document.querySelector('.messages-app');
const list = document.getElementById('conversationList');
const back = document.getElementById('showConversationList');

function showCenter() {
  document.body.classList.remove('messages-chat-active');
  app?.classList.add('show-list');
  document.documentElement.dataset.messagesView = 'center';
}

function showChat() {
  document.body.classList.add('messages-chat-active');
  app?.classList.remove('show-list');
  document.documentElement.dataset.messagesView = 'chat';
}

list?.addEventListener('click', (event) => {
  if (event.target.closest('[data-conversation]')) showChat();
});
back?.addEventListener('click', showCenter);
window.addEventListener('pageshow', showCenter);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showCenter, { once: true });
} else {
  showCenter();
}
