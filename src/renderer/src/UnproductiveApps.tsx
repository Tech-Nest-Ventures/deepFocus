import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'
import { IoRemoveCircleOutline, VsAdd } from './components/ui/icons'

interface AppIcon {
  name: string
  iconPath: string
}

const UnproductiveApps = () => {
  const [apps, setApps] = createSignal<AppIcon[]>([])
  const [unproductiveApps, setUnproductiveApps] = createSignal<AppIcon[]>([])
  const [currentPage, setCurrentPage] = createSignal(1)
  const appsPerPage = 3

  // Fetch stored unproductive apps from Electron store on mount
  onMount(() => {
    window.electron.ipcRenderer.send('fetch-app-icons')
    window.electron.ipcRenderer.on('app-icons-response', (_event, appData: AppIcon[]) => {
      const sortedApps = appData.sort((a, b) => a.name.localeCompare(b.name))
      setApps(sortedApps)
    })

    window.electron.ipcRenderer.send('fetch-unproductive-apps')
    window.electron.ipcRenderer.on(
      'unproductive-apps-response',
      (_event, storedUnproductiveApps: AppIcon[]) => {
        setUnproductiveApps(storedUnproductiveApps || [])
      }
    )

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('app-icons-response')
      window.electron.ipcRenderer.removeAllListeners('unproductive-apps-response')
    })
  })

  const toggleUnproductive = (app: AppIcon) => {
    const getUpdatedUnproductiveApps = (prevApps: AppIcon[]): AppIcon[] => {
      return prevApps.some((unproductiveApp) => unproductiveApp.name === app.name)
        ? prevApps.filter((unproductiveApp) => unproductiveApp.name !== app.name)
        : [...prevApps, app]
    }

    const updatedUnproductiveApps = getUpdatedUnproductiveApps(unproductiveApps())
    setUnproductiveApps(updatedUnproductiveApps)
    window.electron.ipcRenderer.send('update-unproductive-apps', updatedUnproductiveApps)
  }

  const fetchApps = () => {
    window.electron.ipcRenderer.send('fetch-app-icons')
  }

  const paginatedApps = () => {
    const startIdx = (currentPage() - 1) * appsPerPage
    const endIdx = startIdx + appsPerPage
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
      <h1 class="mb-8 text-lg mt-4 font-normal">Change Unproductive Apps</h1>
      <Button onClick={fetchApps} class="mb-4 p-2 bg-blue-500 text-white rounded">
        Fetch Apps
      </Button>
      <div class="max-h-96 overflow-y-auto">
        <ul class="space-y-2">
          <For each={paginatedApps()}>
            {(app) => (
              <li class="flex items-center">
                <img src={app.iconPath} alt={`${app.name} icon`} class="w-4 h-4 mr-2" />
                {app.name}
                <Button
                  class={`ml-auto p-1 rounded ${
                    unproductiveApps().some((unproductiveApp) => unproductiveApp.name === app.name)
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-500'
                  }`}
                  onClick={() => toggleUnproductive(app)}
                >
                  {unproductiveApps().some(
                    (unproductiveApp) => unproductiveApp.name === app.name
                  ) ? (
                    <IoRemoveCircleOutline />
                  ) : (
                    <VsAdd />
                  )}
                </Button>
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
        <h3 class="text-base mb-2">Unproductive Apps:</h3>
        <ul>
          <For each={unproductiveApps()}>
            {(app) => (
              <li class="flex items-center">
                <img src={app.iconPath} alt={`${app.name} icon`} class="w-4 h-4 mr-2" />
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
