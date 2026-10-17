const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where
} = require("firebase/firestore");
const {
  ref,
  uploadBytes,
  getMetadata
} = require("firebase/storage");

const projectId = process.env.GCLOUD_PROJECT || "evaraos-web";
const root = path.resolve(__dirname, "../..");
let env;

const activeUser = (overrides = {}) => ({
  uid: overrides.uid,
  id: overrides.uid,
  email: `${overrides.uid}@example.com`,
  role: "customer",
  status: "active",
  approvalStatus: "approved",
  companyId: "",
  companyName: "",
  platformAccess: false,
  ...overrides
});

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      activeUser({ uid: "owner", role: "owner" }),
      activeUser({ uid: "platform", role: "platform_admin" }),
      activeUser({ uid: "legacyPlatform", role: "super_admin" }),
      activeUser({ uid: "adminA", role: "admin", companyId: "company-a" }),
      activeUser({ uid: "managerA", role: "manager", companyId: "company-a" }),
      activeUser({ uid: "managerB", role: "manager", companyId: "company-b" }),
      activeUser({ uid: "salesA", role: "sales_rep", companyId: "company-a" }),
      activeUser({ uid: "salesB", role: "sales_rep", companyId: "company-a" }),
      activeUser({ uid: "techA", role: "technician", companyId: "company-a" }),
      activeUser({ uid: "techB", role: "technician", companyId: "company-b" }),
      activeUser({ uid: "customerA", role: "customer", companyId: "company-a" }),
      activeUser({ uid: "customerB", role: "customer", companyId: "company-b" }),
      activeUser({ uid: "pending", role: "customer", status: "pending", approvalStatus: "pending" }),
      activeUser({ uid: "suspended", role: "manager", companyId: "company-a", status: "suspended" })
    ];

    for (const user of users) await setDoc(doc(db, "users", user.uid), user);
    await setDoc(doc(db, "companies", "company-a"), { name: "Company A" });
    await setDoc(doc(db, "companies", "company-b"), { name: "Company B" });

    await setDoc(doc(db, "jobs", "job-a"), {
      companyId: "company-a",
      assignedToUid: "techA",
      customerUid: "customerA",
      createdBy: "managerA",
      status: "scheduled"
    });
    await setDoc(doc(db, "jobs", "job-b"), {
      companyId: "company-b",
      assignedToUid: "techB",
      customerUid: "customerB",
      createdBy: "managerB",
      status: "scheduled"
    });
    await setDoc(doc(db, "jobs", "job-cross-company-assigned-to-techA"), {
      companyId: "company-b",
      assignedTo: ["techA"],
      createdBy: "managerB",
      status: "scheduled"
    });
    const jobAssignmentFixtures = [
      ["job-assigned-to-list", { assignedTo: ["techA"] }],
      ["job-assigned-team", { assignedTeamIds: ["techA"] }],
      ["job-assigned-rep", { assignedRep: "techA" }],
      ["job-assigned-rep-list", { assignedRep: ["techA"] }],
      ["job-staff-claimed", { staffClaimedBy: "techA" }]
    ];
    for (const [id, assignment] of jobAssignmentFixtures) {
      await setDoc(doc(db, "jobs", id), { companyId: "company-a", ...assignment, status: "scheduled" });
      await setDoc(doc(db, "users", "techA", "assignedJobs", id), {});
    }
    await setDoc(doc(db, "users", "techA", "assignedJobs", "job-a"), {});

    await setDoc(doc(db, "leads", "lead-assigned"), {
      companyId: "company-a",
      assignedToUid: "salesA",
      createdBy: "managerA",
      status: "new"
    });
    await setDoc(doc(db, "leads", "lead-unassigned"), {
      companyId: "company-a",
      createdBy: "managerA",
      status: "new"
    });
    await setDoc(doc(db, "leads", "lead-assigned-to-other"), {
      companyId: "company-a",
      assignedTo: ["salesB"],
      createdBy: "managerA",
      status: "new"
    });
    await setDoc(doc(db, "leads", "lead-cross-company-assigned-to-salesA"), {
      companyId: "company-b",
      assignedTo: ["salesA"],
      createdBy: "managerB",
      status: "new"
    });
    await setDoc(doc(db, "users", "salesB", "assignedLeads", "lead-assigned-to-other"), {});
    await setDoc(doc(db, "users", "salesA", "assignedLeads", "lead-assigned-to-other"), {});
    const leadAssignmentFixtures = [
      ["lead-assigned-to-list", { assignedTo: ["salesA"] }],
      ["lead-assigned-team", { assignedTeamIds: ["salesA"] }],
      ["lead-assigned-rep", { assignedRep: "salesA" }],
      ["lead-assigned-rep-list", { assignedRep: ["salesA"] }],
      ["lead-staff-claimed", { staffClaimedBy: "salesA" }]
    ];
    for (const [id, assignment] of leadAssignmentFixtures) {
      await setDoc(doc(db, "leads", id), { companyId: "company-a", ...assignment, status: "new" });
      await setDoc(doc(db, "users", "salesA", "assignedLeads", id), {});
    }
    await setDoc(doc(db, "users", "salesA", "assignedLeads", "lead-assigned"), {});

    await setDoc(doc(db, "invoices", "invoice-a"), {
      companyId: "company-a",
      customerUid: "customerA",
      status: "open"
    });
    await setDoc(doc(db, "invoices", "invoice-b"), {
      companyId: "company-b",
      customerUid: "customerB",
      status: "open"
    });

    await setDoc(doc(db, "channels", "_group_registry", "messages", "direct-a"), {
      kind: "direct_meta",
      groupId: "direct-a",
      companyId: "company-a",
      memberUids: ["managerA", "techA"],
      adminUids: ["managerA"]
    });
    await setDoc(doc(db, "channels", "direct-a", "messages", "message-1"), {
      senderUid: "managerA",
      senderRole: "manager",
      companyId: "company-a",
      text: "Secure message"
    });

    await setDoc(doc(db, "channels", "_group_registry", "messages", "company-a__field-crews"), {
      kind: "role_meta",
      groupId: "company-a__field-crews",
      companyId: "company-a",
      allowedRoles: ["manager", "technician", "cleaner"],
      memberUids: [],
      adminUids: []
    });
    await setDoc(doc(db, "channels", "company-a__field-crews", "messages", "message-1"), {
      senderUid: "managerA",
      senderRole: "manager",
      companyId: "company-a",
      text: "Company A only"
    });
  });
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(root, "firebase/firestore.rules"), "utf8")
    },
    storage: {
      rules: fs.readFileSync(path.join(root, "firebase/storage.rules"), "utf8")
    }
  });
});

