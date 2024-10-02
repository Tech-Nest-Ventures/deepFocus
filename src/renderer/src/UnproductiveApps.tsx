import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'

const UnproductiveApps = () => {
  const [apps, setApps] = createSignal([])
  const [unproductiveApps, setUnproductiveApps] = createSignal([]) // List of apps marked as unproductive

  // Fetch stored unproductive apps from Electron store on mount
  onMount(() => {
    // Fetch the app icons
    window.electron.ipcRenderer.send('fetch-app-icons')
    window.electron.ipcRenderer.on('app-icons-response', (event, appData) => {
      const sortedApps = appData.sort((a, b) => a.name.localeCompare(b.name))
      setApps(sortedApps)
    })

    // Fetch the unproductive apps from Electron store
    window.electron.ipcRenderer.send('fetch-unproductive-apps')
    window.electron.ipcRenderer.on(
      'unproductive-apps-response',
      (event, storedUnproductiveApps) => {
        setUnproductiveApps(storedUnproductiveApps || [])
      }
    )

    // Clean up IPC listeners when component unmounts
    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('app-icons-response')
      window.electron.ipcRenderer.removeAllListeners('unproductive-apps-response')
    })
  })

  // Toggle unproductive apps and persist them
  const toggleUnproductive = (app) => {
    setUnproductiveApps((prev) => {
      const updatedApps = prev.includes(app)
        ? prev.filter((unproductiveApp) => unproductiveApp !== app) // Remove from unproductive apps
        : [...prev, app] // Add to unproductive apps

      // Persist updated unproductive apps to Electron store
      window.electron.ipcRenderer.send('update-unproductive-apps', updatedApps)
      return updatedApps
    })
  }

  const fetchApps = () => {
    window.electron.ipcRenderer.send('fetch-app-icons')
  }

  return (
    <div class="p-4">
      <h2 class="text-xl mb-4">Select Unproductive Apps</h2>
      <Button onClick={fetchApps} class="mb-4 p-2 bg-blue-500 text-white rounded">
        Fetch Apps
      </Button>
      <div class="max-h-96 overflow-y-auto">
        <ul class="space-y-2">
          <For each={apps()}>
            {(app) => (
              <li class="flex items-center">
                <img src={app?.icon} alt={`${app.name} icon`} class="w-4 h-4 mr-2" />
                {app.name}
                <button
                  class={`ml-auto p-1 rounded ${
                    unproductiveApps().includes(app) ? 'bg-red-500 text-white' : 'bg-gray-300'
                  }`}
                  onClick={() => toggleUnproductive(app)}
                >
                  {unproductiveApps().includes(app) ? 'X' : 'Add'}
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>

      <div class="mt-6">
        <h3 class="text-lg">Unproductive Apps:</h3>
        <ul>
          <For each={unproductiveApps()}>
            {(app) => (
              <li class="flex items-center">
                <img src={app?.icon} alt={`${app.name} icon`} class="w-4 h-4 mr-2" />
                {app.name}
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  )
}

export default UnproductiveApps
