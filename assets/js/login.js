import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const loginInput = document.getElementById("loginInput"); // username OR email
const passwordInput = document.getElementById("passwordInput");
const message = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const loginValue = loginInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  message.textContent = "Logging in...";

  try {
    let emailToUse = loginValue;

    // 🔥 If it's NOT an email → treat as username
    if (!loginValue.includes("@")) {
      const q = query(
        collection(db, "users"),
        where("username", "==", loginValue)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("Username not found.");
      }

      emailToUse = snap.docs[0].data().email;
    }

    // 🔥 Login with resolved email
    await signInWithEmailAndPassword(auth, emailToUse, password);

    window.location.href = "dashboard.html";
  } catch (err) {
    message.textContent = err.message;
  }
});