test.beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed();
});

test.after(async () => {
  await env.cleanup();
});

test("pending and suspended accounts are denied business data", async () => {
  const pendingDb = env.authenticatedContext("pending").firestore();
  const suspendedDb = env.authenticatedContext("suspended").firestore();

  await assertSucceeds(getDoc(doc(pendingDb, "users", "pending")));
  await assertFails(getDoc(doc(pendingDb, "jobs", "job-a")));
  await assertFails(getDoc(doc(suspendedDb, "jobs", "job-a")));
});

test("tenant managers cannot cross company boundaries", async () => {
  const managerDb = env.authenticatedContext("managerA").firestore();
  await assertSucceeds(getDoc(doc(managerDb, "jobs", "job-a")));
  await assertFails(getDoc(doc(managerDb, "jobs", "job-b")));
  await assertFails(getDoc(doc(managerDb, "users", "managerB")));
});

test("sales representatives only receive assigned leads", async () => {
  const salesDb = env.authenticatedContext("salesA").firestore();
  await assertSucceeds(getDoc(doc(salesDb, "leads", "lead-assigned")));
  await assertFails(getDoc(doc(salesDb, "leads", "lead-unassigned")));
  await assertFails(getDoc(doc(salesDb, "users", "managerA")));
});

test("assigned staff list only their own references and every fetched record remains assignment-checked", async () => {
  const salesDb = env.authenticatedContext("salesA").firestore();
  const techDb = env.authenticatedContext("techA").firestore();
  const salesRefs = await assertSucceeds(getDocs(collection(salesDb, "users", "salesA", "assignedLeads")));
  const techRefs = await assertSucceeds(getDocs(collection(techDb, "users", "techA", "assignedJobs")));
  const salesIds = new Set(salesRefs.docs.map((snapshot) => snapshot.id));
  const techIds = new Set(techRefs.docs.map((snapshot) => snapshot.id));

  for (const id of ["lead-assigned", "lead-assigned-to-list", "lead-assigned-team", "lead-assigned-rep", "lead-assigned-rep-list", "lead-staff-claimed"]) {
    assert.ok(salesIds.has(id), `salesA has a reference to ${id}`);
    await assertSucceeds(getDoc(doc(salesDb, "leads", id)));
  }
  for (const id of ["job-a", "job-assigned-to-list", "job-assigned-team", "job-assigned-rep", "job-assigned-rep-list", "job-staff-claimed"]) {
    assert.ok(techIds.has(id), `techA has a reference to ${id}`);
    await assertSucceeds(getDoc(doc(techDb, "jobs", id)));
  }

  await assertFails(getDocs(collection(salesDb, "users", "salesB", "assignedLeads")));
  await assertFails(getDoc(doc(salesDb, "leads", "lead-unassigned")));
  await assertFails(getDoc(doc(salesDb, "leads", "lead-assigned-to-other")));
  await assertFails(deleteDoc(doc(salesDb, "users", "salesA", "assignedLeads", "lead-assigned")));
  await assertSucceeds(deleteDoc(doc(salesDb, "users", "salesA", "assignedLeads", "lead-assigned-to-other")));
  const staleReference = salesRefs.docs.find((snapshot) => snapshot.id === "lead-assigned-to-other");
  assert.ok(staleReference, "a stale reference may remain during eventual assignment cleanup");
  assert.deepEqual(staleReference.data(), {}, "assignment references contain no copied record fields");

  const managerDb = env.authenticatedContext("managerA").firestore();
  await assertSucceeds(deleteDoc(doc(managerDb, "users", "salesA", "assignedLeads", "lead-assigned-to-other")));
  await assertSucceeds(getDocs(query(collection(managerDb, "jobs"), where("companyId", "==", "company-a"))));
});

