import {
  auth,
  db,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  serverTimestamp,
  getMultiFactorResolver
} from "./firebase.js";

import { beginMfaSignIn, completeMfaSignIn } from "./mfa.js";

const TRUSTED_DEVICE_KEY = "evaraos_trusted_device_v2";

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

function looksLikeEmail(value = "") {
  const raw = String(value).trim();
  return raw.includes("@") && raw.includes(".");
}

function makeTrustedDeviceKey(uid = "") {
  return `${TRUSTED_DEVICE_KEY}:${uid}`;
}

function setTrustedDevice(uid) {
  if (!uid) return;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  localStorage.setItem(
    makeTrustedDeviceKey(uid),
    JSON.stringify({
      expiresAt
    })
  );
}

function isTrustedDevice(uid) {
  if (!uid) return false;

  const raw = localStorage.getItem(makeTrustedDeviceKey(uid));
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    return !!parsed?.expiresAt && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function setText(id, message = "", isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ff9b8f" : "";
}

function formatLoginError(error, resolvedEmail = "") {
  const code = error?.code || "";
  const message = error?.message || "";

  if (
    code.includes("requests-from-referer-are-blocked") ||
    message.includes("requests-from-referer")
  ) {
    return "This domain is being blocked by Firebase or Google Cloud restrictions.";
  }

  if (code.includes("permission-denied")) {
    return "Username lookup is blocked by Firestore rules.";
  }

  if (
    code.includes("invalid-credential") ||
    code.includes("wrong-password") ||
    code.includes("user-not-found") ||
    code.includes("invalid-login-credentials")
  ) {
    return resolvedEmail
      ? `Invalid password for ${resolvedEmail}.`
      : "Invalid email, username, or password.";
  }

  if (code.includes("too-many-requests")) {
    return "Too many login attempts. Please wait a bit and try again.";
  }

  return error?.message || "Login failed. Please try again.";
}

async function resolveEmailFromLoginIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) {
    throw new Error("Missing login identifier.");
  }

  if (looksLikeEmail(raw)) {
    return raw.toLowerCase();
  }

  const normalized = normalizeUsername(raw);
  const usernameRef = doc(db, "usernames", normalized);
  const usernameSnap = await getDoc(usernameRef);

  if (!usernameSnap.exists()) {
    throw new Error(`No username record found for "${normalized}".`);
  }

  const data = usernameSnap.data();

  if (!data?.email) {
    throw new Error(`Username "${normalized}" is missing its email field.`);
  }

  return String(data.email).toLowerCase();
}

export async function syncUsernameDirectoryByUserDoc(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User document not found.");
  }

  const user = userSnap.data();
  const username = normalizeUsername(user.username || "");
  const displayUsername = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : "";
  const handle = username ? `@${username}` : "";

  const existingEntriesQuery = query(
    collection(db, "usernames"),
    where("uid", "==", userId)
  );
  const existingEntriesSnap = await getDocs(existingEntriesQuery);

  for (const entry of existingEntriesSnap.docs) {
    if (entry.id !== username) {
      await deleteDoc(doc(db, "usernames", entry.id));
    }
  }

  if (!username) return null;

  const payload = {
    uid: userId,
    username,
    displayUsername,
    handle,
    email: user.email || "",
    companyId: user.companyId || "",
    role: user.role || "",
    active: user.active ?? true,
    updatedAt: serverTimestamp()
  };

  const usernameRef = doc(db, "usernames", username);
  const usernameSnap = await getDoc(usernameRef);

  if (!usernameSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(usernameRef, payload, { merge: true });
  return payload;
}

export async function loginWithIdentifier(identifier, password) {
  const email = await resolveEmailFromLoginIdentifier(identifier);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, "users", credential.user.uid);

    try {
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Could not update lastLogin:", error);
    }

    try {
      await syncUsernameDirectoryByUserDoc(credential.user.uid);
    } catch (error) {
      console.warn("Could not sync username directory:", error);
    }

    return { credential, resolvedEmail: email };
  } catch (error) {
    if (error.code === "auth/multi-factor-auth-required") {
      const resolver = getMultiFactorResolver(auth, error);
      error.customData = { ...(error.customData || {}), resolver };
    }

    throw Object.assign(error, { resolvedEmail: email });
  }
}

export async function createAccount({
  name,
  email,
  username,
  password,
  confirmPassword,
  securityPhone,
  smsProtection
}) {
  if (!name || !email || !username || !password || !confirmPassword) {
    return { success: false, message: "Fill in all required fields." };
  }

  if (password !== confirmPassword) {
    return { success: false, message: "Passwords do not match." };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Password should be at least 8 characters."
    };
  }

  return {
    success: false,
    message:
      "Signup account creation wiring is the next backend-auth step. The UI is restored and ready."
  };
}

export async function sendReset(email) {
  return sendPasswordResetEmail(auth, email);
}

function setupPasswordToggle(inputId, btnId, openId, closedId) {
  const passwordInput = document.getElementById(inputId);
  const toggleBtn = document.getElementById(btnId);
  const openIcon = document.getElementById(openId);
  const closedIcon = document.getElementById(closedId);

  if (!passwordInput || !toggleBtn || !openIcon || !closedIcon) return;

  toggleBtn.addEventListener("click", () => {
    const shouldShow = passwordInput.type === "password";
    passwordInput.type = shouldShow ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(shouldShow));
    toggleBtn.setAttribute(
      "aria-label",
      shouldShow ? "Hide password" : "Show password"
    );
    openIcon.style.display = shouldShow ? "none" : "block";
    closedIcon.style.display = shouldShow ? "block" : "none";
  });
}

