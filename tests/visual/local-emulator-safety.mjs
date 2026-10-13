const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

const FIREBASE_PRODUCTION_HOST_SOURCE = '(?:'
  + '(?:identitytoolkit|securetoken|firestore|firebasedatabase|firebasestorage|firebaseinstallations|firebaseappcheck|fcmregistrations|firebaseremoteconfig)\\.googleapis\\.com'
  + '|(?:[a-z0-9-]+\\.)?firebaseio\\.com'
  + '|(?:[a-z0-9-]+\\.)?firebasedatabase\\.app'
  + '|(?:[a-z0-9-]+\\.)?firebasestorage\\.app'
  + '|evaraos-web\\.(?:web\\.app|appspot\\.com)'
  + '|(?:[a-z0-9-]+\\.)?firebaseapp\\.com'
  + '|(?:[a-z0-9-]+\\.)*cloudfunctions\\.net'
  + ')';
const FIREBASE_PRODUCTION_HOST_PATTERN = new RegExp(`^${FIREBASE_PRODUCTION_HOST_SOURCE}$`, 'i');

export const FIREBASE_PRODUCTION_REQUEST_PATTERN = new RegExp(
  `^https?:\\/\\/${FIREBASE_PRODUCTION_HOST_SOURCE}(?::\\d+)?(?:[/?#]|$)`,
  'i'
);

export function isFirebaseProductionServiceHost(hostname = '') {
  return FIREBASE_PRODUCTION_HOST_PATTERN.test(String(hostname));
}

export async function installLocalFirebaseNetworkGuard(page, baseURL) {
  const host = new URL(baseURL).hostname;
  if (!LOOPBACK_HOSTS.has(host)) return false;

  await page.route(FIREBASE_PRODUCTION_REQUEST_PATTERN, async (route) => {
    await route.abort('blockedbyclient');
  });
  return true;
}
