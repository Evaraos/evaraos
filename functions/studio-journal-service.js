'use strict';

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  GRAPH_SCHEMA_VERSION,
  OPERATION_PROTOCOL_VERSION,
  OPERATION_ENVELOPE_VERSION,
  cleanString,
  cleanId,
  integer,
  sha256,
  normalizeRole,
  isActiveProfile,
  canEditStudio,
  canPublishStudio,
  normalizeTransactionEnvelope,
  evaluateCommit,
  assignCanonicalSequence,
  validateGraphSnapshot,
  validateCheckpointManifest,
  validateReleaseRequest,
  normalizeRange,
  publicBranch
} = require('./studio-journal-core');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;
const CALLABLE_OPTIONS = Object.freeze({ region: 'us-central1', enforceAppCheck: true, cors: true });

function nowIso() {
  return new Date().toISOString();
}

function assertAuthenticated(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

async function resolveCaller(request, { publish = false } = {}) {
  const uid = assertAuthenticated(request);
  const profileSnapshot = await db.doc(`users/${uid}`).get();
  if (!profileSnapshot.exists) throw new HttpsError('permission-denied', 'A verified user profile is required.');
  const profile = profileSnapshot.data() || {};
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'This account is not active.');
  if (publish ? !canPublishStudio(profile) : !canEditStudio(profile)) {
    throw new HttpsError('permission-denied', publish
      ? 'Publisher authority is required for Studio releases.'
      : 'This role cannot edit Studio branches.');
  }

  const role = normalizeRole(profile.role);
  const requestedCompanyId = cleanId(request.data?.companyId, 128);
  const profileCompanyId = cleanId(profile.companyId, 128);
  const companyId = role === 'platform_admin' ? (requestedCompanyId || profileCompanyId) : profileCompanyId;
  if (!companyId) throw new HttpsError('failed-precondition', 'A company scope is required.');
  if (role !== 'platform_admin' && requestedCompanyId && requestedCompanyId !== profileCompanyId) {
    throw new HttpsError('permission-denied', 'Cross-company Studio access is not allowed.');
  }

  return {
    uid,
    role,
    companyId,
    email: cleanString(request.auth.token?.email || profile.email, 254),
    name: cleanString(profile.displayName || profile.fullName || profile.name || request.auth.token?.email || uid, 160),
    profile
  };
}

function requireProjectBranch(data = {}) {
  const projectId = cleanId(data.projectId, 160);
  const branchId = cleanId(data.branchId, 160);
  if (!projectId || !branchId) throw new HttpsError('invalid-argument', 'projectId and branchId are required.');
  return { projectId, branchId };
}

function projectRef(companyId, projectId) {
  return db.doc(`companies/${companyId}/studio_projects/${projectId}`);
}

function branchRef(companyId, projectId, branchId) {
  return projectRef(companyId, projectId).collection('branches').doc(branchId);
}

function transactionRef(branch, transactionId) {
  return branch.collection('transactions').doc(transactionId);
}

function operationRef(branch, operationId) {
  return branch.collection('operations').doc(operationId);
}

function checkpointRef(branch, checkpointId) {
  return branch.collection('checkpoints').doc(checkpointId);
}

function sessionRef(branch, clientSessionId) {
  return branch.collection('sessions').doc(clientSessionId);
}

function releaseRef(companyId, projectId, releaseId) {
  return projectRef(companyId, projectId).collection('releases').doc(releaseId);
}

function auditRecord(caller, action, target, extra = {}) {
  return {
    action,
    actorUserId: caller.uid,
    actorEmail: caller.email,
    actorName: caller.name,
    actorRole: caller.role,
    companyId: caller.companyId,
    targetCompanyId: caller.companyId,
    targetCollection: target.collection,
    targetDocumentId: target.id,
    changedFields: extra.changedFields || [],
    notes: cleanString(extra.notes || action, 500),
    metadata: extra.metadata || {},
    source: 'trusted_studio_journal_service',
    createdAt: FieldValue.serverTimestamp()
  };
}

