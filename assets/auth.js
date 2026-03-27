import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
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

export async function usernameExists(username, excludeUid = "") {
  const clean = (username || "").trim().toLowerCase();
  if (!clean) return false;

  const q = query(collection(db, "users"), where("username", "==", clean));
  const snap = await getDocs(q);

  if (snap.empty) return false;
  if (!excludeUid) return true;

  return snap.docs.some((d) => d.id !== excludeUid);
}

export async function signup(name, username, email, password, role) {
  const cleanName = (name || "").trim();
  const cleanUsername = (username || "").trim().toLowerCase();
  const cleanEmail = (email || "").trim().toLowerCase();

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
  const cleanUsername = (username || "").trim().toLowerCase();

  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const q = query(collection(db, "users"), where("username", "==", cleanUsername));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("Username not found.");
  }

  const userData = snap.docs[0].data();
  if (!userData?.email) {
    throw new Error("That account is missing an email.");
  }

  return signInWithEmailAndPassword(auth, userData.email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function resetPassword(email) {
  const cleanEmail = (email || "").trim().toLowerCase();
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
  const cleanUsername = (username || "").trim().toLowerCase();

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