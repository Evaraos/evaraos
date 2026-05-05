// assets/js/profile.js

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const profileForm = document.getElementById("profileForm");
const profileMessage = document.getElementById("profileMessage");
const profileResetBtn = document.getElementById("profileResetBtn");
const saveProfileBtnTop = document.getElementById("saveProfileBtnTop");

const profileFullName = document.getElementById("profileFullName");
const profileEmail = document.getElementById("profileEmail");
const profilePhone = document.getElementById("profilePhone");
const profileRole = document.getElementById("profileRole");
const profileBio = document.getElementById("profileBio");
const profileUsername = document.getElementById("profileUsername");

const profileHeroAvatar = document.getElementById("profileHeroAvatar");
const profileHeroName = document.getElementById("profileHeroName");
const profileHeroRole = document.getElementById("profileHeroRole");

const profileStatInitial = document.getElementById("profileStatInitial");
const profileStatNameMeta = document.getElementById("profileStatNameMeta");
const profileStatEmailHead = document.getElementById("profileStatEmailHead");
const profileStatEmailMeta = document.getElementById("profileStatEmailMeta");
const profileStatRoleHead = document.getElementById("profileStatRoleHead");
const profileStatRoleMeta = document.getElementById("profileStatRoleMeta");

const profileSummaryFeed = document.getElementById("profileSummaryFeed");

let originalProfile = null;
let currentUser = null;

function setMessage(text = "", isError = false) {
  if (!profileMessage) return;
  profileMessage.textContent = text;
  profileMessage.style.color = isError ? "#ff9b8f" : "";
}

function normalizeUsername(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function guessRole(email = "") {
  const value = String(email || "").toLowerCase();
  if (value.includes("admin")) return "admin";
  if (value.includes("manager")) return "manager";
  if (value.includes("sales")) return "sales";
  if (value.includes("tech")) return "technician";
  if (value.includes("customer")) return "customer";
  return "customer";
}

function niceRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "Customer";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function usernameTakenByAnotherUser(username, uid) {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  const usernameRef = doc(db, "usernames", normalized);
  const snap = await getDoc(usernameRef);
  if (!snap.exists()) return false;

  const data = snap.data() || {};
  return data.uid !== uid;
}

function updateHeaderUi(data) {
  const name = data.fullName || data.displayName || currentUser?.displayName || currentUser?.email || "Account User";
  const email = data.email || currentUser?.email || "No email";
  const role = niceRole(data.role || guessRole(email));
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  if (profileHeroAvatar) profileHeroAvatar.textContent = initial;
  if (profileHeroName) profileHeroName.textContent = name;
  if (profileHeroRole) profileHeroRole.textContent = role;

  if (profileStatInitial) profileStatInitial.textContent = initial;
  if (profileStatNameMeta) profileStatNameMeta.textContent = name;
  if (profileStatEmailHead) profileStatEmailHead.textContent = email.split("@")[0] || "—";
  if (profileStatEmailMeta) profileStatEmailMeta.textContent = email;
  if (profileStatRoleHead) profileStatRoleHead.textContent = role;
  if (profileStatRoleMeta) profileStatRoleMeta.textContent = "Role synced from account";
}

function updateSummaryFeed(data) {
  const email = data.email || currentUser?.email || "No email";
  const role = niceRole(data.role || guessRole(email));
  const phone = data.phone || "No phone added yet";
  const bio = data.bio || "No bio added yet";
  const username = data.username || "No username saved yet";

  if (!profileSummaryFeed) return;

  profileSummaryFeed.innerHTML = `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>Name</strong>
      <span>${data.fullName || currentUser?.displayName || "Not set"}</span>
    </article>

    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>Username</strong>
      <span>${username}</span>
    </article>

    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>Email</strong>
      <span>${email}</span>
    </article>

    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>Role</strong>
      <span>${role}</span>
    </article>

    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>Phone</strong>
      <span>${phone}</span>
    </article>

    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>Bio</strong>
      <span>${bio}</span>
    </article>
  `;
}

function fillForm(data) {
  if (profileFullName) profileFullName.value = data.fullName || currentUser?.displayName || "";
  if (profileEmail) profileEmail.value = data.email || currentUser?.email || "";
  if (profilePhone) profilePhone.value = data.phone || "";
  if (profileRole) profileRole.value = niceRole(data.role || guessRole(currentUser?.email || ""));
  if (profileBio) profileBio.value = data.bio || "";
  if (profileUsername) profileUsername.value = data.username || "";

  updateHeaderUi(data);
  updateSummaryFeed(data);
}

async function loadProfile(user) {
  currentUser = user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  let data = {};
  if (snap.exists()) {
    data = snap.data() || {};
  } else {
    data = {
      fullName: user.displayName || "",
      username: "",
      email: user.email || "",
      role: guessRole(user.email || ""),
      phone: "",
      bio: ""
    };

    await setDoc(userRef, {
      ...data,
      uid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  originalProfile = {
    fullName: data.fullName || user.displayName || "",
    username: data.username || "",
    email: data.email || user.email || "",
    role: data.role || guessRole(user.email || ""),
    phone: data.phone || "",
    bio: data.bio || ""
  };

  fillForm(originalProfile);
}

async function saveProfile() {
  if (!currentUser) return;

  const fullName = profileFullName?.value.trim() || "";
  const username = normalizeUsername(profileUsername?.value || "");
  const phone = profilePhone?.value.trim() || "";
  const bio = profileBio?.value.trim() || "";
  const email = currentUser.email || profileEmail?.value || "";
  const role = originalProfile?.role || guessRole(email);
  const previousUsername = normalizeUsername(originalProfile?.username || "");

  if (!fullName) {
    setMessage("Please enter your full name.", true);
    return;
  }

  if (username && username.length < 3) {
    setMessage("Username must be at least 3 characters long.", true);
    return;
  }

  try {
    if (username) {
      const taken = await usernameTakenByAnotherUser(username, currentUser.uid);
      if (taken) {
        setMessage("That username is already taken. Please choose another one.", true);
        return;
      }
    }

    await updateProfile(currentUser, {
      displayName: fullName
    });

    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, {
      uid: currentUser.uid,
      fullName,
      username,
      displayName: fullName,
      email,
      role,
      phone,
      bio,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (previousUsername && previousUsername !== username) {
      await deleteDoc(doc(db, "usernames", previousUsername));
    }

    if (username) {
      await setDoc(
        doc(db, "usernames", username),
        {
          uid: currentUser.uid,
          email,
          username,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    originalProfile = { fullName, username, email, role, phone, bio };
    fillForm(originalProfile);
    setMessage("Profile updated successfully.");
  } catch (error) {
    console.error("Profile update failed:", error);
    setMessage(error.message || "Unable to save profile.", true);
  }
}

function resetProfileForm() {
  if (!originalProfile) return;
  fillForm(originalProfile);
  setMessage("Changes reset.");
}

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveProfile();
});

saveProfileBtnTop?.addEventListener("click", async () => {
  await saveProfile();
});

profileResetBtn?.addEventListener("click", () => {
  resetProfileForm();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  await loadProfile(user);
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
});