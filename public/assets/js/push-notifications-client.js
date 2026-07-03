import "./evara-notifications.js";
import { auth, functions, onAuthStateChanged, httpsCallable } from "./firebase.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const VAPID_KEY = "BFpdd2wIIzS9CZfuX9MEJjcPz7ZzbJ-KQ76oBUsDDzVVk0iwfA_4sH21PbY6rUcMhxUW-kcByItA9GtUigsY5a4";
const PROMPT_KEY = "evaraos-push-permission-prompted-v1";
const TOKEN_KEY = "evaraos-fcm-token";
const SERVICE_WORKER_URL = "/firebase-messaging-sw.js?v=2";

let messaging = null;
let registration = null;
let foregroundUnsubscribe = null;
let authUnsubscribe = null;
let promptBound = false;

const registerPushToken = httpsCallable(functions, "registerPushToken");
const unregisterPushToken = httpsCallable(functions, "unregisterPushToken");

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
}

function dispatchStatus(status, detail = {}) {
  window.dispatchEvent(new CustomEvent("evara:push-status", { detail: { status, ...detail } }));
  window.dispatchEvent(new CustomEvent("evara:message-notification-permission", { detail: { permission: Notification.permission, status } }));
}

function toast(title, message, tone = "info") {
  window.dispatchEvent(new CustomEvent("evara:notify", {
    detail: { title, message, tone, timeout: 5200 }
  }));
}

async function ensureMessaging() {
  if (messaging && registration) return { messaging, registration };
  if (!(await isSupported())) throw new Error("Push notifications are not supported on this device.");

  registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    scope: "/",
    updateViaCache: "none"
  });
  await registration.update();
  await navigator.serviceWorker.ready;
  messaging = getMessaging(getApp());

  if (!foregroundUnsubscribe) {
    foregroundUnsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || "New message";
      const message = payload.notification?.body || "You received a new message.";
      toast(title, message);
      window.dispatchEvent(new CustomEvent("evara:push-message", { detail: payload }));
    });
  }

  return { messaging, registration };
}

async function saveToken(token) {
  if (!token) throw new Error("Firebase did not return a device token.");
  await registerPushToken({
    token,
    platform: isIos() ? "ios-web-push" : "web-push",
    userAgent: navigator.userAgent
  });
  localStorage.setItem(TOKEN_KEY, token);
  dispatchStatus("enabled", { tokenRegistered: true });
  return token;
}

export async function enablePhoneNotifications() {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      throw new Error("Notifications are not supported in this browser.");
    }

    if (isIos() && !isStandalone()) {
      showInstallPrompt();
      dispatchStatus("install-required");
      return "install-required";
    }

    localStorage.setItem(PROMPT_KEY, "1");
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") {
      dispatchStatus(permission);
      return permission;
    }

    const context = await ensureMessaging();
    const token = await getToken(context.messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: context.registration
    });
    await saveToken(token);
    toast("Notifications enabled", "Evaraos can now alert this phone when a new message arrives.", "success");
    return "granted";
  } catch (error) {
    console.error("Push notification setup failed:", error);
    dispatchStatus("error", { message: error.message });
    toast("Notifications could not be enabled", error.message || "Please try again.", "error");
    return "error";
  }
}

export async function disablePhoneNotifications() {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  if (token) await unregisterPushToken({ token }).catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
  dispatchStatus("disabled");
}

function ensurePromptStyles() {
  if (document.getElementById("evaraPushPromptStyles")) return;
  const style = document.createElement("style");
  style.id = "evaraPushPromptStyles";
  style.textContent = `.evara-push-prompt{position:fixed;inset:auto 14px max(18px,env(safe-area-inset-bottom));z-index:2147483647;margin:auto;width:min(460px,calc(100vw - 28px));padding:18px;border:1px solid color-mix(in srgb,var(--text-primary) 16%,transparent);border-radius:26px;color:var(--text-primary);background:color-mix(in srgb,var(--glass-bg-strong) 96%,transparent);box-shadow:0 22px 70px rgba(0,0,0,.28);backdrop-filter:blur(28px) saturate(175%);-webkit-backdrop-filter:blur(28px) saturate(175%)}.evara-push-prompt[hidden]{display:none}.evara-push-prompt h2{margin:0 0 7px;font-size:1.05rem}.evara-push-prompt p{margin:0;color:var(--text-secondary);line-height:1.42}.evara-push-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.evara-push-actions button{min-height:46px;border-radius:999px;font:inherit;font-weight:760}.evara-push-enable{color:#fff!important;background:#0a84ff!important;border-color:transparent!important}`;
  document.head.appendChild(style);
}

function showPrompt({ installOnly = false } = {}) {
  ensurePromptStyles();
  let prompt = document.getElementById("evaraPushPrompt");
  if (!prompt) {
    prompt = document.createElement("section");
    prompt.id = "evaraPushPrompt";
    prompt.className = "evara-push-prompt";
    prompt.setAttribute("role", "dialog");
    prompt.setAttribute("aria-modal", "true");
    document.body.appendChild(prompt);
  }

  prompt.innerHTML = installOnly
    ? `<h2>Add Evaraos to your Home Screen</h2><p>On iPhone, phone notifications work after Evaraos is installed from Safari using Share → Add to Home Screen. Open the installed app, then enable notifications once.</p><div class="evara-push-actions"><button type="button" data-push-dismiss>Got it</button><button type="button" class="evara-push-enable" data-push-dismiss>Close</button></div>`
    : `<h2>Stay notified about messages</h2><p>Allow Evaraos to send this phone a notification whenever someone messages you, even when the app is not open.</p><div class="evara-push-actions"><button type="button" data-push-dismiss>Not now</button><button type="button" class="evara-push-enable" data-push-enable>Enable Notifications</button></div>`;
  prompt.hidden = false;
}

function showInstallPrompt() {
  showPrompt({ installOnly: true });
}

function bindPromptEvents() {
  if (promptBound) return;
  promptBound = true;
  document.addEventListener("click", async (event) => {
    const enable = event.target.closest("[data-push-enable]");
    const dismiss = event.target.closest("[data-push-dismiss]");
    if (enable) {
      document.getElementById("evaraPushPrompt")?.setAttribute("hidden", "");
      await enablePhoneNotifications();
    } else if (dismiss) {
      localStorage.setItem(PROMPT_KEY, "1");
      document.getElementById("evaraPushPrompt")?.setAttribute("hidden", "");
    }
  });
}

async function refreshExistingToken() {
  if (Notification.permission !== "granted") return;
  const context = await ensureMessaging();
  const token = await getToken(context.messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: context.registration
  });
  await saveToken(token);
}

function maybeShowOneTimePrompt() {
  if (Notification.permission !== "default") return;
  if (localStorage.getItem(PROMPT_KEY)) return;
  setTimeout(() => showPrompt({ installOnly: isIos() && !isStandalone() }), 900);
}

export function startPushNotifications() {
  bindPromptEvents();
  if (authUnsubscribe) return stopPushNotifications;

  authUnsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) return;
    if (Notification.permission === "granted") refreshExistingToken().catch(console.warn);
    else maybeShowOneTimePrompt();
  });

  return stopPushNotifications;
}

export function stopPushNotifications() {
  if (authUnsubscribe) authUnsubscribe();
  authUnsubscribe = null;
  if (foregroundUnsubscribe) foregroundUnsubscribe();
  foregroundUnsubscribe = null;
}

window.EvaraPushNotifications = {
  start: startPushNotifications,
  stop: stopPushNotifications,
  enable: enablePhoneNotifications,
  disable: disablePhoneNotifications
};
