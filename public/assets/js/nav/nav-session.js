import { NAV_STATE } from "./nav-config.js";
import { isCanonicalPublicRoute, isVerifiedSession, syncThemeLabel } from "./nav-utils.js";
import { canAccessPageName } from "../access-control.js";
import { applyProgress } from "./nav-scroll.js";
import { renderNav } from "./nav-render.js";

const NAV_BUILD = "nav-v60-shell-recovery";
const VERIFIED_PUBLIC_HOME_SOURCE = "verified-public-home";
let publicHomeSessionStarted = false;
let publicHomeSessionSequence = 0;

function isPublicHomeRoute() {
  const mode = document.body?.dataset?.routeGuard || "";
  const path = window.location.pathname.toLowerCase();
  return mode === "public" && (path === "/" || path.endsWith("/index.html"));
}

function isPublicBottomNavRoute() {
  return canAccessPageName(window.location.pathname, "guest");
}

function publishPublicHomeSession(detail = {}) {
  const session = Object.freeze({
    authenticated: Boolean(detail.authenticated),
    role: String(detail.role || "").trim().toLowerCase(),
    userId: String(detail.userId || "").trim(),
    lifecycle: String(detail.lifecycle || "").trim(),
    status: String(detail.status || "").trim(),
    approvalStatus: String(detail.approvalStatus || "").trim(),
    displayName: String(detail.displayName || "").trim(),
    email: String(detail.email || "").trim(),
    source: VERIFIED_PUBLIC_HOME_SOURCE,
    mode: "public",
    error: Boolean(detail.error),
    at: Date.now()
  });
  window.EvaraRouteSession = session;
  window.dispatchEvent(new CustomEvent("evara:session-ready", { detail: session }));
  return session;
}

async function publishVerifiedPublicHomeSession(user, verifiedProfile, resolveAccountLifecycle, sequence) {
  if (!isPublicHomeRoute() || sequence !== publicHomeSessionSequence) return null;

  if (!user) {
    return publishPublicHomeSession({ authenticated: false, lifecycle: "guest" });
  }

  const profile = await verifiedProfile(user);
  if (!isPublicHomeRoute() || sequence !== publicHomeSessionSequence) return null;

  const lifecycle = resolveAccountLifecycle(profile);
  if (!lifecycle.active) {
    return publishPublicHomeSession({
      authenticated: false,
      lifecycle: lifecycle.state,
      status: lifecycle.status,
      approvalStatus: lifecycle.approvalStatus
    });
  }

  return publishPublicHomeSession({
    authenticated: true,
    role: lifecycle.role,
    userId: user.uid || "",
    lifecycle: lifecycle.state,
    status: lifecycle.status,
    approvalStatus: lifecycle.approvalStatus,
    displayName: profile?.displayName || user.displayName || "",
    email: profile?.email || user.email || ""
  });
}

export async function startVerifiedPublicHomeSession() {
  if (!isPublicHomeRoute() || publicHomeSessionStarted) return;
  publicHomeSessionStarted = true;

  try {
    const [firebase, profile, lifecycle] = await Promise.all([
      import("../firebase.js"),
      import("../verified-profile.js"),
      import("../account-lifecycle.js")
    ]);

    firebase.onAuthStateChanged(firebase.auth, (user) => {
      const sequence = ++publicHomeSessionSequence;
      publishVerifiedPublicHomeSession(
        user,
        profile.readVerifiedUserProfile,
        lifecycle.resolveAccountLifecycle,
        sequence
      ).catch((error) => {
        if (!isPublicHomeRoute() || sequence !== publicHomeSessionSequence) return;
        console.warn("Verified public Home session failed:", error);
        publishPublicHomeSession({ authenticated: false, lifecycle: "verification_required", error: true });
      });
    });
  } catch (error) {
    console.warn("Verified public Home session bootstrap failed:", error);
    publishPublicHomeSession({ authenticated: false, lifecycle: "verification_required", error: true });
  }
}

async function loadCanonicalBinders() {
  const [events, menu, interactions] = await Promise.all([
    import(`./nav-events.js?v=${NAV_BUILD}`),
    import(`./nav-menu.js?v=${NAV_BUILD}`),
    import(`./nav-interactions.js?v=${NAV_BUILD}`)
  ]);
  return { events, menu, interactions };
}

function restoreBottomNavAfterRender() {
  if (document.body?.dataset?.routeGuard === "auth" && !isPublicBottomNavRoute()) return;
  import("./nav-bottom.js?v=nav-v60-shell-recovery")
    .then(({ mountBottomNav }) => mountBottomNav())
    .catch((error) => console.warn("Bottom nav restore failed:", error));
}

export async function rebindNavAfterRender() {
  const binders = await loadCanonicalBinders();
  binders.menu.bindMenu();

  if (!isCanonicalPublicRoute() || isVerifiedSession()) {
    binders.events.bindAllNavEvents();
    binders.interactions.bindNavInteractions();

    if (document.getElementById("evaLogoutBtn")) {
      const { bindLogout } = await import(`./nav-logout.js?v=${NAV_BUILD}`);
      bindLogout();
    }
  }
  syncThemeLabel();
  restoreBottomNavAfterRender();
}

export async function refreshNav() {
  try {
    const wasOpen = document.body.classList.contains("nav-menu-open");
    let menu = null;
    if (wasOpen) {
      menu = await import(`./nav-menu.js?v=${NAV_BUILD}`);
      menu.closeMenu(false);
    }

    renderNav();

    applyProgress();
    await rebindNavAfterRender();

    if (wasOpen) {
      menu ||= await import(`./nav-menu.js?v=${NAV_BUILD}`);
      menu.openMenu();
    }
  } catch (error) {
    console.warn("Nav refresh failed:", error);
  }
}

export function bindRuntimeRefresh() {
  if (NAV_STATE.sessionRefreshBound) return;
  NAV_STATE.sessionRefreshBound = true;

  window.addEventListener("evara:session-ready", refreshNav);

  window.addEventListener("storage", (event) => {
    if (!isPublicHomeRoute() && ["evaraos-user", "evaraos-role"].includes(event.key)) refreshNav();
    if (event.key === "evaraos-appearance") syncThemeLabel();
  });

  window.addEventListener("evara:theme-applied", syncThemeLabel);
  window.addEventListener("evara:appearance-updated", syncThemeLabel);

  window.addEventListener("pageshow", () => {
    NAV_STATE.isNavigating = false;
    window.EvaraTheme?.applyAppearance?.();
    applyProgress(1);

    if (window.EvaraLoader && typeof window.EvaraLoader.completeNavigationLoad === "function") {
      window.EvaraLoader.completeNavigationLoad();
    } else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}
