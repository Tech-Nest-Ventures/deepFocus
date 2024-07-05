import type { Component } from 'solid-js'
import { ipcRenderer } from 'electron'
import Versions from './components/Versions'
import logo from './assets/deepWork.svg'

const App: Component = () => {
  // const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  // Call this function when you want to test the email send
  const testEmailSend = async (): Promise<void> => {
    try {
      await ipcRenderer.invoke('test-email-send')
      console.log('Test email triggered')
    } catch (error) {
      console.error('Error triggering test email:', error)
    }
  }
  console.log('hello timeo')
  return (
    <>
      <h1>Hello Timeo</h1>
      <img alt="logo" class="logo" src={logo} />
      <div class="actions">
        <div class="action">
          <a target="_blank" rel="noreferrer" onClick={testEmailSend}>
            Send Test Email
          </a>
        </div>
      </div>
      <Versions />
    </>
  )
}

export default App