function publicTransaction(record = {}) {
  return {
    envelopeVersion: record.envelopeVersion || OPERATION_ENVELOPE_VERSION,
    transactionId: record.transactionId || '',
    companyId: record.companyId || '',
    projectId: record.projectId || '',
    branchId: record.branchId || '',
    graphId: record.graphId || '',
    graphSchemaVersion: record.graphSchemaVersion || GRAPH_SCHEMA_VERSION,
    operationProtocolVersion: record.operationProtocolVersion || OPERATION_PROTOCOL_VERSION,
    expectedHeadRevision: integer(record.expectedHeadRevision, 0),
    acceptedHeadRevision: integer(record.acceptedHeadRevision, 0),
    startSequence: integer(record.startSequence, 0),
    endSequence: integer(record.endSequence, 0),
    intent: record.intent || 'system',
    summary: record.summary || '',
    semanticCommand: record.semanticCommand || null,
    operations: record.operations || [],
    inverseOperations: record.inverseOperations || [],
    commitOperation: record.commitOperation || null,
    actor: record.actor || null,
    clientSessionId: record.clientSessionId || '',
    correlationId: record.correlationId || null,
    revertsTransactionId: record.revertsTransactionId || null,
    redoesTransactionId: record.redoesTransactionId || null,
    affectedNodeIds: record.affectedNodeIds || [],
    affectedEdgeIds: record.affectedEdgeIds || [],
    sourceDocumentId: record.sourceDocumentId || null,
    sourceFingerprint: record.sourceFingerprint || null,
    durabilityState: record.durabilityState || 'server-confirmed',
    requestHash: record.requestHash || null,
    transactionHash: record.transactionHash || null,
    createdAtClient: record.createdAtClient || null,
    acceptedAtServer: record.acceptedAtServer || null,
    metadata: record.metadata || {}
  };
}

function publicCheckpoint(record = {}) {
  return {
    checkpointId: record.checkpointId || '',
    companyId: record.companyId || '',
    projectId: record.projectId || '',
    branchId: record.branchId || '',
    graphId: record.graphId || '',
    graphSchemaVersion: record.graphSchemaVersion || GRAPH_SCHEMA_VERSION,
    revision: integer(record.revision, 0),
    sequence: integer(record.sequence, 0),
    graphHash: record.graphHash || '',
    bytes: integer(record.bytes, 0),
    reason: record.reason || 'trusted-checkpoint',
    trusted: record.trusted === true,
    createdAtMs: record.createdAt?.toMillis?.() || record.createdAtMs || null,
    createdByUid: record.createdByUid || null
  };
}

function conflictError(code, message, details = {}) {
  return new HttpsError('aborted', message, { code, ...details });
}

function storageCheckpointPath(companyId, projectId, branchId, checkpointId) {
  return `studio-journal/${companyId}/${projectId}/${branchId}/checkpoints/${checkpointId}.json`;
}

function storageReleasePath(companyId, projectId, releaseId) {
  return `studio-journal/${companyId}/${projectId}/releases/${releaseId}.json`;
}

async function readCheckpointGraph(manifest) {
  const storagePath = cleanString(manifest.storagePath, 1000);
  if (!storagePath) throw new HttpsError('data-loss', 'Trusted checkpoint storage path is missing.');
  const [buffer] = await bucket.file(storagePath).download();
  let graph;
  try {
    graph = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new HttpsError('data-loss', 'Trusted checkpoint graph is not valid JSON.');
  }
  const validated = validateGraphSnapshot(graph, { graphId: manifest.graphId, revision: manifest.revision });
  if (validated.graphHash !== manifest.graphHash) throw new HttpsError('data-loss', 'Trusted checkpoint graph hash does not match its manifest.');
  return { graph: validated.graph, buffer, graphHash: validated.graphHash };
}

