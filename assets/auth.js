import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db, OWNER_EMAIL, DEFAULT_COMPANY_ID } from "./firebase.js";

function getRoleDefaults(role, isOwner = false) {
  if (isOwner) {
    return {
      finalRole: "super_admin",
      approvalStatus: "approved",
      organizationLevel: 1,
      permissions: ["all"],
      companyAccessLevel: "parent"
    };
  }

  const map = {
    admin: {
      finalRole: "admin",
      approvalStatus: "pending",
      organizationLevel: 2,
      permissions: ["manage_users", "approve", "full_company"],
      companyAccessLevel: "subsidiary"
    },
    manager: {
      finalRole: "manager",
      approvalStatus: "pending",
      organizationLevel: 3,
      permissions: ["leads", "jobs", "customers"],
      companyAccessLevel: "subsidiary"
    },
    operations_coordinator: {
      finalRole: "operations_coordinator",
      approvalStatus: "pending",
      organizationLevel: 3,
      permissions: ["jobs", "customers"],
      companyAccessLevel: "subsidiary"
    },
    hr: {
      finalRole: "hr",
      approvalStatus: "pending",
      organizationLevel: 3,
      permissions: ["users", "staff"],
      companyAccessLevel: "subsidiary"
    },
    sales_rep: {
      finalRole: "sales_rep",
      approvalStatus: "pending",
      organizationLevel: 4,
      permissions: ["leads", "convert"],
      companyAccessLevel: "subsidiary"
    },
    technician: {
      finalRole: "technician",
      approvalStatus: "pending",
      organizationLevel: 5,
      permissions: ["jobs"],
      companyAccessLevel: "subsidiary"
    },
    customer: {
      finalRole: "customer",
      approvalStatus: "approved",
      organizationLevel: 6,
      permissions: ["self"],
      companyAccessLevel: "subsidiary"
    }
  };

  return map[role] || map.customer;
}

function sanitizeUsername(raw) {
  return (raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
}

function makeDisplayUsername(username) {
  if (!username) return "";
  return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
}

function makeHandle(username) {
  return username ? `@${username}` : "";
}

function cleanEmailValue(email) {
  return (email || "").trim().toLowerCase();
}

export function normalizeUsernameInput(raw) {
  return sanitizeUsername(raw);
}

export function buildUserIdentity(username) {
  const clean = sanitizeUsername(username);
  return {
    username: clean,
    handle: makeHandle(clean),
    displayUsername: makeDisplayUsername(clean)
  };
}

export function formatAuthError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  const map = {
    "auth/email-already-in-use": "That email is already in use.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "Account not found.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect username/email or password.",
    "auth/too-many-requests": "Too many attempts. Try again in a moment.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/requires-recent-login": "For security, log in again before changing your password."
  };

  if (map[code]) return map[code];

  if (message.includes("Missing or insufficient permissions")) {
    return "Permissions issue detected. Check Firestore rules or access settings.";
  }

  return message || "Something went wrong. Please try again.";
}

export async function usernameExists(username, excludeUid = "") {
  const clean = sanitizeUsername(username);
  if (!clean) return false;

  const q = query(collection(db, "users"), where("username", "==", clean));
  const snap = await getDocs(q);

  if (snap.empty) return false;
  if (!excludeUid) return true;

  return snap.docs.some((d) => d.id !== excludeUid);
}

