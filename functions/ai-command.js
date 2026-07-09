"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { runIntelligenceCommand } = require("./intelligence/orchestrator");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const db = admin.firestore();

const HTTPS_ERROR_CODES = new Set([
  "cancelled",
  "unknown",
  "invalid-argument",
  "deadline-exceeded",
  "not-found",
  "already-exists",
  "permission-denied",
  "resource-exhausted",
  "failed-precondition",
  "aborted",
  "out-of-range",
  "unimplemented",
  "internal",
  "unavailable",
  "data-loss",
  "unauthenticated"
]);

function clampText(value = "", max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function callableError(error) {
  if (error instanceof HttpsError) return error;
  const code = HTTPS_ERROR_CODES.has(error?.code) ? error.code : "internal";
  const message = code === "internal"
    ? "EvaraOS Intelligence could not complete this request."
    : clampText(error?.message || "EvaraOS Intelligence could not complete this request.", 500);
  return new HttpsError(code, message);
}

exports.aiCommand = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 20
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to use EvaraOS Intelligence.");
    }

    const prompt = clampText(request.data?.prompt, 2000);
    const context = request.data?.context && typeof request.data.context === "object"
      ? request.data.context
      : {};

    if (prompt.length < 2) {
      throw new HttpsError("invalid-argument", "Enter a command or question.");
    }

    try {
      return await runIntelligenceCommand({
        db,
        apiKey: OPENAI_API_KEY.value(),
        uid: request.auth.uid,
        prompt,
        context
      });
    } catch (error) {
      console.error("aiCommand failed", {
        code: error?.code || "internal",
        message: error?.message || "Unknown intelligence error",
        uid: request.auth.uid
      });
      throw callableError(error);
    }
  }
);
