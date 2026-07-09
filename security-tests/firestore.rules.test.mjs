import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';

const PROJECT_ID = 'evaraos-security-test';
let env;

const profiles = Object.freeze({
  platform: { uid: 'platform', role: 'super_admin', companyId: '' },
  ownerA: { uid: 'owner-a', role: 'owner', companyId: 'company-a' },
  ownerB: { uid: 'owner-b', role: 'owner', companyId: 'company-b' },
  managerA: { uid: 'manager-a', role: 'manager', companyId: 'company-a' },
  techA: { uid: 'tech-a', role: 'technician', companyId: 'company-a' },
  techA2: { uid: 'tech-a2', role: 'technician', companyId: 'company-a' },
  customerA: { uid: 'customer-a', role: 'customer', companyId: 'company-a' },
  customerB: { uid: 'customer-b', role: 'customer', companyId: 'company-b' },
  vendorA: { uid: 'vendor-a', role: 'vendor', companyId: 'company-a' }
});

function dbFor(profile) {
  return env.authenticatedContext(profile.uid).firestore();
}

async function seed() {
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

    await setDoc(doc(db, 'companies', 'company-a'), { companyId: 'company-a', name: 'Company A' });
    await setDoc(doc(db, 'companies', 'company-b'), { companyId: 'company-b', name: 'Company B' });

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
      customerUid: 'customer-b',
      assignedToUid: 'tech-a2',
      status: 'scheduled'
    });

    await setDoc(doc(db, 'leads', 'lead-a'), {
      companyId: 'company-a',
      createdByUid: 'manager-a',
      assignedRep: 'tech-a',
      status: 'new'
    });
    await setDoc(doc(db, 'leads', 'lead-b'), {
      companyId: 'company-b',
      createdByUid: 'owner-b',
      status: 'new'
    });

    await setDoc(doc(db, 'invoices', 'invoice-a'), {
      companyId: 'company-a',
      customerUid: 'customer-a',
      total: 100
    });
    await setDoc(doc(db, 'invoices', 'invoice-b'), {
      companyId: 'company-b',
      customerUid: 'customer-b',
      total: 200
    });

    await setDoc(doc(db, 'presence', 'tech-a'), {
      companyId: 'company-a',
      userId: 'tech-a',
      state: 'online'
    });
    await setDoc(doc(db, 'presence', 'tech-a2'), {
      companyId: 'company-a',
      userId: 'tech-a2',
      state: 'online'
    });

    await setDoc(doc(db, 'channels/_group_registry/messages/channel-a'), {
      companyId: 'company-a',
      createdByUid: 'owner-a',
      memberUids: ['owner-a', 'tech-a'],
      adminUids: ['owner-a'],
      allowedRoles: ['owner', 'technician']
    });
    await setDoc(doc(db, 'channels/_group_registry/messages/channel-b'), {
      companyId: 'company-b',
      createdByUid: 'owner-b',
      memberUids: ['owner-b', 'customer-b'],
      adminUids: ['owner-b'],
      allowedRoles: ['owner', 'customer']
    });
    await setDoc(doc(db, 'channels/channel-a/messages/message-1'), {
      senderUid: 'owner-a',
      text: 'Company A only'
    });
    await setDoc(doc(db, 'channels/channel-b/messages/message-1'), {
      senderUid: 'owner-b',
      text: 'Company B only'
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('../firebase/firestore.zero-trust.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

after(async () => {
  await env?.cleanup();
});

test('tenant owner can read only their company', async () => {
  const db = dbFor(profiles.ownerA);
  await assertSucceeds(getDoc(doc(db, 'companies', 'company-a')));
  await assertFails(getDoc(doc(db, 'companies', 'company-b')));
});

test('platform admin may cross tenant boundaries', async () => {
  const db = dbFor(profiles.platform);
  await assertSucceeds(getDoc(doc(db, 'companies', 'company-a')));
  await assertSucceeds(getDoc(doc(db, 'companies', 'company-b')));
  await assertSucceeds(getDoc(doc(db, 'jobs', 'job-b')));
});

test('field staff can read assigned jobs but not unrelated jobs', async () => {
  const db = dbFor(profiles.techA);
  await assertSucceeds(getDoc(doc(db, 'jobs', 'job-a-assigned')));
  await assertFails(getDoc(doc(db, 'jobs', 'job-a-unassigned')));
  await assertFails(getDoc(doc(db, 'jobs', 'job-b')));
});

test('field staff may update only completion-safe fields on assigned jobs', async () => {
  const db = dbFor(profiles.techA);
  const assigned = doc(db, 'jobs', 'job-a-assigned');

  await assertSucceeds(updateDoc(assigned, {
    status: 'in_progress',
    updatedAt: new Date().toISOString()
  }));

  await assertFails(updateDoc(assigned, {
    companyId: 'company-b'
  }));
});

test('customer can read only their own invoice', async () => {
  const db = dbFor(profiles.customerA);
  await assertSucceeds(getDoc(doc(db, 'invoices', 'invoice-a')));
  await assertFails(getDoc(doc(db, 'invoices', 'invoice-b')));
});

test('tenant manager cannot read another tenant lead', async () => {
  const db = dbFor(profiles.managerA);
  await assertSucceeds(getDoc(doc(db, 'leads', 'lead-a')));
  await assertFails(getDoc(doc(db, 'leads', 'lead-b')));
});

test('presence is self-or-leadership scoped', async () => {
  const techDb = dbFor(profiles.techA);
  const managerDb = dbFor(profiles.managerA);
  const ownerBDb = dbFor(profiles.ownerB);

  await assertSucceeds(getDoc(doc(techDb, 'presence', 'tech-a')));
  await assertFails(getDoc(doc(techDb, 'presence', 'tech-a2')));
  await assertSucceeds(getDoc(doc(managerDb, 'presence', 'tech-a2')));
  await assertFails(getDoc(doc(ownerBDb, 'presence', 'tech-a')));
});

test('channel messages require tenant membership', async () => {
  const memberDb = dbFor(profiles.techA);
  const outsiderDb = dbFor(profiles.ownerB);

  await assertSucceeds(getDoc(doc(memberDb, 'channels/channel-a/messages/message-1')));
  await assertFails(getDoc(doc(outsiderDb, 'channels/channel-a/messages/message-1')));
});

test('unknown collections remain denied by default', async () => {
  const db = dbFor(profiles.platform);
  const attempt = getDoc(doc(db, 'unregistered_sensitive_data', 'record-1'));
  await assertFails(attempt);
  assert.ok(true);
});
