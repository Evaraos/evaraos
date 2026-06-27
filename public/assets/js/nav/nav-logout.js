import {
  auth,
  signOut,
  clearSavedUserRole,
  clearSavedUserProfile
} from "../firebase.js";
import { closeMenu } from "./nav-menu.js";
import { buildHref } from "./nav-utils.js";

let logoutInProgress = false;

function clearSessionArtifacts() {
  clearSavedUserRole();
  clearSavedUserProfile();
  try {
    localStorage.removeItem("evaraos-user");
    localStorage.removeItem("evaraos-role");
    sessionStorage.removeItem("evaraos-user");
    sessionStorage.removeItem("evaraos-role");
  } catch {}
}

async function runLogout(button) {
  if (logoutInProgress) return;
  logoutInProgress = true;

  const previousLabel = button?.querySelector("strong")?.textContent || "Logout";
  button?.setAttribute("aria-busy", "true");
  button?.classList.add("is-loading");
  const label = button?.querySelector("strong");
  if (label) label.textContent = "Signing out…";

  try {
    closeMenu(false);
    clearSessionArtifacts();
    await signOut(auth);
  } catch (error) {
    console.warn("Firebase sign out returned an error; completing local logout:", error);
    clearSessionArtifacts();
  } finally {
    const destination = buildHref("login.html");
    if (window.EvaraLoader?.beginNavigationLoad) {
      window.EvaraLoader.beginNavigationLoad({
        title: "Signing out",
        subtitle: "Closing your secure Evaraos session."
      });
    }
    window.setTimeout(() => window.location.replace(destination), 80);
    if (label) label.textContent = previousLabel;
  }
}

export function bindLogout() {
  const button = document.getElementById("evaLogoutBtn");
  if (!button || button.dataset.logoutBound === "true") return false;
  button.dataset.logoutBound = "true";
  button.setAttribute("role", "button");
  button.setAttribute("tabindex", "0");

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    runLogout(button);
  });

  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    runLogout(button);
  });

  return true;
}
