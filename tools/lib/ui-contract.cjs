'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/assets/js/ui-assets.js'), 'utf8');
const assets = JSON.parse(source.match(/Object\.freeze\((\{[\s\S]*?\})\)/)[1]);
const redirects = { 'settings.html': '/settings-v2.html' };
function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return result;
}
function entries(html, relative) {
  // Analyze comment/tag tokens without sanitizing or rewriting the HTML source.
  const tags = [...html.matchAll(/<!--[\s\S]*?(?:-->|$)|<(script|link)\b[^>]*>/gi)]
    .filter(match => Boolean(match[1]));
  return tags.map(match => {
    const attrs = attributes(match[0]);
    const url = new URL(attrs.src || attrs.href || '', `https://ui.invalid/${relative}`);
    return { tag: match[1].toLowerCase(), attrs, url, raw: match[0], index: match.index };
  });
}
function pageFailures(html, relative) {
  if (redirects[relative]) {
    const target = redirects[relative];
    return html.includes(target) && /location\.replace\(/.test(html) && fs.existsSync(path.join(root, 'public', target))
      ? [] : [`${relative}: compatibility redirect must resolve to ${target}`];
  }
  const failures = [], found = entries(html, relative);
  for (const [name, url] of Object.entries(assets)) {
    const pathname = new URL(url, 'https://ui.invalid').pathname;
    const relevant = found.filter(entry => entry.url.pathname === pathname && (name.endsWith('Stylesheet') ? entry.tag === 'link' && entry.attrs.rel === 'stylesheet' : entry.tag === 'script'));
    if (relevant.length !== 1) failures.push(`${relative}: expected one ${name} entry, found ${relevant.length}`);
    for (const entry of relevant) {
      if (entry.url.pathname + entry.url.search !== url) failures.push(`${relative}: ${name} must use ${url}`);
      if (name.endsWith('Runtime') && entry.attrs.type !== 'module') failures.push(`${relative}: ${name} must be a module`);
      if (name === 'prepaint' && (/\s(?:async|defer)(?:\s|=|>)/i.test(entry.raw) || entry.attrs.type === 'module')) failures.push(`${relative}: prepaint must run before first paint`);
    }
  }
  const boot = found.find(entry => entry.url.pathname.endsWith('/adaptive-appearance-boot.js'));
  const css = found.find(entry => entry.url.pathname.endsWith('/theme.css'));
  if (boot && css && boot.index > css.index) failures.push(`${relative}: prepaint must precede theme CSS`);
  if (/theme-boot\.js|appearance-mode-fix\.js/.test(html)) failures.push(`${relative}: competing legacy theme entry`);
  if (/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:[,"\s]|$)/i.test(html)) failures.push(`${relative}: viewport must allow zoom`);
  return failures;
}
module.exports = { root, assets, attributes, entries, pageFailures, redirects };
