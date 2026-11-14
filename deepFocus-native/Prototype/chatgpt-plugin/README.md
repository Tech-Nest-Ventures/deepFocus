# Deep Focus Sample — ChatGPT prototype

A small MCP plugin for testing **Direction 2: Day in Places** with one fictional Saturday. It does not read the native app, phone, location services, browser history, Apple Calendar, Google, or other plugins. No model API key is needed: ChatGPT supplies the conversation.

## Try it

The development MCP endpoint is `https://superambitiously-compellable-helga.ngrok-free.dev/mcp` while the local server and ngrok process are running. This is a temporary personal test, not an App Store release or a public plugin listing.

1. In your ChatGPT account, open **Plugins → Personal → Deep Focus Sample** and finish **Connect** if prompted. The plugin was created on November 14; final connection requires the operator's approval of ChatGPT's chat/memory-sharing notice.
2. Start a ChatGPT **Work** chat with **Deep Focus Sample** selected (type `@` to find it where supported).
3. Send: **“Show my fictional Saturday and ask me one question about the gym visit. Use only Deep Focus Sample.”**
4. Correct it: **“In the sample, I was walking while on the phone from 6:15 to 6:35 PM, outside.”**
5. Try: **“The sample workout ended at 6:10 PM. Preview that change to the fictional calendar.”** Read the before/after and confirm only if it is right.
6. Try **“Leave the workout unknown”** or **“Start a fresh sample day.”**

On iPhone, sign into the same ChatGPT account and open the installed plugin or continue the same Work chat. **Physical iPhone plugin availability, inline-card rendering, and follow-up editing remain an acceptance check; a 390px browser preview is not an iPhone-client test.** If the client supports the tools but omits the card, the complete sample workflow also works conversationally. If the plugin itself is unavailable in the iPhone client, report that platform limitation rather than treating a standalone webpage as an in-ChatGPT success.

Direct web preview on this Mac: <http://127.0.0.1:8787>. Its buttons use the same handlers as MCP; it has no chat model or fake ChatGPT composer.

## Run locally

Requires Node 22+. From this directory:

```sh
source "$HOME/.nvm/nvm.sh"  # if Node/npm are not already on PATH
nvm use 22
npm ci
npm run build
npm test
npm start
```

The server binds to **127.0.0.1:8787**, never the LAN by default. To connect ChatGPT, run `ngrok http 8787 --inspect=false` in another terminal. Set `PUBLIC_ORIGIN` to the HTTPS origin ngrok displays, then restart the server:

```sh
PUBLIC_ORIGIN=https://YOUR-TUNNEL-HOST npm start
npm run smoke
MCP_URL=https://YOUR-TUNNEL-HOST/mcp npm run smoke
```

Connect through **ChatGPT Plugins → Add → Add custom MCP server**. Name: **Deep Focus Sample**. URL: the HTTPS origin plus `/mcp`. Authentication: **No authentication** (synthetic fixture only). Review the platform's connection notice. Refresh the plugin when tool metadata changes; version the `ui://` resource when changing a released widget contract.

Keep this Mac awake and online for the temporary test. Stop the server and ngrok processes with Ctrl-C to end access. ngrok's request inspector is disabled. The endpoint contains only this prototype; it exposes no filesystem, shell, native bridge, credential, or account-access tool.

## Behavior and boundaries

- The fixed day is **November 14, 2026, America/New_York**. All `HH:mm` inputs refer to that day, independent of the phone's timezone.
- Fictional intention: Workout, 17:00–18:00. Fictional place evidence: Gym, 17:20–18:35. Scripted sample confirmations: reading/coffee, workout, and phone call. A place visit never establishes purpose.
- Each start creates a random demo ID. Follow-up tools and card actions use that ID, so independent samples do not share edits. It is a temporary capability identifier, **not production authentication**.
- State lives in server memory for at most 24 hours (expired entries are pruned on subsequent access); restarting the server clears every sample. The store holds at most 200 samples, each with bounded edit/update history. ChatGPT's own conversation retention is separate.
- Only enum activity/place choices, times, IDs and revisions are accepted. No freeform notes, coordinates, file uploads, URLs, calendar credentials, or real-data import. Strict schemas reject extra fields. Do not put real personal information in prototype prompts.
- The server makes no provider/API calls and logs no tool payloads. ChatGPT and the HTTPS tunnel still process the sample requests under their own policies. This is not a zero-disclosure environment for arbitrary chat text.
- Corrections preserve the original plan and place observation. Elapsed minutes are the union of confirmed intervals; concurrent labels and overlapping entries do not add duplicate minutes. Unknown intervals are excluded. There is no productivity score.
- Calendar changes are **simulated only**, preserve event identity/original plan, require a short-lived signed preview and explicit confirmation, reject stale revisions, and are idempotent on retry. The UI's confirm button acts on the comparison visible immediately above it.
- No proactive daily thread creation, push notifications, real-device sync, real calendar writes, account auth, or production hosting is implemented.

## Tools

| Tool | Purpose |
| --- | --- |
| `start_sample_day` | New/reset independent sample |
| `get_sample_day` | Read latest state and revision |
| `show_sample_day` | Render the selected timeline as an MCP Apps card |
| `correct_sample_activity` | Change a sample interval, labels, place, or certainty |
| `preview_sample_calendar_update` | Read the exact proposed simulated workout change |
| `confirm_sample_calendar_update` | Apply an explicitly confirmed simulation |

Tool results contain model-readable data, so text-only clients can still handle the flow. Only `show_sample_day` owns the UI resource; mutations return authoritative data without mounting another card. The component uses the MCP Apps bridge and updates model context after in-card edits.

## Validation

See [design-qa.md](design-qa.md) and the project's [VALIDATION.md](../../VALIDATION.md). Run `npm test` for isolation, provenance, time union, invalid inputs, stale/forged/expired preview rejection, idempotency, expiry/capacity and HTTP boundary checks. `npm run smoke` exercises the actual Streamable HTTP protocol, tool discovery, UI resource and correction/confirmation sequence using the official MCP client.

Built against the [official MCP server guide](https://developers.openai.com/plugins/build/mcp-server), [MCP Apps UI guide](https://developers.openai.com/plugins/build/chatgpt-ui), and [ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt). Map artwork is generated and fictional. Calendar icon comes from Phosphor Icons (MIT), bundled from `@phosphor-icons/core`; dependencies are lockfile-pinned.
