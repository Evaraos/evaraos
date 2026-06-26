#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pages = [
  "public/revenue.html",
  "public/schedule.html",
  "public/payment_ops.html",
  "public/customer_portal.html",
  "public/messages.html",
  "public/ledger.html",
  "public/notifications_center.html",
  "public/analytics.html",
  "public/field.html",
  "public/predictive_ops.html",
  "public/company_intelligence.html",
  "public/dispatch_intelligence.html",
  "public/customer_bills.html",
  "public/proximity_dispatch.html",
  "public/operations_map.html",
  "public/onboarding.html",
  "public/territory_intelligence.html",
  "public/payroll.html",
  "public/dispatch_map.html",
  "public/job_billing.html"
];

function migrate(content) {
  let next = content;

  if (!next.includes("theme-boot.js")) {
    next = next.replace(/(<title>[\s\S]*?<\/title>)/i, `$1\n  <script src="/assets/js/theme-boot.js?v=50"></script>`);
  }

  if (!next.includes('/assets/js/theme.js')) {
    next = next.replace(
      /(<script\s+type="module"\s+src="\/assets\/js\/route-guard\.js(?:\?v=[^"]+)?"><\/script>)/i,
      `<script type="module" src="/assets/js/theme.js?v=50"></script>\n  $1`
    );
  }

  next = next
    .replace(/href="\/assets\/css\/base\.css(?:\?v=[^"]+)?"/gi, 'href="/assets/css/base.css?v=50"')
    .replace(/href="\/assets\/css\/theme\.css(?:\?v=[^"]+)?"/gi, 'href="/assets/css/theme.css?v=50"')
    .replace(/href="\/assets\/css\/nav\.css(?:\?v=[^"]+)?"/gi, 'href="/assets/css/nav.css?v=nav-v4"')
    .replace(/href="\/assets\/css\/dashboard\.css(?:\?v=[^"]+)?"/gi, 'href="/assets/css/dashboard.css?v=50"')
    .replace(/href="\/assets\/css\/app-system\.css(?:\?v=[^"]+)?"/gi, 'href="/assets/css/app-system.css?v=50"')
    .replace(/src="\/assets\/js\/nav\.js(?:\?v=[^"]+)?"/gi, 'src="/assets/js/nav.js?v=50"')
    .replace(/html,body\{background:#f4f7f6\}/g, "")
    .replace(/body\{margin:0;background:#f4f7f6\}/g, "body{margin:0;background:transparent}")
    .replace(/background:rgba\(255,255,255,\.1\)/g, "background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom))")
    .replace(/background:rgba\(255,255,255,\.09\)/g, "background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom))")
    .replace(/background:rgba\(255,255,255,\.08\)/g, "background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom))")
    .replace(/background:rgba\(255,255,255,\.07\)/g, "background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom))")
    .replace(/background:rgba\(255,255,255,\.06\)/g, "background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom))")
    .replace(/border:1px solid rgba\(255,255,255,\.(?:14|16|18)\)/g, "border:1px solid var(--liquid-border)")
    .replace(/color:rgba\(255,255,255,\.(?:68|7|74|78)\)/g, "color:var(--text-secondary)")
    .replace(/color:#fff/g, "color:var(--text-primary)")
    .replace(/var\(--text-muted,rgba\(255,255,255,\.(?:68|7|74|78)\)\)/g, "var(--text-secondary)")
    .replace(/var\(--text-primary,#fff\)/g, "var(--text-primary)")
    .replace(/var\(--theme-primary,#ff2f57\)/g, "var(--accent-red)");

  return next;
}

const changed = [];
for (const relative of pages) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const after = migrate(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed.push(relative);
  }
}

console.log(`Migrated ${changed.length} operations page(s).`);
for (const file of changed) console.log(`- ${file}`);
