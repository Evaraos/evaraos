// assets/js/security.js

import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  reload
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const securityHeroTitle = document.getElementById("securityHeroTitle");
const securityHeroText = document.getElementById("securityHeroText");

const securityStatusHeadline = document.getElementById("securityStatusHeadline");
const securityStatusSubline = document.getElementById("securityStatusSubline");

const securityEmailStat = document.getElementById("securityEmailStat");
const securityEmailMeta = document.getElementById("securityEmailMeta");
const securityVerifiedStat = document.getElementById("securityVerifiedStat");
const securityVerifiedMeta = document.getElementById("securityVerifiedMeta");
const securityProviderStat = document.getElementById("securityProviderStat");
const securityProviderMeta = document.getElementById("securityProviderMeta");

const securityFeed = document.getElementById("securityFeed");
const securityMessage = document.getElementById("securityMessage");

const securityRefreshBtnTop = document.getElementById("securityRefreshBtnTop");
const securityRefreshBtnSide = document.getElementById("securityRefreshBtnSide");
const securityResetPasswordBtnTop = document.getElementById("securityResetPasswordBtnTop");
const securityResetPasswordBtnSide = document.getElementById("securityResetPasswordBtnSide");

let currentUser = null;

function setMessage(text = "", isError = false) {
  if (!securityMessage) return;
  securityMessage.textContent = text;
  securityMessage.style.color = isError ? "#ff9b8f" : "";
}

function providerLabel(user) {
  const provider = user?.providerData?.[0]?.providerId || "password";

  if (provider === "password") return "Email/Password";
  if (provider === "google.com") return "Google";
  if (provider === "apple.com") return "Apple";
  if (provider === "facebook.com") return "Facebook";
  return provider;
}

function renderSecurity(user) {
  const email = user?.email || "No email";
  const verified = Boolean(user?.emailVerified);
  const provider = providerLabel(user);

  if (securityHeroTitle) securityHeroTitle.textContent = verified ? "Your account is protected." : "Your account needs verification.";
  if (securityHeroText) securityHeroText.textContent = verified
    ? "Your primary email is verified and your authentication provider is active."
    : "Verify your email and keep your credentials current to strengthen account security.";

  if (securityStatusHeadline) securityStatusHeadline.textContent = verified ? "Verified account" : "Verification pending";
  if (securityStatusSubline) securityStatusSubline.textContent = `${provider} • ${email}`;

  if (securityEmailStat) securityEmailStat.textContent = email.split("@")[0] || "—";
  if (securityEmailMeta) securityEmailMeta.textContent = email;

  if (securityVerifiedStat) securityVerifiedStat.textContent = verified ? "Yes" : "No";
  if (securityVerifiedMeta) securityVerifiedMeta.textContent = verified
    ? "Email verified"
    : "Email not verified yet";

  if (securityProviderStat) securityProviderStat.textContent = provider;
  if (securityProviderMeta) securityProviderMeta.textContent = "Current sign-in provider";

  if (securityFeed) {
    securityFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Email</strong>
        <span>${email}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Verification</strong>
        <span>${verified ? "Verified" : "Not verified"}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Provider</strong>
        <span>${provider}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Password Reset</strong>
        <span>You can send a password reset email to your current account email.</span>
      </article>
    `;
  }
}

async function refreshSecurity() {
  if (!currentUser) return;

  try {
    await reload(currentUser);
    renderSecurity(auth.currentUser || currentUser);
    setMessage("Security status refreshed.");
  } catch (error) {
    console.error("Security refresh failed:", error);
    setMessage(error.message || "Unable to refresh security status.", true);
  }
}

async function sendReset() {
  if (!currentUser?.email) {
    setMessage("No email is attached to this account.", true);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    setMessage("Password reset email sent.");
  } catch (error) {
    console.error("Password reset send failed:", error);
    setMessage(error.message || "Unable to send password reset email.", true);
  }
}

function bindButtons() {
  securityRefreshBtnTop?.addEventListener("click", refreshSecurity);
  securityRefreshBtnSide?.addEventListener("click", refreshSecurity);
  securityResetPasswordBtnTop?.addEventListener("click", sendReset);
  securityResetPasswordBtnSide?.addEventListener("click", sendReset);

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/evaraos/login.html";
    return;
  }

  currentUser = user;
  renderSecurity(user);
});

document.addEventListener("DOMContentLoaded", bindButtons);