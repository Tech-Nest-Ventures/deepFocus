const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const popupSource = fs.readFileSync(path.join(__dirname, "../Browser/shared/popup.js"), "utf8");

async function popup(initial = {}, source = popupSource) {
  const saved = { ...initial };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: "", hidden: false, required: false, textContent: "", listeners: {},
      addEventListener(event, handler) { this.listeners[event] = handler; } });
    return elements.get(id);
  };
  let connections = 0;
  const sandbox = { navigator: { userAgent: "Chrome/130" }, AbortSignal,
    document: { getElementById: element },
    chrome: { storage: { local: {
      get: async () => ({ ...saved }), set: async value => Object.assign(saved, value),
      remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete saved[key]; },
    } } },
    fetch: async () => { connections++; return { ok: true }; },
  };
  vm.runInNewContext(source, sandbox);
  await new Promise(setImmediate);
  return { saved, element, connections: () => connections,
    submit: () => element("pairing").listeners.submit({ preventDefault() {} }) };
}

test("legacy pairing keeps its credential but requires explicit browser confirmation", async () => {
  const ui = await popup({ pairingToken: "a".repeat(64) });
  assert.match(ui.element("status").textContent, /choose.*browser/i);
  await ui.submit();
  assert.equal(ui.connections(), 0);
  ui.element("browser-identity").value = "dia";
  await ui.submit();
  assert.equal(ui.saved.browserIdentity, "dia");
  assert.equal(ui.saved.pairingToken, "a".repeat(64));
  assert.match(ui.element("status").textContent, /paired/i);
});

test("each Chromium browser choice is saved with the pairing credential", async () => {
  for (const browser of ["chrome", "edge", "dia", "arc"]) {
    const ui = await popup();
    ui.element("browser-identity").value = browser;
    ui.element("token").value = "b".repeat(64);
    await ui.submit();
    assert.equal(ui.saved.browserIdentity, browser);
    assert.equal(ui.saved.pairingToken, "b".repeat(64));
    assert.equal(ui.element("token").value, "");
    await ui.element("disconnect").listeners.click();
    assert.deepEqual(ui.saved, {});
  }
});

test("Safari pairing never asks for or trusts a Chromium identity", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../Browser/safari/popup.js"), "utf8");
  const ui = await popup({ pairingToken: "a".repeat(64), browserIdentity: "dia" }, source);
  assert.equal(ui.element("browser-choice").hidden, true);
  assert.equal(ui.element("browser-identity").required, false);
  assert.equal(ui.element("safari-access").hidden, false);
  await ui.submit();
  assert.equal(ui.saved.browserIdentity, "safari");
});
