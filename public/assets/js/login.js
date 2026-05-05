import { auth, db } from "../firebase.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { initNavbar, watchAuth } from "../app.js";

initNavbar();
watchAuth();

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const input = document.getElementById("loginInput").value.trim();
  const password = document.getElementById("password").value;

  let email = input;

  // 🔥 IF USERNAME → FIND EMAIL
  if (!input.includes("@")) {
    const q = query(
      collection(db, "users"),
      where("username", "==", input.toLowerCase())
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      alert("Username not found");
      return;
    }

    email = snap.docs[0].data().email;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (err) {
    alert(err.message);
  }
});