#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "../public/ai_command.html");
const before = fs.readFileSync(file, "utf8");
const critical = `<style>
    html.boot-pending body{margin:0;overflow:hidden;touch-action:none}
    html.auth-pending body,body.auth-pending{opacity:0;pointer-events:none}
    body.dashboard-body{margin:0;min-height:100vh;background:transparent}
    body.app-loading #appRoot{visibility:hidden}
    body.app-ready #appRoot{visibility:visible}
  </style>`;

let after = before.replace(/<style>[\s\S]*?<\/style>/i, critical);

if (!after.includes("/assets/css/pages/ai-command.css")) {
  after = after.replace(
    /(<link rel="stylesheet" href="\/assets\/css\/app-system\.css\?v=[^"]+"\s*\/>)/i,
    `$1\n  <link rel="stylesheet" href="/assets/css/pages/ai-command.css?v=1" />`
  );
}

if (!after.includes('/assets/js/theme.js')) {
  after = after.replace(
    /(<script\s+type="module"\s+src="\/assets\/js\/route-guard\.js\?v=[^"]+"><\/script>)/i,
    `<script type="module" src="/assets/js/theme.js?v=50"></script>\n  $1`
  );
}

if (after !== before) {
  fs.writeFileSync(file, after, "utf8");
  console.log("Migrated public/ai_command.html appearance ownership.");
} else {
  console.log("AI Command page already migrated.");
}
