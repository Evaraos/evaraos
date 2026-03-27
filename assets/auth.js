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

function cleanUsernameValue(username) {
  return (username || "").trim().toLowerCase();
}

function cleanEmailValue(email) {
  return (email || "").trim().toLowerCase();
}

export async function usernameExists(username, excludeUid = "") {
  const clean = cleanUsernameValue(username);
  if (!clean) return false;

  const q = query(collection(db, "users"), where("username", "==", clean));
  const snap = await getDocs(q);

  if (snap.empty) return false;
  if (!excludeUid) return true;

  return snap.docs.some((d) => d.id !== excludeUid);
}

export async function signup(name, username, email, password, role) {
  const cleanName = (name || "").trim();
  const cleanUsername = cleanUsernameValue(username);
  const cleanEmail = cleanEmailValue(email);

  if (!cleanName || !cleanUsername || !cleanEmail || !password || !role) {
    throw new Error("Missing required signup fields.");
  }

  const taken = await usernameExists(cleanUsername);
  if (taken) {
    throw new Error("That username is already taken.");
  }

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const isOwner = cleanEmail === OWNER_EMAIL;
  const defaults = getRoleDefaults(role, isOwner);

  await setDoc(doc(db, "users", cred.user.uid), {
    name: cleanName,
    username: cleanUsername,
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
}

export async function loginWithUsername(username, password) {
  const cleanUsername = cleanUsernameValue(username);

  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const q = query(collection(db, "users"), where("username", "==", cleanUsername));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("Username not found.");
  }

  const userDoc = snap.docs[0];
  const userData = userDoc.data();

  if (!userData?.email) {
    throw new Error("That account is missing an email.");
  }

  return signInWithEmailAndPassword(auth, cleanEmailValue(userData.email), password);
}

export async function logout() {
  return signOut(auth);
}

export async function resetPassword(email) {
  const cleanEmail = cleanEmailValue(email);
  if (!cleanEmail) {
    throw new Error("Email is required for password reset.");
  }

  return sendPasswordResetEmail(auth, cleanEmail);
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
  const cleanUsername = cleanUsernameValue(username);

  if (!cleanUsername) {
    throw new Error("Username is required.");
  }

  const taken = await usernameExists(cleanUsername, userId);
  if (taken) {
    throw new Error("That username is already taken.");
  }

  await updateDoc(doc(db, "users", userId), {
    username: cleanUsername,
    updatedAt: serverTimestamp()
  });
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

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
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