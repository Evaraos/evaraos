(function () {
  var fallbackTimer = null;
  var bindAttempts = 0;

  function closest(target, selector) {
    if (!target) return null;
    if (target.closest) return target.closest(selector);
    if (target.parentElement && target.parentElement.closest) return target.parentElement.closest(selector);
    return null;
  }

  function updateAppleLabel() {
    var apple = document.getElementById("evaInstallApple");
    var label = apple && apple.querySelector(".eva-install-copy small");
    if (label) label.textContent = "Coming Soon";
  }

  function ensureNoticeStyles() {
    if (document.getElementById("evaraInstallFallbackStyles")) return;
    var style = document.createElement("style");
    style.id = "evaraInstallFallbackStyles";
    style.textContent = [
      ".evara-install-notice{position:fixed!important;left:50%!important;bottom:max(118px,calc(env(safe-area-inset-bottom) + 96px))!important;z-index:2147483647!important;width:min(92vw,430px)!important;display:grid!important;place-items:center!important;opacity:0;pointer-events:none!important;transform:translateX(-50%) translateY(16px) scale(.98)!important;transition:opacity .18s ease,transform .18s ease!important;}",
      ".evara-install-notice.show{opacity:1!important;transform:translateX(-50%) translateY(0) scale(1)!important;}",
      ".evara-install-notice-card{width:100%!important;display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:12px!important;padding:13px!important;border-radius:26px!important;background:rgba(255,255,255,.94)!important;border:1px solid rgba(255,255,255,.96)!important;box-shadow:0 20px 58px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.98)!important;backdrop-filter:blur(30px) saturate(180%)!important;-webkit-backdrop-filter:blur(30px) saturate(180%)!important;pointer-events:auto!important;}",
      ".evara-install-notice-icon{width:42px!important;height:42px!important;border-radius:16px!important;background:rgba(255,255,255,.78) url('/assets/img/evaraos_logo.png') center/78% 78% no-repeat!important;border:1px solid rgba(255,255,255,.92)!important;box-shadow:0 10px 22px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.96)!important;}",
      ".evara-install-notice-copy strong{display:block!important;font-weight:950!important;font-size:1rem!important;line-height:1.05!important;letter-spacing:-.035em!important;color:#101917!important;}",
      ".evara-install-notice-copy small{display:block!important;margin-top:3px!important;font-weight:800!important;font-size:.76rem!important;line-height:1.15!important;color:rgba(60,60,67,.68)!important;}",
      ".evara-install-notice-close{width:40px!important;height:40px!important;border:0!important;border-radius:999px!important;background:rgba(120,120,128,.13)!important;color:#101917!important;font-size:1.18rem!important;font-weight:950!important;display:flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;}",
      "@media(max-width:480px){.evara-install-notice{bottom:max(104px,calc(env(safe-area-inset-bottom) + 86px))!important;width:min(92vw,410px)!important;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function makeNotice() {
    var notice = document.getElementById("evaraInstallNotice");
    if (notice) return notice;
    ensureNoticeStyles();
    notice = document.createElement("div");
    notice.id = "evaraInstallNotice";
    notice.className = "evara-install-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = '<div class="evara-install-notice-card"><span class="evara-install-notice-icon" aria-hidden="true"></span><span class="evara-install-notice-copy"><strong></strong><small></small></span><button type="button" class="evara-install-notice-close" aria-label="Close"><span aria-hidden="true">×</span></button></div>';
    notice.querySelector(".evara-install-notice-close").addEventListener("click", function () {
      notice.classList.remove("show");
    });
    document.body.appendChild(notice);
    return notice;
  }

  function showFallbackNotice(title, message) {
    var notice = makeNotice();
    var strong = notice.querySelector("strong");
    var small = notice.querySelector("small");
    if (strong) strong.textContent = title;
    if (small) small.textContent = message;
    clearTimeout(fallbackTimer);
    requestAnimationFrame(function () {
      notice.classList.add("show");
    });
    fallbackTimer = setTimeout(function () {
      notice.classList.remove("show");
    }, 4200);
  }

  function openMenuFallback() {
    var zone = document.getElementById("evaMenuZone");
    var button = document.getElementById("evaMenuBtn");
    var panel = document.getElementById("evaMenuPanel");
    var backdrop = document.getElementById("evaBackdrop");
    if (!zone || !button || !panel) return;

    document.body.classList.add("nav-menu-open");
    zone.classList.add("open");
    panel.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    button.setAttribute("aria-expanded", "true");
  }

  function closeMenuFallback() {
    var zone = document.getElementById("evaMenuZone");
    var button = document.getElementById("evaMenuBtn");
    var panel = document.getElementById("evaMenuPanel");
    var backdrop = document.getElementById("evaBackdrop");

    document.body.classList.remove("nav-menu-open");
    if (zone) zone.classList.remove("open");
    if (panel) panel.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    if (button) button.setAttribute("aria-expanded", "false");

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
  }

  function bindInstallButtons() {
    updateAppleLabel();

    var apple = document.getElementById("evaInstallApple");
    if (apple && apple.dataset.evaraStableInstall !== "true") {
      apple.dataset.evaraStableInstall = "true";
      apple.addEventListener("click", function () {
        updateAppleLabel();
        setTimeout(function () {
          if (!document.getElementById("evaraIOSInstallGuide") && window.EvaraInstall && typeof window.EvaraInstall.openIOSInstallGuide === "function") {
            window.EvaraInstall.openIOSInstallGuide();
          }
        }, 80);
      });
    }

    var android = document.getElementById("evaInstallAndroid");
    if (android && android.dataset.evaraStableInstall !== "true") {
      android.dataset.evaraStableInstall = "true";
      android.addEventListener("click", function () {
        setTimeout(function () {
          var notice = document.getElementById("evaraInstallNotice");
          if (notice && notice.classList.contains("show")) return;
          showFallbackNotice("Android Install", "Open Chrome menu and tap Install app.");
        }, 140);
      });
    }
  }

  function bindMenuRescue() {
    var button = document.getElementById("evaMenuBtn");
    if (!button || button.dataset.evaraMenuRescue === "true") return;
    button.dataset.evaraMenuRescue = "true";

    button.addEventListener("click", function () {
      var wasOpen = document.body.classList.contains("nav-menu-open");
      setTimeout(function () {
        var stillOpen = document.body.classList.contains("nav-menu-open");
        if (stillOpen !== wasOpen) return;
        if (wasOpen) closeMenuFallback();
        else openMenuFallback();
      }, 140);
    }, true);
  }

  function bindAll() {
    bindAttempts += 1;
    bindInstallButtons();
    bindMenuRescue();
    if (bindAttempts < 12) setTimeout(bindAll, 250);
  }

  function boot() {
    bindAll();
    document.addEventListener("click", function (event) {
      var android = closest(event.target, "#evaInstallAndroid");
      var apple = closest(event.target, "#evaInstallApple");
      if (!android && !apple) return;
      updateAppleLabel();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
