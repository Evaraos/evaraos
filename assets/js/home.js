import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
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
      setText(heroEnterLink, "Enter Platform");
    }

    if (heroSecondaryLink) {
      heroSecondaryLink.href = "/evaraos/companies.html";
      setText(heroSecondaryLink, "Get Started");
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
    setText(heroEnterLink, "Go to Dashboard");
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = path;
    setText(heroSecondaryLink, "Stay in Session");
  }

  if (logoutHomeBtn) {
    logoutHomeBtn.onclick = async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Home logout failed:", error);
      }
      window.location.href = "/evaraos/index.html";
    };
  }
});