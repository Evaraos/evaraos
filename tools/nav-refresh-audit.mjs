import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the refresh coordinator independently of Firebase authentication.
const source = fs.readFileSync('public/assets/js/nav/nav-session.js', 'utf8');
const coordinator = source.slice(source.indexOf('async function performNavRefresh()'), source.indexOf('let refreshQueue'))
  .replaceAll('import("./nav-menu.js")', 'Promise.resolve(menuStub)');
async function scenario({ changed = false, closeWhileBinding = false } = {}) {
  let shell = {}, open = true, rebinds = 0, opens = 0, closes = 0;
  const context = vm.createContext({
    document: { getElementById: () => shell, body: { classList: { contains: () => open } } },
    renderNav: () => { if (changed) shell = {}; },
    applyProgress() {},
    rebindNavAfterRender: async () => { rebinds++; if (closeWhileBinding) open = false; },
    menuStub: { openMenu: () => { opens++; open = true; }, closeMenu: () => { closes++; open = false; } },
    console: { warn: (...args) => { throw new Error(args.join(' ')); } }
  });
  vm.runInContext(coordinator, context);
  for (let n = 0; n < 10; n++) await context.performNavRefresh();
  return { open, rebinds, opens, closes };
}
assert.deepEqual(await scenario(), { open: true, rebinds: 0, opens: 0, closes: 0 });
assert.deepEqual(await scenario({changed: true}), { open: true, rebinds: 10, opens: 10, closes: 0 });
assert.deepEqual(await scenario({changed: true, closeWhileBinding: true}), { open: false, rebinds: 10, opens: 0, closes: 0 });
console.log('PASS: unchanged refreshes preserve the drawer; changed shells rebind; closing during a bind stays closed.');
