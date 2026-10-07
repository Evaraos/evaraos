'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { assets } = require('./lib/ui-contract.cjs');

function harness(saved, dark = false) {
  const values = new Map(saved === undefined ? [] : [['evaraos-appearance', JSON.stringify(saved)]]);
  const properties = new Map(), styles = new Map(), events = [], samples = [];
  const root = {
    dataset: {},
    style: { setProperty: (name, value) => properties.set(name,value) },
    classList: { add() {}, remove() {} }, toggleAttribute() {}
  };
  const context = vm.createContext({
    URL, console, Date, setTimeout() {},
    location: { origin: 'https://ui.invalid', pathname: '/index.html' },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) },
    matchMedia: () => ({ matches: dark, addEventListener() {} }),
    addEventListener() {}, dispatchEvent: event => events.push(event),
    CustomEvent: class { constructor(type, options) { this.type=type;this.detail=options.detail; } },
    window: {},
    document: {
      documentElement: root, readyState: 'loading', addEventListener() {},
      querySelectorAll: () => [{ href: 'https://ui.invalid'+assets.themeStylesheet }],
      getElementById: id => styles.get(id), createElement: () => ({}),
      head: { appendChild: element => { styles.set(element.id,element); } }
    }
  });
  return { context, root, properties, styles, values, events, samples };
}
async function core(h) {
  const module = new vm.SourceTextModule(fs.readFileSync('public/assets/js/theme-core-adaptive.js','utf8'),{ context: h.context });
  await module.link(async specifier => {
    if (specifier.includes('ui-assets')) return new vm.SourceTextModule(fs.readFileSync('public/assets/js/ui-assets.js','utf8'),{ context:h.context });
    if (specifier.includes('text-inversion')) return new vm.SyntheticModule(['installUniversalTextInversion'],function(){this.setExport('installUniversalTextInversion',()=>{});},{context:h.context});
    return new vm.SyntheticModule(['initAdaptiveGlass','refreshAdaptiveGlass','getEffectiveWallpaper'],function(){
      this.setExport('initAdaptiveGlass',async(...args)=>h.samples.push(args));
      this.setExport('refreshAdaptiveGlass',()=>{});
      this.setExport('getEffectiveWallpaper',url=>url||'fallback');
    },{context:h.context});
  });
  await module.evaluate();return module.namespace;
}
const boot = fs.readFileSync('public/assets/js/adaptive-appearance-boot.js','utf8');

test('prepaint and runtime agree across system schemes, empty images and zero dimming',async()=>{
  for (const dark of [false,true]) for (const saved of [undefined, {}, {mode:'light'}, {mode:'dark'}, {mode:'system'}, {mode:'image'}, {mode:'image',imageUrl:'/assets/brand/evaraos-mark.png',wallpaperDim:0}, {mode:'image',imageUrl:'javascript:alert(1)',imagePosition:'invalid'}, {mode:'unknown'}, {mode:'image',imageUrl:'/wallpaper.png',imageOverlay:.5,glassTransparency:.5}]) {
    const h=harness(saved,dark);vm.runInContext(boot,h.context);
    const initial={...h.root.dataset}, dim=h.properties.get('--evara-wallpaper-dim'), position=h.properties.get('--evara-wallpaper-position'), tint=h.properties.get('--evara-glass-tint');
    const runtime=await core(h);await runtime.applyAppearance();
    assert.equal(h.root.dataset.themeMode,initial.themeMode);
    assert.equal(h.root.dataset.environment,initial.environment);
    assert.equal(h.properties.get('--evara-wallpaper-dim'),dim);
    assert.equal(h.properties.get('--evara-wallpaper-position'),position);
    assert.equal(h.properties.get('--evara-glass-tint'),tint);
    assert.equal(h.root.style.colorScheme,h.root.dataset.environment==='dark'?'dark':'light');
  }
});
test('theme switches update the canvas and supply the chosen image to sampling',async()=>{
  const h=harness({mode:'light'});vm.runInContext(boot,h.context);const runtime=await core(h);
  await runtime.applyAppearance();const light=h.properties.get('--evara-wallpaper-canvas');
  await runtime.setThemeMode('dark');assert.notEqual(h.properties.get('--evara-wallpaper-canvas'),light);
  assert.equal(h.root.dataset.environment,'dark');
  await runtime.setAppearance({mode:'image',imageUrl:'/assets/brand/evaraos-mark.png',wallpaperDim:0});
  assert.equal(h.samples.at(-1)[1],'https://ui.invalid/assets/brand/evaraos-mark.png');
  assert.equal(h.properties.get('--evara-wallpaper-dim'),'0');
  assert.match(h.styles.get('evaraPrepaintAuthority').textContent,/background:var\(--evara-wallpaper-canvas\)/);
});
test('save and reset return synchronous normalized settings and persistence failures are observable',async()=>{
  const h=harness();const runtime=await core(h);
  const saved=runtime.saveAppearance({mode:'light',glassTint:20});
  assert.equal(saved.then,undefined);assert.equal(saved.glassTint,.76);
  await runtime.applyAppearance(saved);
  assert.equal(JSON.parse(h.values.get('evaraos-appearance')).mode,'light');
  const reset=runtime.resetAppearance();assert.equal(reset.mode,'system');assert.equal(h.values.has('evaraos-appearance'),false);
  await runtime.applyAppearance(reset);
  h.context.localStorage.setItem=()=>{throw new Error('Quota exceeded');};
  assert.throws(()=>runtime.saveAppearance({mode:'dark'}),/Quota/);
});
