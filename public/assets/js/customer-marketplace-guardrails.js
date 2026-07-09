function applyMarketplaceGuardrails() {
  const panel = document.getElementById('customerMarketplacePanel');
  if (!panel || panel.dataset.guardrailsReady === 'true') return false;

  const phone = document.getElementById('marketplaceContactPhone');
  if (phone) {
    phone.readOnly = true;
    phone.setAttribute('aria-readonly', 'true');
    phone.title = 'Update this phone number in Customer information above.';
    const label = phone.closest('label');
    const labelText = label?.querySelector(':scope > span');
    if (labelText) labelText.textContent = 'Account phone';
  }

  const stateInput = document.getElementById('marketplaceState');
  stateInput?.addEventListener('input', () => {
    stateInput.value = stateInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  });

  panel.dataset.guardrailsReady = 'true';
  return true;
}

function startGuardrails() {
  if (applyMarketplaceGuardrails()) return;

  const observer = new MutationObserver(() => {
    if (applyMarketplaceGuardrails()) observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startGuardrails, { once: true });
} else {
  startGuardrails();
}
