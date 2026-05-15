export function getMapsApiKey() {
  return window.EVARAOS_MAPS_CONFIG?.googleMapsApiKey || window.EVARAOS_MAPS_CONFIG?.apiKey || '';
}

let mapsPromise = null;

export function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const key = getMapsApiKey();

    if (!key) {
      reject(new Error('Missing Google Maps config. Add a runtime Google Maps API key.'));
      return;
    }

    const existing = document.querySelector('script[data-evaraos-maps="true"]');

    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.evaraosMaps = 'true';
    script.async = true;
    script.defer = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key);
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });

  return mapsPromise;
}