exports.openStudioBranch = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const { projectId, branchId } = requireProjectBranch(request.data);
  const graphId = cleanId(request.data?.graphId, 220);
  const clientSessionId = cleanId(request.data?.clientSessionId, 200);
  if (!graphId || !clientSessionId) throw new HttpsError('invalid-argument', 'graphId and clientSessionId are required.');
  const graphSchemaVersion = cleanString(request.data?.graphSchemaVersion || GRAPH_SCHEMA_VERSION, 80);
  const operationProtocolVersion = cleanString(request.data?.operationProtocolVersion || OPERATION_PROTOCOL_VERSION, 80);
  if (graphSchemaVersion !== GRAPH_SCHEMA_VERSION || operationProtocolVersion !== OPERATION_PROTOCOL_VERSION) {
    throw new HttpsError('failed-precondition', 'Studio graph or operation protocol version is unsupported.');
  }
  const ref = branchRef(caller.companyId, projectId, branchId);
  const session = sessionRef(ref, clientSessionId);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const timestamp = FieldValue.serverTimestamp();
    let branch;
    if (!snapshot.exists) {
      branch = {
        companyId: caller.companyId,
        projectId,
        branchId,
        graphId,
        graphSchemaVersion,
        operationProtocolVersion,
        headRevision: 0,
        headSequence: 0,
        lastTransactionId: null,
        latestCheckpointId: null,
        latestReleaseId: null,
        status: 'open',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdByUid: caller.uid,
        updatedByUid: caller.uid
      };
      transaction.create(ref, branch);
    } else {
      branch = snapshot.data() || {};
      if (branch.graphId !== graphId) throw conflictError('graph-id-conflict', 'The Studio branch already targets a different graph.', { actualGraphId: branch.graphId, requestedGraphId: graphId });
      if (branch.graphSchemaVersion !== graphSchemaVersion || branch.operationProtocolVersion !== operationProtocolVersion) {
        throw new HttpsError('failed-precondition', 'The Studio branch protocol versions do not match this client.');
      }
      if (branch.status === 'closed') throw new HttpsError('failed-precondition', 'This Studio branch is closed.');
    }
    transaction.set(session, {
      companyId: caller.companyId,
      projectId,
      branchId,
      graphId,
      clientSessionId,
      status: 'open',
      openedAt: timestamp,
      updatedAt: timestamp,
      openedByUid: caller.uid,
      openedByRole: caller.role
    }, { merge: true });
    return branch;
  });
  return { ok: true, branch: publicBranch(result), clientSessionId };
});

exports.commitStudioTransaction = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const { projectId, branchId } = requireProjectBranch(request.data);
  let envelope;
  try {
    envelope = normalizeTransactionEnvelope(request.data?.transaction, {
      companyId: caller.companyId,
      projectId,
      branchId,
      caller
    });
  } catch (error) {
    throw new HttpsError('invalid-argument', error.message);
  }

  const branch = branchRef(caller.companyId, projectId, branchId);
  const txRef = transactionRef(branch, envelope.transactionId);
  const acceptedAtServer = nowIso();
  const result = await db.runTransaction(async (transaction) => {
    const [branchSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(branch),
      transaction.get(txRef)
    ]);
    if (!branchSnapshot.exists) throw new HttpsError('not-found', 'Open or create the Studio branch before committing.');
    const currentBranch = branchSnapshot.data() || {};
    if (currentBranch.status === 'closed') throw new HttpsError('failed-precondition', 'This Studio branch is closed.');
    if (currentBranch.graphId !== envelope.graphId) throw conflictError('graph-id-conflict', 'The transaction targets a different graph.', { actualGraphId: currentBranch.graphId, submittedGraphId: envelope.graphId });
    if (currentBranch.graphSchemaVersion !== GRAPH_SCHEMA_VERSION || currentBranch.operationProtocolVersion !== OPERATION_PROTOCOL_VERSION) {
      throw new HttpsError('failed-precondition', 'The Studio branch protocol versions are unsupported.');
    }

    const existing = existingSnapshot.exists ? existingSnapshot.data() || {} : null;
    const decision = evaluateCommit(currentBranch, envelope, existing);
    if (decision.kind === 'idempotent') {
      return { idempotent: true, transaction: decision.transaction, branch: currentBranch };
    }
    if (decision.kind === 'id-conflict') {
      throw new HttpsError('already-exists', 'The transaction ID was already used with different content.', decision.conflict);
    }
    if (decision.kind === 'revision-conflict') {
      throw conflictError('branch-head-conflict', 'The Studio branch head changed before this transaction was committed.', decision.conflict);
    }

    const opRefs = envelope.operations.map((operation) => operationRef(branch, operation.operationId));
    const opSnapshots = await Promise.all(opRefs.map((ref) => transaction.get(ref)));
    const reused = opSnapshots.find((snapshot) => snapshot.exists);
    if (reused) {
      throw new HttpsError('already-exists', 'An accepted operation ID was already committed.', {
        code: 'operation-id-reused',
        operationId: reused.id
      });
    }

    const assigned = assignCanonicalSequence(currentBranch, envelope, acceptedAtServer);
    const serverRecord = {
      ...assigned.transaction,
      companyId: caller.companyId,
      projectId,
      branchId,
      acceptedByUid: caller.uid,
      acceptedByRole: caller.role,
      createdAtServer: FieldValue.serverTimestamp()
    };
    transaction.create(txRef, serverRecord);
    assigned.operations.forEach((operation, index) => {
      transaction.create(opRefs[index], {
        ...operation,
        companyId: caller.companyId,
        projectId,
        branchId,
        transactionId: envelope.transactionId,
        acceptedHeadRevision: envelope.acceptedHeadRevision,
        createdAtServer: FieldValue.serverTimestamp()
      });
    });
    transaction.update(branch, {
      headRevision: assigned.nextBranch.headRevision,
      headSequence: assigned.nextBranch.headSequence,
      lastTransactionId: assigned.nextBranch.lastTransactionId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: caller.uid,
      updatedByRole: caller.role
    });
    const audit = db.collection('audit_logs').doc();
    transaction.create(audit, auditRecord(caller, 'studio_transaction_committed', {
      collection: 'studio_transactions',
      id: envelope.transactionId
    }, {
      changedFields: ['headRevision', 'headSequence', 'lastTransactionId'],
      notes: `Committed ${envelope.intent} to ${projectId}/${branchId}`,
      metadata: {
        projectId,
        branchId,
        graphId: envelope.graphId,
        acceptedHeadRevision: envelope.acceptedHeadRevision,
        startSequence: assigned.transaction.startSequence,
        endSequence: assigned.transaction.endSequence,
        transactionHash: assigned.transaction.transactionHash
      }
    }));
    return { idempotent: false, transaction: serverRecord, branch: assigned.nextBranch };
  });

  return {
    ok: true,
    idempotent: result.idempotent,
    transaction: publicTransaction(result.transaction),
    branch: publicBranch(result.branch)
  };
});

