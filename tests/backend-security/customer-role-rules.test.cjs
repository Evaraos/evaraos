const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} = require('firebase/firestore');

const projectId = `${process.env.GCLOUD_PROJECT || 'evaraos-web'}-customer-role`;
const root = path.resolve(__dirname, '../..');
let env;

const profile = (uid, overrides = {}) => ({
  uid,
  id: uid,
  email: `${uid}@example.com`,
  role: 'customer',
  status: 'active',
  approvalStatus: 'approved',
  companyId: '',
  ...overrides
});

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      profile('pendingCustomer', { status: 'pending', approvalStatus: 'pending' }),
      profile('activeCustomer'),
      profile('otherCustomer'),
      profile('suspendedCustomer', { status: 'suspended', approvalStatus: 'approved' }),
      profile('platformAdmin', { role: 'platform_admin', status: 'active', approvalStatus: 'approved', platformAccess: true })
    ];
    for (const user of users) await setDoc(doc(db, 'users', user.uid), user);

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
    await setDoc(doc(db, 'invoices', 'pending-own-invoice'), {
      customerUid: 'pendingCustomer',
      companyId: 'company-a',
      status: 'open'
    });
    await setDoc(doc(db, 'invoices', 'other-invoice'), {
      customerUid: 'otherCustomer',
      companyId: 'company-b',
      status: 'open'
    });
    await setDoc(doc(db, 'services', 'public-service'), {
      name: 'Public Service',
      isPublic: true,
      companyId: 'company-a'
    });
    await setDoc(doc(db, 'services', 'private-service'), {
      name: 'Private Service',
      isPublic: false,
      companyId: 'company-a'
    });
    await setDoc(doc(db, 'customer_notifications', 'pending-note'), {
      customerId: 'pendingCustomer',
      status: 'unread'
    });
  });
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8')
    }
  });
});

test.beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

test.after(async () => {
  await env.cleanup();
});

test('pending customer can open own portal data without crossing ownership boundaries', async () => {
  const db = env.authenticatedContext('pendingCustomer').firestore();

  await assertSucceeds(getDoc(doc(db, 'users', 'pendingCustomer')));
  await assertSucceeds(getDoc(doc(db, 'jobs', 'pending-own-job')));
  await assertSucceeds(getDoc(doc(db, 'invoices', 'pending-own-invoice')));
  await assertSucceeds(getDoc(doc(db, 'services', 'public-service')));
  await assertSucceeds(getDoc(doc(db, 'customer_notifications', 'pending-note')));

  await assertFails(getDoc(doc(db, 'jobs', 'other-job')));
  await assertFails(getDoc(doc(db, 'invoices', 'other-invoice')));
  await assertFails(getDoc(doc(db, 'services', 'private-service')));
});

test('customer portal ownership queries succeed while unrestricted enumeration fails', async () => {
  const db = env.authenticatedContext('pendingCustomer').firestore();

  await assertSucceeds(getDocs(query(
    collection(db, 'jobs'),
    where('customerUid', '==', 'pendingCustomer')
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'invoices'),
    where('customerUid', '==', 'pendingCustomer')
  )));
  await assertFails(getDocs(collection(db, 'jobs')));
  await assertFails(getDocs(collection(db, 'invoices')));
});

test('suspended customer remains blocked from owned business data', async () => {
  const db = env.authenticatedContext('suspendedCustomer').firestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'jobs', 'suspended-own-job'), {
      customerUid: 'suspendedCustomer',
      companyId: 'company-a',
      status: 'scheduled'
    });
  });
  await assertFails(getDoc(doc(db, 'jobs', 'suspended-own-job')));
});

test('stored platform_admin role is recognized by Firestore authority', async () => {
  const db = env.authenticatedContext('platformAdmin').firestore();
  await assertSucceeds(getDoc(doc(db, 'jobs', 'other-job')));
});
