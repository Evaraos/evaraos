'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { assets } = require('./lib/ui-contract.cjs');

function harness(saved, dark = false) {
  const values = new Map(saved === undefined ? [] : [['evaraos-appearance', JSON.stringify(saved)]]);
  const properties = new Map(), styles = new Map(), events = [], samples = [];
  const mediaListeners = [];
  let schemeIsDark = dark;
  const root = {
    dataset: {},
    style: { setProperty: (name, value) => properties.set(name,value) },
    classList: { add() {}, remove() {} }, toggleAttribute() {}
  };
  const context = vm.createContext({
    URL, console, Date, setTimeout() {},
    location: { origin: 'https://ui.invalid', pathname: '/index.html' },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) },
    matchMedia: () => ({ matches: schemeIsDark, addEventListener: (type, listener) => mediaListeners.push(listener) }),
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
  return {
    context, root, properties, styles, values, events, samples,
    adaptiveSampler: async (...args) => samples.push(args),
    changeScheme(darkMode) {
      schemeIsDark = darkMode;
      for (const listener of mediaListeners) listener({ matches: darkMode });
    }
  };
}
async function core(h) {
  const module = new vm.SourceTextModule(fs.readFileSync('public/assets/js/theme-core-adaptive.js','utf8'),{ context: h.context });
  await module.link(async specifier => {
    if (specifier.includes('ui-assets')) return new vm.SourceTextModule(fs.readFileSync('public/assets/js/ui-assets.js','utf8'),{ context:h.context });
    if (specifier.includes('text-inversion')) return new vm.SyntheticModule(['installUniversalTextInversion'],function(){this.setExport('installUniversalTextInversion',()=>{});},{context:h.context});
    return new vm.SyntheticModule(['initAdaptiveGlass','refreshAdaptiveGlass','getEffectiveWallpaper'],function(){
      this.setExport('initAdaptiveGlass',(...args)=>h.adaptiveSampler(...args));
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
test('empty image mode follows system scheme changes and slow sampling never blocks a later mode',async()=>{
  const h=harness({mode:'image'});vm.runInContext(boot,h.context);const runtime=await core(h);
  runtime.initTheme();
  assert.equal(h.root.dataset.environment,'light');
  h.changeScheme(true);
  for(let i=0;i<10&&h.root.dataset.environment!=='dark';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.root.dataset.environment,'dark');

  let finishSampling;
  h.adaptiveSampler=()=>new Promise(resolve=>{finishSampling=resolve;});
  await runtime.setAppearance({mode:'image',imageUrl:'/slow-wallpaper.png'});
  await runtime.setThemeMode('light');
  assert.equal(h.root.dataset.environment,'light');
  finishSampling();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.root.dataset.environment,'light');
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

async function sampler(failure = '', deferLoad = false) {
  const properties = new Map(), frames = [], root = { dataset: { environment: 'image' } };
  let loads = 0;
  const pendingLoads = [];
  class Element {
    constructor() {
      this.dataset = {};
      this.parentElement = null;
      this.style = { setProperty: (key,value) => properties.set(key,value), removeProperty: key => properties.delete(key) };
    }
    matches() { return false; }
    getBoundingClientRect() { return { left:0,top:0,width:100,height:100,right:100,bottom:100 }; }
    removeAttribute(name) { delete this.dataset[name==='data-evara-tone'?'evaraTone':'evaraTextTones']; }
  }
  const element = new Element();
  const context = vm.createContext({
    console, setTimeout, clearTimeout, innerWidth:100, innerHeight:100,
    HTMLElement:Element, window:{}, matchMedia:()=>({matches:true}), addEventListener() {},
    requestAnimationFrame:callback=>{frames.push(callback);return frames.length;}, cancelAnimationFrame() {},
    MutationObserver:class { observe() {} },
    Image:class {
      constructor() { this.naturalWidth=1;this.naturalHeight=1; }
      set src(value) {
        if (!value) return;
        loads++;
        const finish=()=>failure==='load'&&loads===1?this.onerror(new Error('Transient load')):this.onload();
        if(deferLoad)pendingLoads.push(finish);else queueMicrotask(finish);
      }
    },
    document:{
      documentElement:root,hidden:false,body:{classList:{contains:()=>false}},
      querySelectorAll:selector=>selector==='.evara-adaptive-text-node'?[]:[element],
      createElement:()=>({ getContext:()=>({ drawImage() {}, getImageData() {
        if(failure==='canvas'&&loads===1)throw new Error('Canvas unavailable');
        return {data:new Uint8ClampedArray([255,255,255,255])};
      } }) })
    }
  });
  const module = new vm.SourceTextModule(fs.readFileSync('public/assets/js/theme-adaptive.js','utf8'),{context});
  await module.link(()=>{throw new Error('Unexpected dependency');});await module.evaluate();
  return {runtime:module.namespace,root,element,properties,loads:()=>loads,finishLoad:()=>pendingLoads.shift()?.(),flush:()=>{while(frames.length)frames.shift()();}};
}

test('sampled surface and text styles clear when changing modes or disabling contrast',async()=>{
  for(const next of ['light','dark','system','contrast-off']) {
    const h=await sampler();
    await h.runtime.initAdaptiveGlass({adaptiveContrast:true},'https://ui.invalid/wallpaper.png');h.flush();
    assert.equal(h.element.dataset.evaraTone,'dark-ink');
    assert.ok(h.properties.has('--adaptive-glass-rgb'));
    h.element.dataset.evaraTextTones='ddddddd';
    for(let i=0;i<7;i++)h.properties.set('--adaptive-text-c'+i,'rgb(0 0 0)');
    h.root.dataset.environment=next==='contrast-off'?'image':next;
    await h.runtime.initAdaptiveGlass({adaptiveContrast:next!=='contrast-off'},next==='contrast-off'?'https://ui.invalid/wallpaper.png':'');h.flush();
    assert.equal(h.element.dataset.evaraTone,undefined);
    assert.equal(h.element.dataset.evaraTextTones,undefined);
    assert.equal(h.properties.size,0);
  }
});

test('an explicit same-URL retry recovers failed wallpaper loading and canvas sampling',async()=>{
  for(const failure of ['load','canvas']) {
    const h=await sampler(failure),url='https://ui.invalid/wallpaper.png';
    await h.runtime.initAdaptiveGlass({adaptiveContrast:true},url);h.flush();
    assert.equal(h.loads(),1);
    await h.runtime.initAdaptiveGlass({adaptiveContrast:true},url);h.flush();
    assert.equal(h.loads(),2);
    assert.equal(h.element.dataset.evaraTone,'dark-ink');
    await h.runtime.initAdaptiveGlass({adaptiveContrast:true},url);h.flush();
    assert.equal(h.loads(),2);
  }
});

test('a late wallpaper sample cannot overwrite a newer non-image environment',async()=>{
  const h=await sampler('',true),url='https://ui.invalid/slow-wallpaper.png';
  const pending=h.runtime.initAdaptiveGlass({adaptiveContrast:true},url);
  h.root.dataset.environment='dark';
  await h.runtime.initAdaptiveGlass({adaptiveContrast:true},'');
  h.flush();
  assert.equal(h.properties.size,0);
  h.finishLoad();
  await pending;
  h.flush();
  assert.equal(h.element.dataset.evaraTone,undefined);
  assert.equal(h.properties.size,0);
});


test('a wallpaper load is shared across concurrent appearance updates',async()=>{
  const h=await sampler('',true),url='https://ui.invalid/shared-wallpaper.png';
  const first=h.runtime.initAdaptiveGlass({adaptiveContrast:true,wallpaperDim:.08},url);
  const second=h.runtime.initAdaptiveGlass({adaptiveContrast:true,wallpaperDim:.12},url);
  assert.equal(h.loads(),1);
  h.finishLoad();
  await Promise.all([first,second]);h.flush();
  assert.equal(h.loads(),1);
  assert.equal(h.element.dataset.evaraTone,'dark-ink');
  await h.runtime.initAdaptiveGlass({adaptiveContrast:true,wallpaperDim:.2},url);h.flush();
  assert.equal(h.loads(),1);
});