exports.getStudioOperationRange = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const { projectId, branchId } = requireProjectBranch(request.data);
  let range;
  try { range = normalizeRange(request.data); }
  catch (error) { throw new HttpsError('invalid-argument', error.message); }
  const branch = branchRef(caller.companyId, projectId, branchId);
  const branchSnapshot = await branch.get();
  if (!branchSnapshot.exists) throw new HttpsError('not-found', 'Studio branch not found.');
  let query = branch.collection('operations')
    .where('sequence', '>=', range.fromSequence)
    .where('sequence', '<=', range.toSequence)
    .orderBy('sequence', 'asc')
    .limit(range.limit);
  const snapshot = await query.get();
  return {
    ok: true,
    branch: publicBranch(branchSnapshot.data() || {}),
    fromSequence: range.fromSequence,
    toSequence: range.toSequence,
    operations: snapshot.docs.map((doc) => ({ ...doc.data(), operationId: doc.id }))
  };
});

exports.createStudioCheckpoint = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const { projectId, branchId } = requireProjectBranch(request.data);
  const branch = branchRef(caller.companyId, projectId, branchId);
  const branchSnapshot = await branch.get();
  if (!branchSnapshot.exists) throw new HttpsError('not-found', 'Studio branch not found.');
  const currentBranch = branchSnapshot.data() || {};
  if (integer(request.data?.expectedHeadRevision) !== integer(currentBranch.headRevision, 0)) {
    throw conflictError('branch-head-conflict', 'The branch changed before the checkpoint was created.', {
      expectedHeadRevision: integer(request.data?.expectedHeadRevision),
      actualHeadRevision: integer(currentBranch.headRevision, 0)
    });
  }
  let validated;
  try {
    validated = validateGraphSnapshot(request.data?.graphSnapshot, {
      graphId: currentBranch.graphId,
      revision: currentBranch.headRevision
    });
  } catch (error) {
    throw new HttpsError('invalid-argument', error.message);
  }

  const checkpoint = checkpointRef(branch, cleanId(request.data?.checkpointId, 200) || branch.collection('checkpoints').doc().id);
  const checkpointId = checkpoint.id;
  const storagePath = storageCheckpointPath(caller.companyId, projectId, branchId, checkpointId);
  const buffer = Buffer.from(JSON.stringify(validated.graph), 'utf8');
  try {
    await bucket.file(storagePath).save(buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: 'application/json',
        cacheControl: 'private, no-store, max-age=0',
        metadata: {
          companyId: caller.companyId,
          projectId,
          branchId,
          checkpointId,
          graphId: currentBranch.graphId,
          graphHash: validated.graphHash
        }
      }
    });
  } catch (error) {
    if (Number(error?.code) === 412) throw new HttpsError('already-exists', 'This checkpoint ID already exists.');
    throw new HttpsError('internal', 'Trusted checkpoint storage failed.');
  }

  const manifest = {
    checkpointId,
    companyId: caller.companyId,
    projectId,
    branchId,
    graphId: currentBranch.graphId,
    graphSchemaVersion: GRAPH_SCHEMA_VERSION,
    revision: integer(currentBranch.headRevision, 0),
    sequence: integer(currentBranch.headSequence, 0),
    graphHash: validated.graphHash,
    bytes: validated.bytes,
    storagePath,
    reason: cleanString(request.data?.reason || 'trusted-checkpoint', 120),
    trusted: true,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: caller.uid,
    createdByRole: caller.role
  };

  try {
    await db.runTransaction(async (transaction) => {
      const [freshBranch, existing] = await Promise.all([
        transaction.get(branch),
        transaction.get(checkpoint)
      ]);
      if (existing.exists) throw new HttpsError('already-exists', 'This checkpoint ID already exists.');
      if (!freshBranch.exists) throw new HttpsError('not-found', 'Studio branch not found.');
      const fresh = freshBranch.data() || {};
      if (integer(fresh.headRevision, 0) !== manifest.revision || integer(fresh.headSequence, 0) !== manifest.sequence) {
        throw conflictError('branch-head-conflict', 'The branch changed while the checkpoint was being stored.', {
          expectedHeadRevision: manifest.revision,
          actualHeadRevision: integer(fresh.headRevision, 0),
          expectedHeadSequence: manifest.sequence,
          actualHeadSequence: integer(fresh.headSequence, 0)
        });
      }
      transaction.create(checkpoint, manifest);
      transaction.update(branch, {
        latestCheckpointId: checkpointId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: caller.uid
      });
      const audit = db.collection('audit_logs').doc();
      transaction.create(audit, auditRecord(caller, 'studio_checkpoint_created', {
        collection: 'studio_checkpoints',
        id: checkpointId
      }, {
        changedFields: ['latestCheckpointId'],
        notes: `Created trusted checkpoint for ${projectId}/${branchId}`,
        metadata: { projectId, branchId, graphId: manifest.graphId, revision: manifest.revision, sequence: manifest.sequence, graphHash: manifest.graphHash }
      }));
    });
  } catch (error) {
    await bucket.file(storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }

  return { ok: true, checkpoint: publicCheckpoint(manifest) };
});

