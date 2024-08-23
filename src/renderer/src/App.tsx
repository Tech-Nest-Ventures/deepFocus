/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Component } from 'solid-js'
import Versions from './components/Versions'
import logo from './assets/deepWork.svg'

const App: Component = () => {
  // const ipcHandle = (): void => window?.electron.ipcRenderer.send('ping')
  console.log(window?.electron)

  const getLatestRelease = (): string => 'v1.2.6'

  // Call this function when you want to test the email send
  //const testEmailSend = (): void => window?.electron.ipcRenderer.send('test-email-send')

  return (
    <>
      <img alt="logo" class="logo" src={logo} />
      <div class="text">
        the future of <span class="solid">deep</span>
        <span class="ts">Focus</span>
      </div>
      <p class="tip">Latest Release: {getLatestRelease()}</p>
      <div class="actions">
        {/* <div class="action">
          <a target="_blank" rel="noreferrer" onClick={testEmailSend}>
            Send Test Email
          </a>
        </div> */}
        {/* <div class="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div> */}
        <div class="action">
          <a
            href="https://github.com/timeowilliams/deepFocus/releases/download/create-v1.2.6/deepfocus-1.2.6.dmg"
            download="deepwork-1.2.6.dmg"
          >
            Download deepFocus (MacOS only)
          </a>
        </div>
      </div>
      <Versions />
    </>
  )
}

export default App
