const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../Browser/shared/background.js"), "utf8");
const context = { navigator: { userAgent: "Chrome/130" }, URL };
vm.createContext(context);
vm.runInContext(source, context);
function snapshot(window, tab) {
  context.testWindow = window;
  context.testTab = tab;
  return JSON.parse(JSON.stringify(vm.runInContext("observation(testWindow, testTab)", context)));
}

test("only active public HTTP(S) tabs provide URLs", () => {
  assert.equal(snapshot({ focused: true }, { active: true, url: "https://example.com" }).url, "https://example.com/");
  for (const tab of [{ active: false, url: "https://example.com" }, { active: true, incognito: true, url: "https://private.example" },
    { active: true, url: "chrome://settings" }, { active: true, url: "file:///secret" }, { active: true }]) {
    assert.equal(snapshot({ focused: true }, tab).url, null);
  }
});
test("background windows and private windows clear even with public tab metadata", () => {
  assert.equal(snapshot({ focused: false }, { active: true, url: "https://example.com" }).url, null);
  assert.equal(snapshot({ focused: true, incognito: true }, { active: true, url: "https://example.com" }).url, null);
});
test("URL credentials are stripped before transmission", () => {
  assert.equal(snapshot({ focused: true }, { active: true, url: "https://user:password@example.com/path" }).url, "https://example.com/path");
});

async function simulate({ monitoring = true, nativeBrowser = "chrome", window = { id: 1, focused: true },
  tab = { active: true, url: "https://example.com/work" }, changeDuringQuery = false, identity = "chrome", changeDuringStatus = false, packagedSource = source, multipleActiveTabs = false, changeIdentityDuringQuery = false } = {}) {
  const sent = [];
  let queried = 0;
  const listener = { addListener() {} };
  let storageChanged;
  const sandbox = {
    navigator: { userAgent: "Chrome/130" }, URL, AbortSignal, setInterval() {}, setTimeout() {},
    chrome: {
      storage: { local: { get: async () => ({ pairingToken: "a".repeat(64), browserIdentity: identity }) }, onChanged: { addListener(handler) { storageChanged = handler; } } },
      tabs: {
        query: async () => {
          queried++;
          if (changeDuringQuery) vm.runInContext("revision++", sandbox);
          if (changeIdentityDuringQuery) storageChanged({ browserIdentity: { newValue: "dia" } }, "local");
          return multipleActiveTabs ? [tab, { ...tab, url: "https://other.example" }] : [tab];
        }, onActivated: listener, onUpdated: listener, onRemoved: listener,
      },
      windows: { getLastFocused: async () => window, onFocusChanged: listener, onRemoved: listener },
      runtime: { onStartup: listener, onInstalled: listener },
      alarms: { create() {}, onAlarm: listener },
    },
    fetch: async (url, options) => {
      if (url.endsWith("/v1/status")) {
        if (changeDuringStatus) storageChanged({ browserIdentity: { newValue: "dia" } }, "local");
        return { ok: true, json: async () => ({ epoch: "epoch", monitoring, browser: nativeBrowser }) };
      }
      sent.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({}) };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(packagedSource, sandbox);
  for (let i = 0; i < 10; i++) await new Promise(setImmediate);
  return { sent, queried };
}

test("paused and background browsers do not even query tab URLs", async () => {
  for (const options of [{ monitoring: false }, { nativeBrowser: "edge" }, { nativeBrowser: null }]) {
    assert.deepEqual(await simulate(options), { sent: [], queried: 0 });
  }
});
test("private foreground window sends an explicit clear without querying its tabs", async () => {
  const result = await simulate({ window: { id: 1, focused: true, incognito: true } });
  assert.equal(result.queried, 0);
  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].url, null);
  assert.equal(result.sent[0].privateBrowsing, true);
});
test("a tab/focus change during an async query discards the obsolete snapshot", async () => {
  assert.equal((await simulate({ changeDuringQuery: true })).sent.length, 0);
});
test("a foreground public tab sends only current observation fields", async () => {
  const result = await simulate();
  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].url, "https://example.com/work");
  assert.equal(result.sent[0].browser, "chrome");
  assert.equal(result.sent[0].epoch, "epoch");
  assert.equal("title" in result.sent[0], false);
  assert.equal("tabId" in result.sent[0], false);
});

test("Chromium requires an explicit browser choice, including legacy paired installations", async () => {
  for (const identity of [null, "", "safari", "unknown"]) {
    assert.deepEqual(await simulate({ identity }), { sent: [], queried: 0 });
  }
  for (const identity of ["chrome", "edge", "dia", "arc"]) {
    const result = await simulate({ identity, nativeBrowser: identity });
    assert.equal(result.sent.length, 1);
    assert.equal(result.sent[0].browser, identity);
    assert.equal((await simulate({ identity, nativeBrowser: identity === "chrome" ? "dia" : "chrome" })).queried, 0);
  }
});

test("changing browser identity during status lookup stops URL collection", async () => {
  assert.deepEqual(await simulate({ changeDuringStatus: true }), { sent: [], queried: 0 });
});

test("Safari package identity is fixed even when the user agent resembles Chromium", async () => {
  const packagedSource = fs.readFileSync(path.join(__dirname, "../Browser/safari/background.js"), "utf8");
  const result = await simulate({ packagedSource, nativeBrowser: "safari", identity: "dia" });
  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].browser, "safari");
  assert.equal((await simulate({ packagedSource, nativeBrowser: "chrome" })).queried, 0);
});

test("ambiguous active tabs clear the URL instead of claiming a focused split-view pane", async () => {
  const result = await simulate({ multipleActiveTabs: true });
  assert.equal(result.sent.length, 1);
  assert.equal(result.sent[0].url, null);
});

test("a browser identity change during tab lookup discards the old browser observation", async () => {
  const result = await simulate({ changeIdentityDuringQuery: true });
  assert.equal(result.sent.length, 0);
});
