import { type Component, createSignal, Show } from 'solid-js'

const Versions: Component = () => {
  const [versions] = createSignal(window?.electron?.process?.versions)

  const getLatestRelease = (): string => 'v1.2.6'

  // Call this function when you want to test the email send
  const testEmailSend = (): void => window?.electron.ipcRenderer.send('test-email-send')
  return (
    <Show when={versions}>
      <>
        <main>
          <p class="tip">Latest Release: {getLatestRelease()}</p>

          <div class="actions">
            <div class="action">
              <a target="_blank" rel="noreferrer" onClick={testEmailSend}>
                Send Test Email
              </a>
            </div>
            <div class="action">
              <a
                href="https://github.com/timeowilliams/deepFocus/releases/download/create-v1.2.6/deepfocus-1.2.6.dmg"
                download="deepwork-1.2.6.dmg"
              >
                Download deepFocus (MacOS only)
              </a>
            </div>
          </div>
        </main>
        <ul class="versions">
          <li class="electron-version">Electron v{versions()?.electron}</li>
          <li class="chrome-version">Chromium v{versions()?.chrome}</li>
          <li class="node-version">Node v{versions()?.node}</li>
        </ul>
      </>
    </Show>
  )
}

export default Versions
