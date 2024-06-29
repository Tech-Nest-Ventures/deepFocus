import type { Component } from 'solid-js'
import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

const App: Component = () => {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <>
      <img alt="logo" class="logo" src={electronLogo} />
      <div class="text"></div>
      <div class="actions">
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
