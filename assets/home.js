import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getCurrentUserDoc } from "./auth.js";

function dashboardPath(role) {
  return role === "customer" ? "customer_dashboard.html" : "dashboard.html";
}

onAuthStateChanged(auth, async (user) => {
  const loginNavLink = document.getElementById("loginNavLink");
  const dashboardNavLink = document.getElementById("dashboardNavLink");
  const logoutHomeBtn = document.getElementById("logoutHomeBtn");
  const heroEnterLink = document.getElementById("heroEnterLink");
  const heroSecondaryLink = document.getElementById("heroSecondaryLink");

  if (!user) {
    loginNavLink.style.display = "";
    dashboardNavLink.style.display = "none";
    logoutHomeBtn.style.display = "none";
    heroEnterLink.href = "login.html";
    heroSecondaryLink.href = "login.html";
    return;
  }

  const userDoc = await getCurrentUserDoc(user);
  const path = dashboardPath(userDoc?.role || "customer");

  loginNavLink.style.display = "none";
  dashboardNavLink.style.display = "";
  dashboardNavLink.href = path;
  logoutHomeBtn.style.display = "";
  heroEnterLink.href = path;
  heroSecondaryLink.href = path;
  heroEnterLink.textContent = "Go to Dashboard";
  heroSecondaryLink.textContent = "Stay in Session";

  logoutHomeBtn.onclick = async () => {
    await signOut(auth);
    window.location.reload();
  };
});