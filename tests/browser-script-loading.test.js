const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const interactionModeSource = fs.readFileSync(path.join(__dirname, '..', 'interaction-mode.js'), 'utf8');
const timerSource = fs.readFileSync(path.join(__dirname, '..', 'timer.js'), 'utf8');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function createElementStub() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    style: {},
    dataset: {},
    className: '',
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener() {},
    setAttribute() {},
    closest() { return null; },
  };
}

test('browser scripts can all load together in the same page context', () => {
  const elementCache = new Map();
  const context = {
    module: undefined,
    navigator: {},
    location: { origin: 'http://localhost:3000', pathname: '/', search: '', href: 'http://localhost:3000/' },
    history: { replaceState() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    EventSource: function EventSource() { this.close = () => {}; },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    addEventListener() {},
    window: null,
    globalThis: null,
    document: {
      body: { dataset: {}, appendChild() {} },
      getElementById(id) {
        if (!elementCache.has(id)) {
          elementCache.set(id, createElementStub());
        }
        return elementCache.get(id);
      },
      createElement() {
        return createElementStub();
      },
    },
    URL,
    URLSearchParams,
    console,
  };

  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(interactionModeSource, context);
  vm.runInContext(timerSource, context);

  assert.doesNotThrow(() => {
    vm.runInContext(scriptSource, context);
  });

  assert.equal(typeof context.MineCoInteractionMode, 'object');
  assert.equal(typeof context.MineCoTimer, 'object');
});
