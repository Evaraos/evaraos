import { before, after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getBytes } from 'firebase/storage';

const PROJECT_ID = 'evaraos-security-test';
let env;

const profiles = Object.freeze({
  platform: { uid: 'platform', role: 'super_admin', companyId: '' },
  ownerA: { uid: 'owner-a', role: 'owner', companyId: 'company-a' },
  ownerB: { uid: 'owner-b', role: 'owner', companyId: 'company-b' },
  managerA: { uid: 'manager-a', role: 'manager', companyId: 'company-a' },
  techA: { uid: 'tech-a', role: 'technician', companyId: 'company-a' },
  techA2: { uid: 'tech-a2', role: 'technician', companyId: 'company-a' },
  customerA: { uid: 'customer-a', role: 'customer', companyId: 'company-a' }
});

function storageFor(profile) {
  return getStorage(env.authenticatedContext(profile.uid).app);
}

async function seedFirestore() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const profile of Object.values(profiles)) {
      await setDoc(doc(db, 'users', profile.uid), {
        ...profile,
        id: profile.uid,
        status: 'active',
        approvalStatus: 'approved'
      });
    }

    await setDoc(doc(db, 'jobs', 'job-a-assigned'), {
      companyId: 'company-a',
      customerUid: 'customer-a',
      assignedToUid: 'tech-a',
      status: 'scheduled'
    });
    await setDoc(doc(db, 'jobs', 'job-a-unassigned'), {
      companyId: 'company-a',
      customerUid: 'customer-a',
      status: 'scheduled'
    });
    await setDoc(doc(db, 'jobs', 'job-b'), {
      companyId: 'company-b',
      status: 'scheduled'
    });

    await setDoc(doc(db, 'channels/_group_registry/messages/channel-a'), {
      companyId: 'company-a',
      createdByUid: 'owner-a',
      memberUids: ['owner-a', 'tech-a'],
      adminUids: ['owner-a'],
      allowedRoles: ['owner', 'technician']
    });
  });
}

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const imageMetadata = { contentType: 'image/png' };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('../firebase/firestore.zero-trust.rules', 'utf8')
    },
    storage: {
      rules: readFileSync('../firebase/storage.zero-trust.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedFirestore();
});

after(async () => {
  await env?.cleanup();
});

test('tenant owner may upload only to their company folder', async () => {
  const storage = storageFor(profiles.ownerA);
  await assertSucceeds(uploadBytes(ref(storage, 'companies/company-a/logo.png'), pngBytes, imageMetadata));
  await assertFails(uploadBytes(ref(storage, 'companies/company-b/logo.png'), pngBytes, imageMetadata));
});

test('assigned technician may upload job proof while unrelated technician is denied', async () => {
  const assignedStorage = storageFor(profiles.techA);
  const unrelatedStorage = storageFor(profiles.techA2);

  await assertSucceeds(uploadBytes(ref(assignedStorage, 'jobs/job-a-assigned/before.png'), pngBytes, imageMetadata));
  await assertFails(uploadBytes(ref(unrelatedStorage, 'jobs/job-a-assigned/before.png'), pngBytes, imageMetadata));
});

test('job files do not leak across companies', async () => {
  const platformStorage = storageFor(profiles.platform);
  const ownerAStorage = storageFor(profiles.ownerA);
  const ownerBStorage = storageFor(profiles.ownerB);

  const object = ref(platformStorage, 'jobs/job-b/proof.png');
  await assertSucceeds(uploadBytes(object, pngBytes, imageMetadata));
  await assertSucceeds(getBytes(ref(ownerBStorage, 'jobs/job-b/proof.png')));
  await assertFails(getBytes(ref(ownerAStorage, 'jobs/job-b/proof.png')));
});

test('customer documents are limited to the customer and same-company leadership', async () => {
  const customerStorage = storageFor(profiles.customerA);
  const managerStorage = storageFor(profiles.managerA);
  const otherOwnerStorage = storageFor(profiles.ownerB);

  await assertSucceeds(uploadBytes(ref(customerStorage, 'customers/customer-a/id.png'), pngBytes, imageMetadata));
  await assertSucceeds(getBytes(ref(managerStorage, 'customers/customer-a/id.png')));
  await assertFails(getBytes(ref(otherOwnerStorage, 'customers/customer-a/id.png')));
});

test('message attachments require channel membership', async () => {
  const memberStorage = storageFor(profiles.techA);
  const outsiderStorage = storageFor(profiles.ownerB);

  const metadata = {
    contentType: 'image/png',
    customMetadata: { ownerUid: 'tech-a' }
  };

  await assertSucceeds(uploadBytes(ref(memberStorage, 'messages/channel-a/photo.png'), pngBytes, metadata));
  await assertFails(getBytes(ref(outsiderStorage, 'messages/channel-a/photo.png')));
});
