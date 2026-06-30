#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function check(name, condition, detail) {
  if (!condition) failures.push(`${name}: ${detail}`);
}

function syntax(relative) {
  const temporary = path.join(os.tmpdir(), `evaraos-${path.basename(relative, ".js")}-${process.pid}.mjs`);
  try {
    fs.writeFileSync(temporary, read(relative), "utf8");
    execFileSync(process.execPath, ["--check", temporary], { stdio: "pipe" });
  } catch (error) {
    failures.push(`${relative}: JavaScript syntax check failed\n${String(error.stderr || error.message)}`);
  } finally {
    try { fs.rmSync(temporary, { force: true }); } catch {}
  }
}

const javascriptFiles = [
  "public/assets/js/theme-adaptive.js",
  "public/assets/js/theme-text-inversion.js",
  "public/assets/js/theme-core-adaptive.js",
  "public/assets/js/theme.js",
  "public/assets/js/nav.js",
  "public/assets/js/nav/nav-main-v5.js",
  "public/assets/js/nav/nav-render.js",
  "public/assets/js/nav/nav-menu.js",
  "public/assets/js/nav/nav-interactions.js",
  "public/assets/js/nav/nav-bottom.js"
];
javascriptFiles.forEach(syntax);

const menuCss = read("public/assets/css/nav/nav-menu-liquid.css");
const cleanControls = read("public/assets/css/nav/nav-menu-clean-controls.css");
const bottomCss = read("public/assets/css/nav/nav-bottom.css");
const navRender = read("public/assets/js/nav/nav-render.js");
const materialCss = read("public/assets/css/theme/adaptive-material.css");
const componentsCss = read("public/assets/css/theme/adaptive-components.css");
const adaptiveJs = read("public/assets/js/theme-adaptive.js");
const textJs = read("public/assets/js/theme-text-inversion.js");
const navEntry = read("public/assets/js/nav.js");
const themeEntry = read("public/assets/js/theme.js");

check("drawer-width", menuCss.includes("width:min(75vw,460px)"), "drawer must cover 75% of mobile width and remain capped on desktop");
check("drawer-origin", menuCss.includes("inset:0 auto 0 0") && menuCss.includes("translate3d(-104%,0,0)"), "drawer must be full-height and enter from the left");
check("drawer-open", menuCss.includes("body.nav-menu-open .eva-menu-panel") && menuCss.includes("translate3d(0,0,0)"), "open state must restore the drawer to x=0");
check("hybrid-groups", navRender.includes("eva-menu-glass-group") && menuCss.includes(".eva-menu-glass-group"), "Account and AI must remain intentional glass groups");
check("flat-categories", navRender.includes('<section class="eva-app-section">') && !navRender.includes('<section class="eva-app-section" data-glass='), "application categories must remain flat sections");
check("no-control-glass-attributes", !navRender.includes('data-glass="control"'), "menu and top-nav controls must not receive the global control material");
check("selected-menu-only", cleanControls.includes('[data-active="true"]') && cleanControls.includes("background:transparent!important"), "menu rows must be transparent except selected or pressed states");
check("selected-bottom-only", bottomCss.includes('.eva-bottom-link.is-active') && bottomCss.includes("background:transparent") && bottomCss.includes('[aria-current="page"]'), "bottom-nav links must be transparent except the current page");

const materialControlLine = materialCss.split("\n").find(line => line.includes("--glass-x:28%")) || "";
check("nav-theme-separation", !materialControlLine.includes(",.eva-bottom-link,") && !materialControlLine.includes(",.eva-profile-trigger,") && !materialControlLine.includes(",.eva-top-alert,"), "global material must not force bubbles onto navigation controls");
check("no-difference-blend", !componentsCss.includes("mix-blend-mode:difference") && !adaptiveJs.includes("mix-blend-mode:difference"), "text inversion must not use glitch-prone difference blending");
check("animated-text-stops", componentsCss.includes("@property --adaptive-text-c0") && componentsCss.includes("background-clip:text"), "text gradients must use animated typed color stops");
check("cached-pixels", adaptiveJs.includes("pixels=x.getImageData") && adaptiveJs.includes("TEXT_X=[.04,.27,.5,.73,.96]"), "adaptive text must sample from a cached pixel buffer");
check("all-text-coverage", textJs.includes("createTreeWalker") && textJs.includes("NodeFilter.SHOW_TEXT"), "all visible text nodes must be wrapped for adaptive gradients");
check("nav-build", navEntry.includes("nav-v24-x-hybrid-drawer"), "navigation entry must load the audited v24 build");
check("theme-build", themeEntry.includes("adaptive-liquid-v5"), "theme entry must load the audited v5 build");

if (failures.length) {
  console.error(`Interface audit failed with ${failures.length} issue(s):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Interface audit passed: ${javascriptFiles.length} JavaScript files and 15 architecture checks.`);
