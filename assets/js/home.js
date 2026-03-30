import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function dashboardPath(role) {
  return role === "customer"
    ? "/evaraos/customer_dashboard.html"
    : "/evaraos/dashboard.html";
}

async function getCurrentUserDoc(user) {
  if (!user?.uid) return null;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error("Failed to load current user doc:", error);
    return null;
  }
}

function setDisplay(el, value) {
  if (!el) return;
  el.style.display = value;
}

onAuthStateChanged(auth, async (user) => {
  const loginNavLink = document.getElementById("loginNavLink");
  const dashboardNavLink = document.getElementById("dashboardNavLink");
  const logoutHomeBtn = document.getElementById("logoutHomeBtn");
  const heroEnterLink = document.getElementById("heroEnterLink");
  const heroSecondaryLink = document.getElementById("heroSecondaryLink");

  if (!user) {
    setDisplay(loginNavLink, "");
    setDisplay(dashboardNavLink, "none");
    setDisplay(logoutHomeBtn, "none");

    if (heroEnterLink) {
      heroEnterLink.href = "/evaraos/login.html";
      heroEnterLink.textContent = "Enter Platform";
    }

    if (heroSecondaryLink) {
      heroSecondaryLink.href = "/evaraos/companies.html";
      heroSecondaryLink.textContent = "Get Started";
    }

    return;
  }

  const userDoc = await getCurrentUserDoc(user);
  const path = dashboardPath(userDoc?.role || "customer");

  setDisplay(loginNavLink, "none");
  setDisplay(dashboardNavLink, "");
  setDisplay(logoutHomeBtn, "");

  if (dashboardNavLink) {
    dashboardNavLink.href = path;
  }

  if (heroEnterLink) {
    heroEnterLink.href = path;
    heroEnterLink.textContent = "Go to Dashboard";
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = path;
    heroSecondaryLink.textContent = "Stay in Session";
  }

  if (logoutHomeBtn) {
    logoutHomeBtn.onclick = async () => {
      await signOut(auth);
      window.location.href = "/evaraos/index.html";
    };
  }
});