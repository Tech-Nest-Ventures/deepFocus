import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'
import { IoRemoveCircleOutline, VsAdd } from './components/ui/icons'
import { AppIcon } from './types'

const UnproductiveApps = () => {
  const [apps, setApps] = createSignal<AppIcon[]>([])
  const [unproductiveApps, setUnproductiveApps] = createSignal<AppIcon[]>([])
  const [currentPage, setCurrentPage] = createSignal(1)
  const appsPerPage = 3

  // Function to fetch the icon data URL
  const fetchAppIcon = async (iconPath: string) => {
    try {
      const iconDataUrl = await window.electron.ipcRenderer.invoke('get-icon', iconPath);
      return iconDataUrl || 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'; // Provide a default icon if none is found
    } catch (error) {
      console.error('Error fetching app icon:', error);
      return 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'; // Return default icon on error
    }
  };

  onMount(() => {
    window.electron.ipcRenderer.send('fetch-app-icons')
    window.electron.ipcRenderer.on('app-icons-response', async (_event, appData: AppIcon[]) => {
      const sortedApps = appData.sort((a, b) => a.appName.localeCompare(b.appName))

      const appsWithIcons = await Promise.all(
        sortedApps.map(async (app) => ({
          ...app,
          iconPath: await fetchAppIcon(app.iconPath) // Fetch icon and update iconPath with base64 data URL
        }))
      )

      console.log('Apps with icons:', appsWithIcons)
      setApps(appsWithIcons)
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
      return prevApps.some((unproductiveApp) => unproductiveApp.appName === app.appName)
        ? prevApps.filter((unproductiveApp) => unproductiveApp.appName !== app.appName)
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
    <div style={{ 'gap': '64px', display: 'flex', 'flex-direction': 'column' }}>
      <h1 class="swiss-heading" style={{ 'font-size': '1.25rem', 'margin-bottom': '48px' }}>CHANGE UNPRODUCTIVE APPS</h1>
      <div style={{ 'max-height': '400px', 'overflow-y': 'auto' }}>
        <ul style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
          <For each={paginatedApps()}>
            {(app) => (
              <li class="flex items-center justify-between" style={{ 'border-bottom': '2px solid hsl(var(--foreground))', 'padding-bottom': '24px' }}>
                <div class="flex items-center" style={{ 'gap': '16px' }}>
                  <img src={app.iconPath} alt={`${app.appName} icon`} style={{ width: '24px', height: '24px' }} />
                  <span style={{ 'font-weight': 600, 'text-transform': 'uppercase', 'font-size': '0.875rem' }}>{app.appName}</span>
                </div>
                <Button
                  variant={unproductiveApps().some((unproductiveApp) => unproductiveApp.appName === app.appName) ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => toggleUnproductive(app)}
                >
                  {unproductiveApps().some(
                    (unproductiveApp) => unproductiveApp.appName === app.appName
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

      <div class="flex justify-between" style={{ 'margin-top': '48px' }}>
        <Button onClick={prevPage} disabled={currentPage() === 1} variant="outline" size="sm">
          PREVIOUS
        </Button>
        <Button onClick={nextPage} disabled={currentPage() * appsPerPage >= apps().length} variant="outline" size="sm">
          NEXT
        </Button>
      </div>

      <div style={{ 'margin-top': '64px' }}>
        <h3 class="swiss-heading" style={{ 'font-size': '1.125rem', 'margin-bottom': '32px' }}>UNPRODUCTIVE APPS:</h3>
        <ul style={{ 'gap': '24px', display: 'flex', 'flex-direction': 'column' }}>
          <For each={unproductiveApps()}>
            {(app) => (
              <li class="flex items-center" style={{ 'gap': '16px', 'border-bottom': '2px solid hsl(var(--foreground))', 'padding-bottom': '20px' }}>
                <img src={app.iconPath} alt={`${app.appName} icon`} style={{ width: '24px', height: '24px' }} />
                <span style={{ 'font-weight': 600, 'text-transform': 'uppercase', 'font-size': '0.875rem' }}>{app.appName}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  )
}

export default UnproductiveApps