test("legacy assignment queries stay tenant-scoped and include existing scalar and list assignments", async () => {
  const queryCases = [
    ["techA", "jobs", "assignedToUid", "==", "job-a"],
    ["techA", "jobs", "assignedRep", "==", "job-assigned-rep"],
    ["techA", "jobs", "staffClaimedBy", "==", "job-staff-claimed"],
    ["techA", "jobs", "assignedTo", "array-contains", "job-assigned-to-list"],
    ["techA", "jobs", "assignedTeamIds", "array-contains", "job-assigned-team"],
    ["techA", "jobs", "assignedRep", "array-contains", "job-assigned-rep-list"],
    ["salesA", "leads", "assignedToUid", "==", "lead-assigned"],
    ["salesA", "leads", "assignedTo", "array-contains", "lead-assigned-to-list"],
    ["salesA", "leads", "assignedTeamIds", "array-contains", "lead-assigned-team"],
    ["salesA", "leads", "assignedRep", "array-contains", "lead-assigned-rep-list"],
    ["salesA", "leads", "staffClaimedBy", "==", "lead-staff-claimed"]
  ];

  for (const [uid, collectionName, field, operator, expectedId] of queryCases) {
    const db = env.authenticatedContext(uid).firestore();
    const result = await assertSucceeds(getDocs(query(
      collection(db, collectionName),
      where("companyId", "==", "company-a"),
      where(field, operator, uid)
    )));
    assert.deepEqual(result.docs.map((snapshot) => snapshot.id), [expectedId]);
    await assertFails(getDocs(query(
      collection(db, collectionName),
      where(field, operator, uid)
    )));
  }

  const techDb = env.authenticatedContext("techA").firestore();
  const salesDb = env.authenticatedContext("salesA").firestore();
  await assertFails(getDoc(doc(techDb, "jobs", "job-cross-company-assigned-to-techA")));
  await assertFails(getDoc(doc(salesDb, "leads", "lead-cross-company-assigned-to-salesA")));
});

test("lead assignment references can be removed only after their lead is unassigned", async () => {
  const managerDb = env.authenticatedContext("managerA").firestore();
  const leadRef = doc(managerDb, "leads", "lead-assigned-to-list");
  const assignmentRef = doc(managerDb, "users", "salesA", "assignedLeads", "lead-assigned-to-list");

  await assertFails(deleteDoc(assignmentRef));
  await updateDoc(leadRef, { assignedTo: [] });
  await assertSucceeds(deleteDoc(assignmentRef));
  await assertSucceeds(deleteDoc(leadRef));
});