exports.restoreStudioCheckpoint = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const { projectId, branchId } = requireProjectBranch(request.data);
  const branch = branchRef(caller.companyId, projectId, branchId);
  const branchSnapshot = await branch.get();
  if (!branchSnapshot.exists) throw new HttpsError('not-found', 'Studio branch not found.');
  const branchData = branchSnapshot.data() || {};
  const checkpointId = cleanId(request.data?.checkpointId || branchData.latestCheckpointId, 200);
  if (!checkpointId) throw new HttpsError('failed-precondition', 'No trusted checkpoint is available for this branch.');
  const checkpointSnapshot = await checkpointRef(branch, checkpointId).get();
  if (!checkpointSnapshot.exists) throw new HttpsError('not-found', 'Trusted checkpoint not found.');
  const manifest = checkpointSnapshot.data() || {};
  try { validateCheckpointManifest(manifest, { ...branchData, headRevision: manifest.revision, headSequence: manifest.sequence }); }
  catch (error) { throw new HttpsError('data-loss', error.message); }
  const restored = await readCheckpointGraph(manifest);

  const operationSnapshot = await branch.collection('operations')
    .where('sequence', '>', integer(manifest.sequence, 0))
    .orderBy('sequence', 'asc')
    .limit(1000)
    .get();
  const transactionSnapshot = await branch.collection('transactions')
    .where('endSequence', '>', integer(manifest.sequence, 0))
    .orderBy('endSequence', 'asc')
    .limit(500)
    .get();

  return {
    ok: true,
    branch: publicBranch(branchData),
    checkpoint: publicCheckpoint(manifest),
    graphSnapshot: restored.graph,
    graphHash: restored.graphHash,
    operations: operationSnapshot.docs.map((doc) => ({ ...doc.data(), operationId: doc.id })),
    transactions: transactionSnapshot.docs.map((doc) => publicTransaction(doc.data() || {}))
  };
});

