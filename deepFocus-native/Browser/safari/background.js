/* Live observations only: never persist URLs, titles, tab IDs, or browsing history. */
const api = globalThis.browser ?? globalThis.chrome;
const ENDPOINT = "http://127.0.0.1:17322";
// Safari's generated package fixes this value; Chromium requires explicit setup.
const PACKAGE_BROWSER = "safari";
const CHROMIUM_BROWSERS = ["chrome", "edge", "dia", "arc"];
let revision = 0;
let inFlight = false;
let pending = false;
let epoch = null;
let sequence = 0;

// Snapshot construction is shared with tests. Private/non-web tabs yield explicit clears.
function observation(window, tab) {
  const focused = window?.focused === true;
  const privateBrowsing = window?.incognito === true || tab?.incognito === true;
  let url = null;
  if (focused && !privateBrowsing && tab?.active && typeof tab.url === "string") {
    try {
      const parsed = new URL(tab.url);
      if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) {
        parsed.username = "";
        parsed.password = "";
        url = parsed.href.length <= 8192 ? parsed.href : null;
      }
    } catch { /* Non-web addresses are intentionally unavailable. */ }
  }
  return { focused, privateBrowsing, url };
}

async function request(path, token, body) {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`Bridge ${response.status}`);
  return response.json();
}

async function report() {
  if (inFlight) { pending = true; return; }
  inFlight = true;
  pending = false;
  const startedRevision = revision;
  try {
    const { pairingToken, browserIdentity } = await api.storage.local.get(["pairingToken", "browserIdentity"]);
    const browserName = PACKAGE_BROWSER ?? (CHROMIUM_BROWSERS.includes(browserIdentity) ? browserIdentity : null);
    if (!browserName || revision !== startedRevision) return;
    if (!/^[a-f0-9]{64}$/.test(pairingToken ?? "")) return;
    // Ask the native app first: don't collect a URL while paused or in a background browser.
    const status = await request("/v1/status", pairingToken);
    if (revision !== startedRevision || !status.monitoring || status.browser !== browserName) return;
    if (epoch !== status.epoch) { epoch = status.epoch; sequence = 0; }
    const currentWindow = await api.windows.getLastFocused({ populate: false, windowTypes: ["normal"] });
    if (revision !== startedRevision) return;
    const observedAt = Date.now();
    const tabs = currentWindow.focused && !currentWindow.incognito
      ? await api.tabs.query({ active: true, windowId: currentWindow.id }) : [];
    // Recheck window focus after async tab lookup to avoid reporting a window we just left.
    const confirmedWindow = await api.windows.getLastFocused({ populate: false, windowTypes: ["normal"] });
    if (revision !== startedRevision || confirmedWindow.id !== currentWindow.id) { pending = true; return; }
    // A split view must never be resolved by arbitrarily taking the first active tab.
    const snapshot = observation(confirmedWindow, tabs.length === 1 ? tabs[0] : null);
    await request("/v1/event", pairingToken, {
      browser: browserName, epoch, sequence: sequence++, observedAt, ...snapshot,
    });
  } catch {
    // No payload/error logging. A missing app, permission, or connection expires the native URL.
  } finally {
    inFlight = false;
    if (pending) { pending = false; setTimeout(report, 50); }
  }
}

function changed() { revision++; void report(); }
if (api) {
  api.tabs.onActivated.addListener(changed);
  api.tabs.onUpdated.addListener((_id, change, tab) => {
    if (tab.active && (change.url !== undefined || change.status !== undefined)) changed();
  });
  api.tabs.onRemoved.addListener(changed);
  api.windows.onFocusChanged.addListener(changed);
  api.windows.onRemoved.addListener(changed);
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(changes.pairingToken || changes.browserIdentity)) return;
    epoch = null;
    sequence = 0;
    changed();
  });
  api.runtime.onStartup.addListener(changed);
  api.runtime.onInstalled.addListener(changed);
  // Real monitoring heartbeats; workers may be suspended by browsers. Native state expires safely.
  setInterval(report, 2000);
  // Recover a suspended worker even when the selected tab doesn't change.
  if (api.alarms) {
    api.alarms.create("reconnect", { periodInMinutes: 0.5 });
    api.alarms.onAlarm.addListener(changed);
  }
  void report();
}
