// assets/js/security.js

import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const securityForm = document.getElementById("securityForm");
const securityMessage = document.getElementById("securityMessage");
const securityEmail = document.getElementById("securityEmail");
const securityEmailVerified = document.getElementById("securityEmailVerified");

const sendResetEmailTopBtn = document.getElementById("sendResetEmailTopBtn");
const refreshSecurityTopBtn = document.getElementById("refreshSecurityTopBtn");
const securityRefreshBtn = document.getElementById("securityRefreshBtn");

const securityHeroTitle = document.getElementById("securityHeroTitle");
const securityHeroText = document.getElementById("securityHeroText");

const securityEmailStat = document.getElementById("securityEmailStat");
const securityEmailMeta = document.getElementById("securityEmailMeta");
const securityVerifyStat = document.getElementById("securityVerifyStat");
const securityVerifyMeta = document.getElementById("securityVerifyMeta");
const securityProviderStat = document.getElementById("securityProviderStat");
const securityProviderMeta = document.getElementById("securityProviderMeta");

const securityFeed = document.getElementById("securityFeed");

let currentUser = null;

function setMessage(text = "", isError = false) {
  if (!securityMessage) return;
  securityMessage.textContent = text;
  securityMessage.style.color = isError ? "#ff9b8f" : "";
}

function shortEmailHead(email = "") {
  const head = String(email || "").split("@")[0] || "—";
  return head.length > 10 ? `${head.slice(0, 10)}…` : head;
}

function providerName(user) {
  const providerId = user?.providerData?.[0]?.providerId || "password";
  if (providerId === "password") return "Email";
  return providerId.replace(".com", "");
}

function renderSecurity(user) {
  currentUser = user;

  const email = user.email || "";
  const verified = Boolean(user.emailVerified);
  const provider = providerName(user);

  if (securityEmail) securityEmail.value = email;
  if (securityEmailVerified) securityEmailVerified.checked = verified;

  if (securityHeroTitle) {
    securityHeroTitle.textContent = verified ? "Account verified" : "Verification recommended";
  }

  if (securityHeroText) {
    securityHeroText.textContent = verified
      ? "Your login email is verified and active."
      : "Verify your email to strengthen account recovery.";
  }

  if (securityEmailStat) securityEmailStat.textContent = shortEmailHead(email);
  if (securityEmailMeta) securityEmailMeta.textContent = email || "No email available";

  if (securityVerifyStat) securityVerifyStat.textContent = verified ? "Yes" : "No";
  if (securityVerifyMeta) securityVerifyMeta.textContent = verified ? "Email verified" : "Email not verified";

  if (securityProviderStat) securityProviderStat.textContent = provider;
  if (securityProviderMeta) securityProviderMeta.textContent = "Current sign-in provider";

  if (securityFeed) {
    securityFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Account Email</strong>
        <span>${email || "No email available"}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Email Verification</strong>
        <span>${verified ? "Verified and ready for recovery workflows." : "Not verified yet."}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Provider</strong>
        <span>${provider}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Session</strong>
        <span>Authenticated and active in the current browser session.</span>
      </article>
    `;
  }
}

async function sendResetEmail() {
  if (!currentUser?.email) {
    setMessage("No account email found for password reset.", true);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    setMessage("Password reset email sent successfully.");
  } catch (error) {
    console.error("Password reset send failed:", error);
    setMessage(error.message || "Unable to send password reset email.", true);
  }
}

function refreshSecurityData() {
  if (!auth.currentUser) return;
  renderSecurity(auth.currentUser);
  setMessage("Security data refreshed.");
}

if (securityForm) {
  securityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendResetEmail();
  });
}

if (sendResetEmailTopBtn) {
  sendResetEmailTopBtn.addEventListener("click", async () => {
    await sendResetEmail();
  });
}

if (refreshSecurityTopBtn) {
  refreshSecurityTopBtn.addEventListener("click", refreshSecurityData);
}

if (securityRefreshBtn) {
  securityRefreshBtn.addEventListener("click", refreshSecurityData);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/evaraos/login.html";
    return;
  }

  renderSecurity(user);
});
