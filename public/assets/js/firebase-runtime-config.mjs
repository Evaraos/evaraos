const PRODUCTION_FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.firebasestorage.app",
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f",
  measurementId: "G-296N94CKPR"
});

export const FIREBASE_EMULATOR_PROJECT_ID = "demo-evaraos-ui";

export function isFirebaseEmulatorHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function createFirebaseRuntimeConfig(hostname) {
  if (!isFirebaseEmulatorHost(hostname)) return { ...PRODUCTION_FIREBASE_CONFIG };

  return {
    apiKey: "demo-api-key",
    authDomain: "localhost",
    projectId: FIREBASE_EMULATOR_PROJECT_ID,
    storageBucket: `${FIREBASE_EMULATOR_PROJECT_ID}.appspot.com`,
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:demo-evaraos-ui"
  };
}
