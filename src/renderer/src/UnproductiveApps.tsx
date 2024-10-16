import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'

const UnproductiveApps = () => {
  const [apps, setApps] = createSignal<{ name: string; path: string; icon: string }[]>([])
  const [unproductiveApps, setUnproductiveApps] = createSignal([]) // List of apps marked as unproductive
  const [currentPage, setCurrentPage] = createSignal(1) // Track the current page
  const appsPerPage = 5 // Limit to 5 apps per page

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

  const toggleUnproductive = (app) => {
    const getUpdatedUnproductiveApps = (prevApps) => {
      return prevApps.includes(app)
        ? prevApps.filter((unproductiveApp) => unproductiveApp !== app)
        : [...prevApps, app]
    }
    const updatedUnproductiveApps = getUpdatedUnproductiveApps(unproductiveApps())
    setUnproductiveApps(updatedUnproductiveApps)
    window.electron.ipcRenderer.send('update-unproductive-apps', updatedUnproductiveApps)
    return updatedUnproductiveApps
  }

  const fetchApps = () => {
    window.electron.ipcRenderer.send('fetch-app-icons')
  }

  // Pagination logic: Reactively calculate startIdx and endIdx
  const paginatedApps = () => {
    const startIdx = (currentPage() - 1) * appsPerPage
    const endIdx = startIdx + appsPerPage
    console.log('startIdx', startIdx, 'endIdx', endIdx)
    return apps().slice(startIdx, endIdx)
  }

  const nextPage = () => {
    if (currentPage() * appsPerPage < apps().length) {
      setCurrentPage(currentPage() + 1)
    }
  }

  const prevPage = () => {
    if (currentPage() > 1) {
      setCurrentPage(currentPage() - 1)
    }
  }

  return (
    <div class="p-4">
      <h2 class="text-base mb-4 font-normal">Select Unproductive Apps</h2>
      <Button onClick={fetchApps} class="mb-4 p-2 bg-blue-500 text-white rounded">
        Fetch Apps
      </Button>
      <div class="max-h-96 overflow-y-auto">
        <ul class="space-y-2">
          <For each={paginatedApps()}>
            {(app) => (
              <li class="flex items-center">
                <img src={app?.icon} alt={`${app.name} icon`} class="w-4 h-4 mr-2" />
                {app.name}
                <button
                  class={`ml-auto p-1 rounded ${
                    unproductiveApps().includes(app) ? 'bg-red-500 text-white' : 'bg-blue-500'
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

      <div class="flex justify-between mt-4">
        <Button onClick={prevPage} disabled={currentPage() === 1}>
          Previous
        </Button>
        <Button onClick={nextPage} disabled={currentPage() * appsPerPage >= apps().length}>
          Next
        </Button>
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