exports.createStudioBranch = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const projectId = cleanId(request.data?.projectId, 160);
  const branchId = cleanId(request.data?.branchId, 160);
  const graphId = cleanId(request.data?.graphId, 220);
  if (!projectId || !branchId || !graphId) throw new HttpsError('invalid-argument', 'projectId, branchId, and graphId are required.');
  const target = branchRef(caller.companyId, projectId, branchId);
  const sourceBranchId = cleanId(request.data?.sourceBranchId, 160);
  const sourceCheckpointId = cleanId(request.data?.sourceCheckpointId, 200);
  let sourceManifest = null;
  if (sourceBranchId && sourceCheckpointId) {
    const source = checkpointRef(branchRef(caller.companyId, projectId, sourceBranchId), sourceCheckpointId);
    const snapshot = await source.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Source trusted checkpoint not found.');
    sourceManifest = snapshot.data() || {};
    if (sourceManifest.graphId !== graphId) throw new HttpsError('invalid-argument', 'Source checkpoint graphId does not match the new branch graphId.');
  }

  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(target);
    if (existing.exists) throw new HttpsError('already-exists', 'Studio branch already exists.');
    const timestamp = FieldValue.serverTimestamp();
    const branch = {
      companyId: caller.companyId,
      projectId,
      branchId,
      graphId,
      graphSchemaVersion: GRAPH_SCHEMA_VERSION,
      operationProtocolVersion: OPERATION_PROTOCOL_VERSION,
      headRevision: sourceManifest ? integer(sourceManifest.revision, 0) : 0,
      headSequence: sourceManifest ? integer(sourceManifest.sequence, 0) : 0,
      lastTransactionId: null,
      latestCheckpointId: sourceManifest ? sourceCheckpointId : null,
      baseCheckpointId: sourceManifest ? sourceCheckpointId : null,
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUid: caller.uid,
      updatedByUid: caller.uid
    };
    transaction.create(target, branch);
    if (sourceManifest) {
      transaction.create(checkpointRef(target, sourceCheckpointId), {
        ...sourceManifest,
        companyId: caller.companyId,
        projectId,
        branchId,
        inheritedFromBranchId: sourceBranchId,
        inheritedAt: timestamp
      });
    }
    return branch;
  });
  return { ok: true, branch: publicBranch(result) };
});

exports.closeStudioSession = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const { projectId, branchId } = requireProjectBranch(request.data);
  const clientSessionId = cleanId(request.data?.clientSessionId, 200);
  if (!clientSessionId) throw new HttpsError('invalid-argument', 'clientSessionId is required.');
  const branch = branchRef(caller.companyId, projectId, branchId);
  const snapshot = await branch.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Studio branch not found.');
  await sessionRef(branch, clientSessionId).set({
    status: 'closed',
    closedAt: FieldValue.serverTimestamp(),
    closedByUid: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true, clientSessionId, status: 'closed' };
});