export async function generateUsernameSuggestions(rawUsername) {
  const base = sanitizeUsername(rawUsername);
  if (!base) return [];

  const suggestions = [];
  const seedValues = [
    base,
    `${base}1`,
    `${base}7`,
    `${base}9`,
    `${base}22`,
    `${base}101`,
    `${base}_official`,
    `${base}.hq`,
    `${base}.inc`,
    `${base}_group`,
    `${base}_team`,
    `${base}_co`
  ];

  for (const value of seedValues) {
    const clean = sanitizeUsername(value);
    if (!clean) continue;
    if (suggestions.includes(clean)) continue;

    const taken = await usernameExists(clean);
    if (!taken) suggestions.push(clean);
    if (suggestions.length >= 6) break;
  }

  if (suggestions.length < 6) {
    let counter = 111;
    while (suggestions.length < 6) {
      const candidate = `${base}${counter}`;
      const taken = await usernameExists(candidate);
      if (!taken && !suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
      counter += 37;
    }
  }

  return suggestions.map((item) => ({
    username: item,
    handle: makeHandle(item),
    displayUsername: makeDisplayUsername(item)
  }));
}

export async function signup(name, username, email, password, role) {
  const cleanName = (name || "").trim();
  const cleanEmail = cleanEmailValue(email);
  const identity = buildUserIdentity(username);

  if (!cleanName || !identity.username || !cleanEmail || !password || !role) {
    throw new Error("Complete all required signup fields.");
  }

  if (identity.username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  const taken = await usernameExists(identity.username);
  if (taken) {
    throw new Error("That username is already taken.");
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const isOwner = cleanEmail === OWNER_EMAIL;
    const defaults = getRoleDefaults(role, isOwner);

    await setDoc(doc(db, "users", cred.user.uid), {
      name: cleanName,
      username: identity.username,
      handle: identity.handle,
      displayUsername: identity.displayUsername,
      email: cleanEmail,
      role: defaults.finalRole,
      approvalStatus: defaults.approvalStatus,
      status: "active",
      companyId: DEFAULT_COMPANY_ID,
      companyAccessLevel: defaults.companyAccessLevel,
      photoUrl: "",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      reportsTo: cred.user.uid,
      organizationLevel: defaults.organizationLevel,
      permissions: defaults.permissions,
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      preferredContactMethod: "",
      updatedAt: serverTimestamp()
    });

    return cred;
  } catch (error) {
    throw new Error(formatAuthError(error));
  }
}

export async function loginWithUsername(usernameOrHandle, password) {
  const cleanUsername = sanitizeUsername(usernameOrHandle);

  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  try {
    const q = query(collection(db, "users"), where("username", "==", cleanUsername));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error("Username not found.");
    }

    const userData = snap.docs[0].data();

    if (!userData?.email) {
      throw new Error("That account is missing an email.");
    }

    return await signInWithEmailAndPassword(auth, cleanEmailValue(userData.email), password);
  } catch (error) {
    throw new Error(formatAuthError(error));
  }
}

export async function logout() {
  return signOut(auth);
}

export async function resetPassword(email) {
  const cleanEmail = cleanEmailValue(email);

  if (!cleanEmail) {
    throw new Error("Email is required for password reset.");
  }

  try {
    return await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    throw new Error(formatAuthError(error));
  }
}

export async function getCurrentUserDoc(user) {
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;

  return {
    uid: user.uid,
    id: user.uid,
    ...snap.data()
  };
}

export async function updateOwnUsername(userId, username) {
  const identity = buildUserIdentity(username);

  if (!identity.username) {
    throw new Error("Username is required.");
  }

  if (identity.username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  const taken = await usernameExists(identity.username, userId);
  if (taken) {
    throw new Error("That username is already taken.");
  }

  await updateDoc(doc(db, "users", userId), {
    username: identity.username,
    handle: identity.handle,
    displayUsername: identity.displayUsername,
    updatedAt: serverTimestamp()
  });

  return identity;
}

export async function changeOwnPassword(currentPassword, newPassword) {
  const user = auth.currentUser;

  if (!user?.email) {
    throw new Error("You must be logged in to change your password.");
  }

  if (!currentPassword || !newPassword) {
    throw new Error("Current and new password are required.");
  }

  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(formatAuthError(error));
  }
}

export function listenAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    const current = await getCurrentUserDoc(user);
    if (!current) {
      callback(null);
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        lastLogin: serverTimestamp()
      });
    } catch (e) {
      console.warn("Failed to update lastLogin", e);
    }

    callback(current);
  });
}