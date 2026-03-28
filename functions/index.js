const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const db = admin.firestore();

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

exports.sendSuspiciousAuditEmail = onDocumentCreated("security_alerts/{alertId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const alert = snap.data();
  if (!alert || alert.status !== "queued") return;

  const settingsSnap = await db.doc("alert_settings/security").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};

  const recipients = Array.isArray(settings.recipients) ? settings.recipients.filter(Boolean) : [];
  const enabled = settings.enabled !== false;

  if (!enabled || !recipients.length) {
    await snap.ref.update({
      status: "skipped",
      skippedReason: "Alerts disabled or no recipients configured",
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  const transporter = buildTransporter();

  const subject = `[Evaraos Security Alert] ${alert.title || "Suspicious audit activity detected"}`;
  const text = `
Security alert from Evaraos

Title: ${alert.title || "Suspicious activity"}
Severity: ${alert.severity || "unknown"}

Details:
${alert.text || "No details provided."}

Alert ID:
${snap.id}
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.ALERTS_FROM_EMAIL,
      to: recipients.join(","),
      subject,
      text
    });

    await snap.ref.update({
      status: "sent",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    await snap.ref.update({
      status: "error",
      errorMessage: String(error.message || error),
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    throw error;
  }
});