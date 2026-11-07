const api = globalThis.browser ?? globalThis.chrome;
const status = document.getElementById("status");
const input = document.getElementById("token");
const isSafari = !/Chrome\//.test(navigator.userAgent) && /Safari\//.test(navigator.userAgent);
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
  const token = input.value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(token)) { status.textContent = "Paste the complete code from the Mac app."; return; }
  try {
    const response = await fetch("http://127.0.0.1:17322/v1/status", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", credentials: "omit",
      redirect: "error", signal: AbortSignal.timeout(2000),
    });
    if (response.status === 401) { status.textContent = "That code does not match this app."; return; }
    if (!response.ok) throw new Error();
    await api.storage.local.set({ pairingToken: token });
    input.value = "";
    status.textContent = "Paired. Visit a public webpage to start monitoring.";
  } catch { status.textContent = "Cannot connect. Open Deep Focus and allow the extension's localhost access."; }
});

document.getElementById("disconnect").addEventListener("click", async () => {
  await api.storage.local.remove("pairingToken");
  input.value = "";
  status.textContent = "Disconnected. The app clears its last URL within six seconds.";
});
api.storage.local.get("pairingToken").then(value => {
  status.textContent = value.pairingToken ? "Paired with this Mac." : "Not paired yet.";
});
