const selectedCard = document.getElementById('selectedMapCard');
const selectedActions = selectedCard?.querySelector('.map-selected-actions');
const nearbyList = document.getElementById('nearbyList');

let manageLink = document.getElementById('selectedMapManage');

function routeForRecord(kind, id) {
  const encodedId = encodeURIComponent(id || '');
  if (kind === 'lead') return `/leads.html?focus=${encodedId}`;
  if (kind === 'job') return `/jobs.html?focus=${encodedId}`;
  if (kind === 'staff') return `/users.html?focus=${encodedId}`;
  return '/dashboard.html';
}

function ensureManageLink() {
  if (manageLink || !selectedActions) return manageLink;
  manageLink = document.createElement('a');
  manageLink.id = 'selectedMapManage';
  manageLink.className = 'map-manage-record';
  manageLink.textContent = 'Manage';
  manageLink.hidden = true;
  const directions = document.getElementById('selectedMapDirections');
  selectedActions.insertBefore(manageLink, directions || selectedActions.firstChild);
  return manageLink;
}

function syncManageLink() {
  const link = ensureManageLink();
  if (!link) return;

  const active = nearbyList?.querySelector('[data-record-key][aria-pressed="true"]');
  const key = active?.getAttribute('data-record-key') || '';
  const divider = key.indexOf(':');

  if (divider < 1) {
    link.hidden = true;
    link.removeAttribute('href');
    return;
  }

  const kind = key.slice(0, divider);
  const id = key.slice(divider + 1);
  link.href = routeForRecord(kind, id);
  link.textContent = kind === 'staff' ? 'Open user' : kind === 'lead' ? 'Manage lead' : 'Manage job';
  link.hidden = false;
}

if (selectedCard && nearbyList) {
  const observer = new MutationObserver(syncManageLink);
  observer.observe(nearbyList, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed']
  });
  observer.observe(selectedCard, {
    attributes: true,
    attributeFilter: ['data-visible']
  });
  syncManageLink();
}
