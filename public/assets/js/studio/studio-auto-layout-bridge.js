document.addEventListener('dragstart', (event) => {
  const row = event.target.closest('[data-auto-node]');
  const nodeId = row?.dataset.autoNode;
  if (!nodeId || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/x-evara-studio-node', nodeId);
  event.dataTransfer.setData('text/plain', '');
  document.body.classList.add('studio-layout-dragging');
}, true);

document.addEventListener('dragend', () => {
  document.body.classList.remove('studio-layout-dragging');
  document.querySelectorAll('.is-auto-drop-target').forEach((item) => item.classList.remove('is-auto-drop-target'));
}, true);
