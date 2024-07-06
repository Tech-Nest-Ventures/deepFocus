import type { Component } from 'solid-js'
import Versions from './components/Versions'
import logo from './assets/deepWork.svg'

const App: Component = () => {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  // Call this function when you want to test the email send
  const testEmailSend = (): void  => window.electron.ipcRenderer.send('test-email-send')

  console.log('window.electron ', window?.electron)

  return (
    <>
      <img alt="logo" class="logo" src={logo} />
      <div class="creator">Powered by electron-vite</div>
      <div class="text">
        Build an Electron app with <span class="solid">Solid</span>
        &nbsp;and <span class="ts">TypeScript</span>
      </div>
      <p class="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div class="actions">
        <div class="action">
          {/* <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a> */}
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