function setupResetPanel() {
  const openResetBtn = document.getElementById("openResetBtn");
  const closeResetBtn = document.getElementById("closeResetBtn");
  const resetPanel = document.getElementById("resetPanel");

  if (!resetPanel) return;

  openResetBtn?.addEventListener("click", () => {
    resetPanel.classList.remove("hidden");
  });

  closeResetBtn?.addEventListener("click", () => {
    resetPanel.classList.add("hidden");
  });
}

function setupMfaChallengePanel() {
  const challengeForm = document.getElementById("mfaChallengeForm");
  if (!challengeForm) return;

  challengeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = document.getElementById("mfaCode")?.value?.trim() || "";
    const submitBtn = challengeForm.querySelector('button[type="submit"]');

    setText("mfaChallengeMessage", "");

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying...";
      }

      const credential = await completeMfaSignIn(code);

      const remember = document.getElementById("rememberTrustedDevice");
      if (remember?.checked) {
        setTrustedDevice(credential.user.uid);
      }

      const userSnap = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userSnap.exists() ? userSnap.data() : { role: "customer" };
      const role = userData?.role || "customer";

      window.location.href =
        role === "customer"
          ? "/evaraos/customer_dashboard.html"
          : "/evaraos/dashboard.html";
    } catch (error) {
      console.error("MFA challenge failed:", error);
      setText(
        "mfaChallengeMessage",
        error.message || "Invalid verification code.",
        true
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Verify Code";
      }
    }
  });
}

function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("username")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    setText("loginMessage", "");

    if (!identifier || !password) {
      setText(
        "loginMessage",
        "Enter your email or username and password.",
        true
      );
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing In...";
      }

      const { credential, resolvedEmail } = await loginWithIdentifier(
        identifier,
        password
      );

      const userSnap = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userSnap.exists() ? userSnap.data() : { role: "customer" };
      const role = userData?.role || "customer";
      const remember = document.getElementById("rememberTrustedDevice");

      if (!looksLikeEmail(identifier)) {
        setText(
          "loginMessage",
          `Username "${identifier}" resolved to ${resolvedEmail}.`
        );
      }

      if (
        userData?.smsProtectionEnabled &&
        userData?.securityPhone &&
        !isTrustedDevice(credential.user.uid)
      ) {
        setText(
          "loginMessage",
          "This account uses number verification on new devices. Complete the SMS step when enabled."
        );
      }

      if (remember?.checked) {
        setTrustedDevice(credential.user.uid);
      }

      window.location.href =
        role === "customer"
          ? "/evaraos/customer_dashboard.html"
          : "/evaraos/dashboard.html";
    } catch (error) {
      if (error.code === "auth/multi-factor-auth-required") {
        try {
          const result = await beginMfaSignIn(error, "recaptcha-container");
          document.getElementById("mfaChallengePanel")?.classList.remove("hidden");
          setText(
            "mfaChallengeMessage",
            `Code sent to ${result.maskedPhone}.`
          );

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Login";
          }
          return;
        } catch (mfaError) {
          console.error("MFA setup failed:", mfaError);
          setText(
            "loginMessage",
            mfaError.message || "Could not start number verification.",
            true
          );
        }
      }

      const resolvedEmail = error.resolvedEmail || "";
      console.error("Login failed:", error);
      setText("loginMessage", formatLoginError(error, resolvedEmail), true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
    }
  });
}

function setupResetForm() {
  const resetForm = document.getElementById("resetForm");
  if (!resetForm) return;

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("resetEmail")?.value?.trim() || "";
    const submitBtn = resetForm.querySelector('button[type="submit"]');

    setText("resetMessage", "");

    if (!email) {
      setText("resetMessage", "Enter your account email.", true);
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      await sendReset(email);
      setText("resetMessage", "Reset email sent. Check your inbox.");
    } catch (error) {
      console.error("Reset email failed:", error);
      setText(
        "resetMessage",
        "Could not send reset email. Check the address and try again.",
        true
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Email";
      }
    }
  });
}

function setupSignupForm() {
  const signupForm = document.getElementById("signupForm");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signupName")?.value?.trim() || "";
    const email = document.getElementById("signupEmail")?.value?.trim() || "";
    const username = document.getElementById("signupUsername")?.value?.trim() || "";
    const password = document.getElementById("signupPassword")?.value || "";
    const confirmPassword =
      document.getElementById("signupPasswordConfirm")?.value || "";
    const securityPhone =
      document.getElementById("signupSecurityPhone")?.value?.trim() || "";
    const smsProtection =
      document.getElementById("signupSmsProtection")?.value === "on";

    setText("signupMessage", "");

    const result = await createAccount({
      name,
      email,
      username,
      password,
      confirmPassword,
      securityPhone,
      smsProtection
    });

    if (!result.success) {
      setText("signupMessage", result.message, true);
      return;
    }

    setText("signupMessage", "Account created.");
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggle(
    "password",
    "togglePasswordBtn",
    "passwordIconOpen",
    "passwordIconClosed"
  );

  setupPasswordToggle(
    "signupPassword",
    "toggleSignupPasswordBtn",
    "signupPasswordIconOpen",
    "signupPasswordIconClosed"
  );

  setupPasswordToggle(
    "signupPasswordConfirm",
    "toggleSignupPasswordConfirmBtn",
    "signupPasswordConfirmIconOpen",
    "signupPasswordConfirmIconClosed"
  );

  setupResetPanel();
  setupLoginForm();
  setupResetForm();
  setupSignupForm();
  setupMfaChallengePanel();
});