test("assignment references cannot be forged, populated, or created across users or tenants", async () => {
  const salesDb = env.authenticatedContext("salesA").firestore();
  const ownAssignedRef = doc(salesDb, "users", "salesA", "assignedLeads", "lead-assigned-to-list");
  await assertSucceeds(setDoc(ownAssignedRef, {}));
  await assertFails(setDoc(ownAssignedRef, { companyId: "company-a", title: "forged" }));
  await assertFails(setDoc(doc(salesDb, "users", "salesB", "assignedLeads", "lead-assigned-to-other"), {}));
  await assertFails(setDoc(doc(salesDb, "users", "salesA", "assignedLeads", "lead-unassigned"), {}));

  const managerDb = env.authenticatedContext("managerA").firestore();
  await assertSucceeds(setDoc(doc(managerDb, "users", "salesB", "assignedLeads", "lead-assigned-to-other"), {}));
  await assertFails(setDoc(doc(managerDb, "users", "techB", "assignedJobs", "job-b"), {}));
});

test("customers only read their own financial records", async () => {
  const customerDb = env.authenticatedContext("customerA").firestore();
  await assertSucceeds(getDoc(doc(customerDb, "invoices", "invoice-a")));
  await assertFails(getDoc(doc(customerDb, "invoices", "invoice-b")));
});

test("conversation membership gates direct and role messages", async () => {
  const memberDb = env.authenticatedContext("techA").firestore();
  const outsiderDb = env.authenticatedContext("salesA").firestore();
  const otherCompanyDb = env.authenticatedContext("techB").firestore();

  await assertSucceeds(getDoc(doc(memberDb, "channels", "direct-a", "messages", "message-1")));
  await assertFails(getDoc(doc(outsiderDb, "channels", "direct-a", "messages", "message-1")));
  await assertSucceeds(getDoc(doc(memberDb, "channels", "company-a__field-crews", "messages", "message-1")));
  await assertFails(getDoc(doc(otherCompanyDb, "channels", "company-a__field-crews", "messages", "message-1")));
});

test("conversation registry queries stay membership, role, and tenant constrained", async () => {
  const memberDb = env.authenticatedContext("techA").firestore();
  const managerDb = env.authenticatedContext("managerA").firestore();
  const otherCompanyDb = env.authenticatedContext("techB").firestore();
  const registry = collection(memberDb, "channels", "_group_registry", "messages");

  await assertSucceeds(getDocs(query(
    registry,
    where("kind", "==", "direct_meta"),
    where("companyId", "==", "company-a"),
    where("memberUids", "array-contains", "techA")
  )));
  await assertSucceeds(getDocs(query(
    registry,
    where("kind", "==", "role_meta"),
    where("companyId", "==", "company-a"),
    where("allowedRoles", "array-contains", "technician")
  )));
  await assertSucceeds(getDocs(query(
    collection(managerDb, "channels", "_group_registry", "messages"),
    where("kind", "==", "direct_meta"),
    where("companyId", "==", "company-a"),
    where("adminUids", "array-contains", "managerA")
  )));
  await assertFails(getDocs(query(
    collection(otherCompanyDb, "channels", "_group_registry", "messages"),
    where("kind", "==", "role_meta"),
    where("companyId", "==", "company-a"),
    where("allowedRoles", "array-contains", "technician")
  )));
  await assertFails(getDocs(registry));
});

test("conversation registry creation requires canonical identity and tenant scope", async () => {
  const managerDb = env.authenticatedContext("managerA").firestore();
  const canonical = {
    kind: "direct_meta",
    groupId: "direct-new",
    companyId: "company-a",
    memberUids: ["managerA", "techA"],
    adminUids: ["managerA"],
    createdBy: "managerA"
  };

  await assertSucceeds(setDoc(
    doc(managerDb, "channels", "_group_registry", "messages", "direct-new"),
    canonical
  ));
  await assertFails(setDoc(
    doc(managerDb, "channels", "_group_registry", "messages", "random-document-id"),
    { ...canonical, groupId: "direct-other" }
  ));
  await assertFails(setDoc(
    doc(managerDb, "channels", "_group_registry", "messages", "direct-cross-company"),
    { ...canonical, groupId: "direct-cross-company", companyId: "company-b" }
  ));
});

