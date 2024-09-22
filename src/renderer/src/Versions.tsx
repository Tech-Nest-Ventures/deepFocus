import { type Component } from 'solid-js'

const Versions: Component = () => {
  const getLatestRelease = (): string => 'v1.2.6'

  // Call this function when you want to test the email send
  const testEmailSend = (): void => window?.electron.ipcRenderer.send('test-email-send')
  return (
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
    </>
  )
}

export default Versions