exports.prepareStudioRelease = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request, { publish: true });
  const { projectId, branchId } = requireProjectBranch(request.data);
  const branch = branchRef(caller.companyId, projectId, branchId);
  const branchSnapshot = await branch.get();
  if (!branchSnapshot.exists) throw new HttpsError('not-found', 'Studio branch not found.');
  const branchData = branchSnapshot.data() || {};
  const checkpointId = cleanId(request.data?.checkpointId || branchData.latestCheckpointId, 200);
  if (!checkpointId) throw new HttpsError('failed-precondition', 'Create a trusted checkpoint at the branch head before publishing.');
  const checkpointSnapshot = await checkpointRef(branch, checkpointId).get();
  if (!checkpointSnapshot.exists) throw new HttpsError('not-found', 'Trusted checkpoint not found.');
  const checkpoint = checkpointSnapshot.data() || {};
  const gate = validateReleaseRequest(request.data || {}, branchData, checkpoint);
  if (!gate.valid) {
    if (gate.code === 'unsynchronized-transactions') {
      throw new HttpsError('failed-precondition', 'Unsynchronized Studio transactions block publication.', gate);
    }
    if (gate.code === 'release-head-conflict') throw conflictError(gate.code, 'The branch changed before release preparation.', gate);
    throw new HttpsError('failed-precondition', gate.message || 'A trusted checkpoint at the branch head is required.', gate);
  }
  const restored = await readCheckpointGraph(checkpoint);
  const releaseId = cleanId(request.data?.releaseId, 200) || projectRef(caller.companyId, projectId).collection('releases').doc().id;
  const ref = releaseRef(caller.companyId, projectId, releaseId);
  const existing = await ref.get();
  const releaseRequestHash = sha256({
    companyId: caller.companyId,
    projectId,
    branchId,
    graphId: branchData.graphId,
    headRevision: branchData.headRevision,
    headSequence: branchData.headSequence,
    checkpointId,
    graphHash: checkpoint.graphHash
  });
  if (existing.exists) {
    const data = existing.data() || {};
    if (data.releaseRequestHash !== releaseRequestHash) throw new HttpsError('already-exists', 'The release ID was already used with different content.', { code: 'release-id-reused', releaseId });
    return { ok: true, idempotent: true, release: data };
  }

  const releaseStoragePath = storageReleasePath(caller.companyId, projectId, releaseId);
  try {
    await bucket.file(releaseStoragePath).save(restored.buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: 'application/json',
        cacheControl: 'private, no-store, max-age=0',
        metadata: {
          companyId: caller.companyId,
          projectId,
          branchId,
          releaseId,
          graphId: branchData.graphId,
          graphHash: checkpoint.graphHash
        }
      }
    });
  } catch (error) {
    if (Number(error?.code) === 412) throw new HttpsError('already-exists', 'This release ID already exists.');
    throw new HttpsError('internal', 'Immutable release storage failed.');
  }

  const release = {
    releaseId,
    releaseRequestHash,
    companyId: caller.companyId,
    projectId,
    branchId,
    graphId: branchData.graphId,
    graphSchemaVersion: GRAPH_SCHEMA_VERSION,
    operationProtocolVersion: OPERATION_PROTOCOL_VERSION,
    headRevision: integer(branchData.headRevision, 0),
    headSequence: integer(branchData.headSequence, 0),
    checkpointId,
    graphHash: checkpoint.graphHash,
    storagePath: releaseStoragePath,
    immutable: true,
    status: 'prepared',
    preparedAt: FieldValue.serverTimestamp(),
    preparedAtIso: nowIso(),
    preparedByUid: caller.uid,
    preparedByRole: caller.role
  };

  try {
    await db.runTransaction(async (transaction) => {
      const [freshBranch, freshCheckpoint, freshRelease] = await Promise.all([
        transaction.get(branch),
        transaction.get(checkpointRef(branch, checkpointId)),
        transaction.get(ref)
      ]);
      if (freshRelease.exists) {
        const data = freshRelease.data() || {};
        if (data.releaseRequestHash === releaseRequestHash) return;
        throw new HttpsError('already-exists', 'The release ID was already used with different content.', { code: 'release-id-reused', releaseId });
      }
      if (!freshBranch.exists || !freshCheckpoint.exists) throw new HttpsError('failed-precondition', 'The release source changed.');
      const freshBranchData = freshBranch.data() || {};
      const freshCheckpointData = freshCheckpoint.data() || {};
      const freshGate = validateReleaseRequest(request.data || {}, freshBranchData, freshCheckpointData);
      if (!freshGate.valid) throw new HttpsError('failed-precondition', 'The release source changed before the immutable release was prepared.', freshGate);
      transaction.create(ref, release);
      transaction.update(branch, {
        latestReleaseId: releaseId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: caller.uid
      });
      const audit = db.collection('audit_logs').doc();
      transaction.create(audit, auditRecord(caller, 'studio_release_prepared', {
        collection: 'studio_releases',
        id: releaseId
      }, {
        changedFields: ['latestReleaseId'],
        notes: `Prepared immutable Studio release ${releaseId}`,
        metadata: { projectId, branchId, graphId: release.graphId, headRevision: release.headRevision, headSequence: release.headSequence, checkpointId, graphHash: release.graphHash }
      }));
    });
  } catch (error) {
    await bucket.file(releaseStoragePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }

  return {
    ok: true,
    idempotent: false,
    release: {
      ...release,
      preparedAt: undefined
    }
  };
});
