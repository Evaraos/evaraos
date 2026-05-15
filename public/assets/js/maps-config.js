window.EVARAOS_MAPS_CONFIG = {
  get googleMapsApiKey() {
    return (
      window.__EVARAOS_GOOGLE_MAPS_API_KEY__ ||
      document.querySelector('meta[name="google-maps-api-key"]')?.getAttribute("content") ||
      ""
    );
  }
};
