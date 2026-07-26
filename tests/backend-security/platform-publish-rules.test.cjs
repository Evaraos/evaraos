const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where
} = require('firebase/firestore');

const projectId = `${process.env.GCLOUD_PROJECT || 'evaraos-web'}-platform-publish`;
const root = path.resolve(__dirname, '../..');
let env;

function user(uid, role, companyId = '', overrides = {}) {
  return {
    uid,
    id: uid,
    email: `${uid}@example.com`,
    role,
    companyId,
    status: 'active',
    approvalStatus: 'approved',
    platformAccess: false,
    ...overrides
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      user('ownerNoCompany', 'owner'),
      user('platformOwner', 'platform_admin'),
      user('adminA', 'admin', 'company-a'),
      user('adminB', 'admin', 'company-b'),
      user('pendingCustomer', 'customer', '', { status: 'pending', approvalStatus: 'pending' }),
      user('otherCustomer', 'customer', '', { status: 'pending', approvalStatus: 'pending' })
    ];
    for (const profile of users) await setDoc(doc(db, 'users', profile.uid), profile);

    await setDoc(doc(db, 'companies', 'company-a'), { name: 'Company A', appBuilder: { version: 1 } });
    await setDoc(doc(db, 'companies', 'company-b'), { name: 'Company B', appBuilder: { version: 1 } });

    await setDoc(doc(db, 'jobs', 'pending-own-job'), {
      customerUid: 'pendingCustomer',
      companyId: 'company-a',
      status: 'scheduled'
    });
    await setDoc(doc(db, 'jobs', 'other-job'), {
      customerUid: 'otherCustomer',
      companyId: 'company-b',
      status: 'scheduled'
    });
    await setDoc(doc(db, 'customer_service_history', 'pending-history'), {
      customerId: 'pendingCustomer',
      companyId: 'company-a',
      status: 'completed'
    });
  });
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8') }
  });
});

test.beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

test.after(async () => env.cleanup());

test('owner without a company can publish the global app builder', async () => {
  const db = env.authenticatedContext('ownerNoCompany').firestore();
  await assertSucceeds(setDoc(doc(db, 'public_app_config', 'global'), {
    appBuilder: { version: 2, scope: 'global', pages: { home: { text: { title: 'Owner controlled' } } } },
    appBuilderUpdatedAt: Date.now()
  }, { merge: true }));
  await assertSucceeds(getDoc(doc(db, 'public_app_config', 'global')));
});

test('platform owner can publish globally and admin cannot', async () => {
  const ownerDb = env.authenticatedContext('platformOwner').firestore();
  const adminDb = env.authenticatedContext('adminA').firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'public_app_config', 'global'), {
    appBuilder: { version: 2, scope: 'global' }
  }, { merge: true }));
  await assertFails(setDoc(doc(adminDb, 'public_app_config', 'global'), {
    appBuilder: { version: 99, scope: 'global' }
  }, { merge: true }));
});

test('admin can update only appBuilder fields on the assigned company', async () => {
  const adminDb = env.authenticatedContext('adminA').firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'companies', 'company-a'), {
    appBuilder: { version: 2, scope: 'company', pages: { dashboard: {} } },
    appBuilderUpdatedAt: Date.now()
  }, { merge: true }));

  await assertFails(setDoc(doc(adminDb, 'companies', 'company-a'), {
    name: 'Hijacked Company Name'
  }, { merge: true }));

  await assertFails(setDoc(doc(adminDb, 'companies', 'company-b'), {
    appBuilder: { version: 2 }
  }, { merge: true }));
});

test('pending customer can query own portal records but not enumerate or cross accounts', async () => {
  const db = env.authenticatedContext('pendingCustomer').firestore();
  await assertSucceeds(getDocs(query(
    collection(db, 'jobs'),
    where('customerUid', '==', 'pendingCustomer')
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'customer_service_history'),
    where('customerId', '==', 'pendingCustomer')
  )));
  await assertFails(getDocs(collection(db, 'jobs')));
  await assertFails(getDoc(doc(db, 'jobs', 'other-job')));
});
