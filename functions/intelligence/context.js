"use strict";

const { capabilitiesForRole, hasCapability, normalizeRole } = require("./policy");

const BLOCKED_STATUSES = new Set(["inactive", "suspended", "disabled", "deleted"]);

function intelligenceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value = "", max = 160) {
  return String(value || "").trim().slice(0, max);
}

function safeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function countMap(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, item]) => {
    if (typeof item === "number" || Number.isFinite(Number(item))) {
      result[text(key, 60)] = number(item);
    }
    return result;
  }, {});
}

function sanitizeOperationsStats(data = {}, scope = "company") {
  const snapshot = {
    scope,
    updatedAt: safeTimestamp(data.updatedAt),
    leads: {
      total: number(data.leads?.total),
      open: number(data.leads?.open),
      hot: number(data.leads?.hot),
      statuses: countMap(data.leads?.statuses),
      priorities: countMap(data.leads?.priorities)
    },
    jobs: {
      total: number(data.jobs?.total),
      inMotion: number(data.jobs?.inMotion),
      statuses: countMap(data.jobs?.statuses)
    }
  };

  if (scope === "platform") {
    snapshot.companies = {
      total: number(data.companies?.total),
      active: number(data.companies?.active)
    };
    snapshot.users = {
      total: number(data.users?.total),
      active: number(data.users?.active),
      roles: countMap(data.users?.roles)
    };
  }

  return snapshot;
}

async function loadActorContext(db, uid) {
  const userId = text(uid, 128);
  if (!userId) throw intelligenceError("unauthenticated", "Sign in to use Evaraos Intelligence.");

  const userDoc = await db.doc(`users/${userId}`).get();
  if (!userDoc.exists) throw intelligenceError("failed-precondition", "Your Evaraos user profile is not ready.");

  const user = userDoc.data() || {};
  const rawRole = text(user.role || "customer", 80);
  const role = normalizeRole(rawRole);
  const status = text(user.status || "active", 40).toLowerCase();

  if (BLOCKED_STATUSES.has(status)) {
    throw intelligenceError("permission-denied", "This account cannot use Evaraos Intelligence.");
  }

  return {
    uid: userId,
    role,
    rawRole,
    status,
    companyId: text(user.companyId, 128) || null,
    companyName: text(user.companyName, 160) || null,
    displayName: text(user.displayName || user.fullName || user.name || user.username || "User", 120),
    capabilities: capabilitiesForRole(role)
  };
}

async function loadOperationsSnapshot(db, actor) {
  if (!hasCapability(actor.role, "ai.read.operations")) {
    throw intelligenceError("permission-denied", "Your role cannot access operational intelligence.");
  }

  if (["owner", "admin"].includes(actor.role)) {
    const doc = await db.doc("dashboard_stats/global").get();
    return sanitizeOperationsStats(doc.exists ? doc.data() : {}, "platform");
  }

  if (!actor.companyId) {
    throw intelligenceError("failed-precondition", "Your account needs a company assignment before operational intelligence is available.");
  }

  const doc = await db.doc(`company_stats/${actor.companyId}`).get();
  return sanitizeOperationsStats(doc.exists ? doc.data() : {}, "company");
}

module.exports = {
  intelligenceError,
  loadActorContext,
  loadOperationsSnapshot,
  sanitizeOperationsStats
};
