const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const EMAIL_USER = "evaraos.inc@gmail.com";
const EMAIL_PASS = "wH2026";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

exports.auditAlert = functions.firestore
  .document("audit_logs/{logId}")
  .onCreate(async (snap, context) => {
    try {
      const data = snap.data() || {};

      const action = String(data.action || "").trim();
      const actor = String(data.actor || data.actorName || "Unknown");
      const target = String(data.target || data.targetUser || "Unknown");

      const suspiciousActions = [
        "ROLE_CHANGE",
        "COMPANY_MOVE",
        "DELETE_USER",
      ];

      if (!suspiciousActions.includes(action)) {
        return null;
      }

      const mailOptions = {
        from: EMAIL_USER,
        to: EMAIL_USER,
        subject: "Suspicious Activity Detected",
        text:
`Suspicious activity detected in audit_logs.

Action: ${action}
Actor: ${actor}
Target: ${target}
Log ID: ${context.params.logId}
Time: ${new Date().toLocaleString()}
`,
      };

      await transporter.sendMail(mailOptions);
      console.log("Alert email sent for log:", context.params.logId);

      return null;
    } catch (error) {
      console.error("auditAlert failed:", error);
      return null;
    }
  });