test("members can create messages but cannot impersonate another role", async () => {
  const memberDb = env.authenticatedContext("techA").firestore();
  await assertSucceeds(setDoc(doc(memberDb, "channels", "direct-a", "messages", "message-2"), {
    senderUid: "techA",
    senderName: "Technician A",
    senderRole: "technician",
    companyId: "company-a",
    text: "Authorized",
    createdAtMs: Date.now()
  }));

  await assertFails(setDoc(doc(memberDb, "channels", "direct-a", "messages", "message-3"), {
    senderUid: "techA",
    senderName: "Fake Owner",
    senderRole: "owner",
    companyId: "company-a",
    text: "Impersonation",
    createdAtMs: Date.now()
  }));
});

test("audit and staff profile writes are server only", async () => {
  const ownerDb = env.authenticatedContext("owner").firestore();
  await assertFails(setDoc(doc(ownerDb, "audit_logs", "forged"), {
    actorUserId: "owner",
    action: "forged"
  }));
  await assertFails(setDoc(doc(ownerDb, "staff_profiles", "techA"), {
    uid: "techA",
    userId: "techA",
    role: "owner",
    status: "active"
  }));
});

test("tenant queries must include their company boundary", async () => {
  const managerDb = env.authenticatedContext("managerA").firestore();
  await assertSucceeds(getDocs(query(
    collection(managerDb, "jobs"),
    where("companyId", "==", "company-a")
  )));
  await assertFails(getDocs(collection(managerDb, "jobs")));
});

test("job storage is restricted to assigned same-company staff", async () => {
  const techAStorage = env.authenticatedContext("techA").storage();
  const techBStorage = env.authenticatedContext("techB").storage();
  const payload = new Uint8Array([137, 80, 78, 71]);
  const metadata = {
    contentType: "image/png",
    customMetadata: { ownerUid: "techA", jobId: "job-a", proofType: "before" }
  };

  const allowedRef = ref(techAStorage, "jobs/job-a/before/photo.png");
  await assertSucceeds(uploadBytes(allowedRef, payload, metadata));
  await assertSucceeds(getMetadata(allowedRef));

  const blockedRef = ref(techBStorage, "jobs/job-a/before/blocked.png");
  await assertFails(uploadBytes(blockedRef, payload, {
    contentType: "image/png",
    customMetadata: { ownerUid: "techB", jobId: "job-a", proofType: "before" }
  }));
});

test("pending applicants can upload only their own application files", async () => {
  const applicantStorage = env.authenticatedContext("pending").storage();
  const otherStorage = env.authenticatedContext("customerA").storage();
  const payload = new Uint8Array([1, 2, 3]);
  const target = ref(applicantStorage, "staff_applications/pending/id/document.png");

  await assertSucceeds(uploadBytes(target, payload, {
    contentType: "image/png",
    customMetadata: { ownerUid: "pending" }
  }));

  await assertFails(uploadBytes(ref(otherStorage, "staff_applications/pending/id/forged.png"), payload, {
    contentType: "image/png",
    customMetadata: { ownerUid: "customerA" }
  }));
});


test("staff profile create update delete remain denied even for platform roles", async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "staff_profiles", "techA"), {uid:"techA",userId:"techA",companyId:"company-a",role:"technician"});
  });
  for (const uid of ["techA", "techB", "owner", "platform", "legacyPlatform"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(updateDoc(doc(db,"staff_profiles","techA"), {"onboardingTasks.reviewPolicies":true}));
    await assertFails(deleteDoc(doc(db,"staff_profiles","techA")));
    await assertFails(setDoc(doc(db,"staff_profiles",uid+"-new"),{uid}));
  }
});

test("canonical and legacy platform reads agree without promoting tenant admins", async () => {
  for (const uid of ["platform", "legacyPlatform", "owner"]) {
    await assertSucceeds(getDoc(doc(env.authenticatedContext(uid).firestore(),"jobs","job-b")));
  }
  await assertFails(getDoc(doc(env.authenticatedContext("adminA").firestore(),"jobs","job-b")));
});
