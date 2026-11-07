const api = globalThis.browser ?? globalThis.chrome;
const status = document.getElementById("status");
const input = document.getElementById("token");
// Set only by the package generator. Never infer Chromium identity from its user agent.
const PACKAGE_BROWSER = "safari";
const browserNames = { chrome: "Chrome", edge: "Edge", dia: "Dia", arc: "Arc" };
const selector = document.getElementById("browser-identity");
const isSafari = PACKAGE_BROWSER === "safari";
document.getElementById("browser-choice").hidden = isSafari;
selector.required = !isSafari;
let savedToken = "";
document.getElementById("safari-access").hidden = !isSafari;
document.getElementById("allow-sites").addEventListener("click", async () => {
  try {
    const granted = await api.permissions.request({ origins: ["http://*/*", "https://*/*"] });
    status.textContent = granted ? "Website access enabled. Private tabs remain excluded."
      : "Website access was not granted. App monitoring still works.";
  } catch { status.textContent = "Open Safari Settings → Extensions → Deep Focus → Edit Websites to allow URL access."; }
});

document.getElementById("pairing").addEventListener("submit", async event => {
  event.preventDefault();
  const browserIdentity = isSafari ? "safari" : selector.value;
  if (!isSafari && !Object.hasOwn(browserNames, browserIdentity)) {
    status.textContent = "Choose this browser before pairing.";
    return;
  }
  const token = input.value.trim().toLowerCase() || savedToken;
  if (!/^[a-f0-9]{64}$/.test(token)) { status.textContent = "Paste the complete code from the Mac app."; return; }
  try {
    const response = await fetch("http://127.0.0.1:17322/v1/status", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", credentials: "omit",
      redirect: "error", signal: AbortSignal.timeout(2000),
    });
    if (response.status === 401) { status.textContent = "That code does not match this app."; return; }
    if (!response.ok) throw new Error();
    await api.storage.local.set({ pairingToken: token, browserIdentity });
    savedToken = token;
    input.required = false;
    input.value = "";
    status.textContent = `Paired for ${isSafari ? "Safari" : browserNames[browserIdentity]}. Visit a public webpage to start monitoring.`;
  } catch { status.textContent = "Cannot connect. Open Deep Focus and allow the extension's localhost access."; }
});

document.getElementById("disconnect").addEventListener("click", async () => {
  await api.storage.local.remove(["pairingToken", "browserIdentity"]);
  savedToken = "";
  input.required = true;
  selector.value = "";
  input.value = "";
  status.textContent = "Disconnected. The app clears its last URL within six seconds.";
});
api.storage.local.get(["pairingToken", "browserIdentity"]).then(value => {
  savedToken = /^[a-f0-9]{64}$/.test(value.pairingToken ?? "") ? value.pairingToken : "";
  selector.value = Object.hasOwn(browserNames, value.browserIdentity) ? value.browserIdentity : "";
  input.required = !savedToken;
  input.placeholder = savedToken ? "Saved code; paste here only to replace it" : "";
  status.textContent = !savedToken ? "Not paired yet."
    : !isSafari && !selector.value ? "Choose this browser, then Pair to confirm the saved code. Monitoring is stopped until you confirm."
    : `Paired for ${isSafari ? "Safari" : browserNames[selector.value]}.`;
});
