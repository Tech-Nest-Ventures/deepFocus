import type { Component } from 'solid-js'
import Versions from './components/Versions'
import logo from './assets/deepWork.svg'

const App: Component = () => {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  // Call this function when you want to test the email send
  const testEmailSend = (): void => window.electron.ipcRenderer.send('test-email-send')

  return (
    <>
      <img alt="logo" class="logo" src={logo} />
      <div class="text">
        the future of <span class="solid">deep</span>
        &nbsp;and <span class="ts">Work</span>
      </div>
      <p class="tip">Coming soon! Stay up to date with weekly features</p>
      <div class="actions">
        <div class="action">
          <a target="_blank" rel="noreferrer" onClick={testEmailSend}>
            Send Test Email
          </a>
        </div>
        <div class="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
      <Versions />
    </>
  )
}

export default App
