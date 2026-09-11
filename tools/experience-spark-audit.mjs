import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Isolated component behavior; this does not simulate an authenticated Firebase session.
const editor = readFileSync(new URL('../public/assets/js/studio/experience-editor.js', import.meta.url), 'utf8');
const source = editor
  .replace("import { functions, httpsCallable } from '../firebase.js';", '')
  .replace("import { EXPERIENCE_DELIVERY } from '../experience/experience-deployment.js';", '');
assert.ok(!/^import /m.test(source), 'Review the component harness if editor dependencies change.');

async function exercise(mode) {
  const nodes = new Map();
  const timers = [];
  const listeners = new Map();
  let calls = 0;
  const document = {
    readyState: 'complete',
    documentElement: { dataset: {} },
    getElementById: id => nodes.get(id),
    createElement: tag => ({
      tagName: tag,
      setAttribute(name, value) { this[name] = value; },
      append() {}
    }),
    body: { append(node) { nodes.set(node.id, node); } }
  };
  const context = vm.createContext({
    EXPERIENCE_DELIVERY: mode,
    functions: {},
    httpsCallable: () => async () => { calls++; throw Object.assign(new Error('Service unavailable'), {code:'functions/unavailable'}); },
    document,
    window: { addEventListener(name, callback) { listeners.set(name, callback); }, dispatchEvent() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout(callback) { timers.push(callback); }
  });
  vm.runInContext(source, context, { filename: 'experience-editor.js' });
  for (const timer of timers) await timer();
  await listeners.get('evara:session-ready')();
  await vm.runInContext('bootstrap()', context);
  return { calls, nodes, authority: document.documentElement.dataset.evaraExperienceEditorAuthority };
}

const hosted = await exercise('hosting');
assert.equal(hosted.calls, 0, 'Hosting mode must never invoke absent Experience functions.');
assert.equal(hosted.authority, 'unavailable');
assert.equal(hosted.nodes.size, 1, 'Repeated lifecycle events must not duplicate the notice.');
assert.match(hosted.nodes.get('evaraExperienceAvailability').textContent, /publishing is paused/);
const online = await exercise('functions');
assert.ok(online.calls > 0, 'Online mode must retain the trusted callable path.');
assert.equal(online.authority, 'denied', 'Service failure must never grant editor authority.');
assert.equal(online.nodes.size, 0, 'Denied online state must not mount editor controls.');
console.log('PASS: static mode makes zero callable requests, has one availability notice, and online failure stays denied.');
