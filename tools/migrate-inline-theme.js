#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const IGNORE = new Set([".git", "node_modules", "tools/reports"]);

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(ROOT, absolute).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (!IGNORE.has(entry.name) && !IGNORE.has(relative)) walk(absolute, output);
    } else if (entry.name.endsWith(".html")) {
      output.push(relative);
    }
  }
  return output;
}

function replaceLegacyBootScripts(content) {
  return content.replace(/<script>([\s\S]*?)<\/script>/gi, (block, source) => {
    const writesTheme = /setAttribute\(["']data-theme["']/.test(source);
    const readsAppearance = /evaraos-appearance/.test(source);
    if (!writesTheme || !readsAppearance) return block;

    const preserveAuthPending = /auth-pending/.test(source);
    return preserveAuthPending
      ? '<script src="/assets/js/theme-boot.js?v=50"></script>\n  <script>document.documentElement.classList.add("auth-pending");</script>'
      : '<script src="/assets/js/theme-boot.js?v=50"></script>';
  });
}

function migrate(content) {
  return replaceLegacyBootScripts(content)
    .replace(/<script\s+src="\/assets\/js\/theme-boot\.js\?v=[^"]+"><\/script>/gi, '<script src="/assets/js/theme-boot.js?v=50"></script>')
    .replace(/<script\s+type="module"\s+src="\/assets\/js\/theme\.js\?v=[^"]+"><\/script>/gi, '<script type="module" src="/assets/js/theme.js?v=50"></script>')
    .replace(/<script\s+type="module"\s+src="\/assets\/js\/nav\.js\?v=[^"]+"><\/script>/gi, '<script type="module" src="/assets/js/nav.js?v=50"></script>')
    .replace(/\s*<script\s+src="\/assets\/js\/theme-css-loader\.js\?v=[^"]+"><\/script>/gi, "")
    .replace(/href="\/assets\/css\/base\.css\?v=[^"]+"/gi, 'href="/assets/css/base.css?v=50"')
    .replace(/href="\/assets\/css\/theme\.css\?v=[^"]+"/gi, 'href="/assets/css/theme.css?v=50"')
    .replace(/href="\/assets\/css\/nav\.css\?v=[^"]+"/gi, 'href="/assets/css/nav.css?v=nav-v4"')
    .replace(/href="\/assets\/css\/dashboard\.css\?v=[^"]+"/gi, 'href="/assets/css/dashboard.css?v=50"')
    .replace(/href="\/assets\/css\/home\.css\?v=[^"]+"/gi, 'href="/assets/css/home.css?v=50"')
    .replace(/href="\/assets\/css\/auth\.css\?v=[^"]+"/gi, 'href="/assets/css/auth.css?v=50"')
    .replace(/href="\/assets\/css\/app-system\.css\?v=[^"]+"/gi, 'href="/assets/css/app-system.css?v=50"')
    .replace(/\s*html\s*,\s*body\s*\{\s*background:\s*#f4f7f6;\s*\}/gi, "")
    .replace(/\s*html\[data-theme="light"\]\s*,?\s*html\[data-theme="light"\]\s+body\s*\{\s*background:\s*#f4f7f6;\s*\}/gi, "")
    .replace(/\s*html\[data-theme="dark"\]\s*,?\s*html\[data-theme="dark"\]\s+body\s*\{\s*background:\s*#020307;\s*\}/gi, "");
}

const changed = [];
for (const file of walk(ROOT)) {
  const absolute = path.join(ROOT, file);
  const before = fs.readFileSync(absolute, "utf8");
  const after = migrate(before);
  if (after !== before) {
    fs.writeFileSync(absolute, after, "utf8");
    changed.push(file);
  }
}

console.log(`Migrated ${changed.length} HTML file(s).`);
for (const file of changed) console.log(`- ${file}`);
