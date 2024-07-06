import type { Component } from 'solid-js'
import logo from './assets/deepWork.svg'

const App: Component = () => {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  console.log('window.electron ', window?.electron)

  // Call this function when you want to test the email send
  const testEmailSend = async (): Promise<void> => {
    try {
      await window.Electron.ipcRenderer.invoke('test-email-send')
      console.log('Test email triggered')
    } catch (error) {
      console.error('Error triggering test email:', error)
    }
  }
  console.log('hello timeo')
  return (
    <div class="visibility">
      <h1>Hello Timeo</h1>
      <img alt="logo" class="logo" src={logo} />
      <div class="actions">
        <div class="action">
          <a target="_blank" rel="noreferrer" onClick={testEmailSend}>
            Send Test Email
          </a>
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
    </div>
  )
}

export default App
