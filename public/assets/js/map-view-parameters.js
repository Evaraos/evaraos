const params = new URLSearchParams(window.location.search);
const allowedTypes = new Set(['all', 'lead', 'job', 'staff']);
const allowedRadii = new Set(['5', '15', '30', '50', 'all']);

const requestedType = params.get('type');
const requestedRadius = params.get('radius');
const requestedSearch = params.get('search');

const typeFilter = document.getElementById('mapTypeFilter');
const radiusFilter = document.getElementById('mapRadiusFilter');
const searchInput = document.getElementById('mapSearch');

if (typeFilter && allowedTypes.has(requestedType || '')) {
  typeFilter.value = requestedType;
  document.documentElement.dataset.mapRecordType = requestedType;
}

if (radiusFilter && allowedRadii.has(requestedRadius || '')) {
  radiusFilter.value = requestedRadius;
}

if (searchInput && requestedSearch) {
  searchInput.value = requestedSearch.slice(0, 120);
}

const forwardParameters = new URLSearchParams();
if (allowedTypes.has(requestedType || '')) forwardParameters.set('type', requestedType);
if (allowedRadii.has(requestedRadius || '')) forwardParameters.set('radius', requestedRadius);
if (requestedSearch) forwardParameters.set('search', requestedSearch.slice(0, 120));

const suffix = forwardParameters.toString();
document.querySelectorAll('[data-map-expand], [data-map-compact]').forEach((link) => {
  const url = new URL(link.getAttribute('href'), window.location.origin);
  forwardParameters.forEach((value, key) => url.searchParams.set(key, value));
  link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
});

if (suffix) document.documentElement.dataset.mapViewParameters = suffix;
