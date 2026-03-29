import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* LOGIN */

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, username, password);

    window.location.href = "dashboard.html";

  } catch (err) {
    document.getElementById("loginMessage").innerText = formatError(err);
  }
});

/* RESET */

document.getElementById("resetForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("resetEmail").value;

  try {
    await sendPasswordResetEmail(auth, email);
    document.getElementById("resetMessage").innerText = "Reset email sent.";
  } catch (err) {
    document.getElementById("resetMessage").innerText = "Error sending reset email.";
  }
});

/* PASSWORD TOGGLE */

document.getElementById("togglePasswordBtn")?.addEventListener("click", () => {
  const input = document.getElementById("password");
  const open = document.getElementById("passwordIconOpen");
  const closed = document.getElementById("passwordIconClosed");

  if (input.type === "password") {
    input.type = "text";
    open.style.display = "none";
    closed.style.display = "block";
  } else {
    input.type = "password";
    open.style.display = "block";
    closed.style.display = "none";
  }
});

/* RESET PANEL */

document.getElementById("openResetBtn")?.addEventListener("click", () => {
  document.getElementById("resetPanel").classList.remove("hidden");
});

document.getElementById("closeResetBtn")?.addEventListener("click", () => {
  document.getElementById("resetPanel").classList.add("hidden");
});

/* AUTH LISTENER */

export function listenAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    callback(user || null);
  });
}

/* LOGOUT */

export async function logout() {
  await signOut(auth);
}

/* ERROR FORMAT */

function formatError(err) {
  if (err.code.includes("requests-from-referer")) {
    return "⚠️ Add evaraos.github.io to Firebase Authorized Domains.";
  }

  if (err.code.includes("wrong-password")) return "Wrong password";
  if (err.code.includes("user-not-found")) return "User not found";

  return err.message;
}