import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { TextField, TextFieldInput } from './components/ui/text-field'
import { Button } from './components/ui/button'
import { IoRemoveCircleOutline, VsAdd } from './components/ui/icons'
import { getFavicon, formatUrlForDisplay } from './lib/utils'
import { AppIcon } from './types'
import { IpcRendererEvent } from 'electron'

const UnproductiveItems = () => {
  const [site, setSite] = createSignal('')
  const [unproductiveSites, setUnproductiveSites] = createSignal<string[]>([])
  const [apps, setApps] = createSignal<AppIcon[]>([])
  const [unproductiveApps, setUnproductiveApps] = createSignal<AppIcon[]>([])
  const [currentPage, setCurrentPage] = createSignal(1)
  const [activeTab, setActiveTab] = createSignal<'websites' | 'apps'>('websites')
  const appsPerPage = 3

  // Function to fetch the icon data URL
  const fetchAppIcon = async (iconPath: string) => {
    try {
      const iconDataUrl = await window.electron.ipcRenderer.invoke('get-icon', iconPath)
      return iconDataUrl || 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'
    } catch (error) {
      console.error('Error fetching app icon:', error)
      return 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'
    }
  }

  onMount(() => {
    // Fetch websites
    window.electron.ipcRenderer.send('fetch-unproductive-urls')
    window.electron.ipcRenderer.on('unproductive-urls-response', (_event, urls) => {
      setUnproductiveSites(urls || [])
    })

    // Fetch apps
    window.electron.ipcRenderer.send('fetch-app-icons')
    window.electron.ipcRenderer.on('app-icons-response', async (_event, appData: AppIcon[]) => {
      const sortedApps = appData.sort((a, b) => a.appName.localeCompare(b.appName))
      const appsWithIcons = await Promise.all(
        sortedApps.map(async (app) => ({
          ...app,
          iconPath: await fetchAppIcon(app.iconPath)
        }))
      )
      setApps(appsWithIcons)
    })

    window.electron.ipcRenderer.send('fetch-unproductive-apps')
    window.electron.ipcRenderer.on('unproductive-apps-response', (_event, storedUnproductiveApps: AppIcon[]) => {
      setUnproductiveApps(storedUnproductiveApps || [])
    })

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('unproductive-urls-response')
      window.electron.ipcRenderer.removeAllListeners('app-icons-response')
      window.electron.ipcRenderer.removeAllListeners('unproductive-apps-response')
    })
  })

  const addSite = () => {
    if (site().trim()) {
      const newSite = site().trim()
      const finalSite = newSite.startsWith('http://') || newSite.startsWith('https://')
        ? newSite
        : `https://${newSite}`
      const updatedSites = [...unproductiveSites(), finalSite]
      setUnproductiveSites(updatedSites)
      setSite('')
      window.electron.ipcRenderer.send('add-unproductive-url', updatedSites)
    }
  }

  const handleRemoveSite = (url: string) => {
    const updatedSites = unproductiveSites().filter((item) => item !== url)
    setUnproductiveSites(updatedSites)
    window.electron.ipcRenderer.send('remove-unproductive-url', updatedSites)
  }

  const toggleUnproductive = (app: AppIcon) => {
    const updatedUnproductiveApps = unproductiveApps().some((unproductiveApp) => unproductiveApp.appName === app.appName)
      ? unproductiveApps().filter((unproductiveApp) => unproductiveApp.appName !== app.appName)
      : [...unproductiveApps(), app]
    setUnproductiveApps(updatedUnproductiveApps)
    window.electron.ipcRenderer.send('update-unproductive-apps', updatedUnproductiveApps)
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
    <div style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column', 'min-width': 0 }}>
      {/* Tab switcher */}
      <div class="flex" style={{ 'gap': '16px', 'border-bottom': '2px solid hsl(var(--foreground))', 'flex-shrink': 0 }}>
        <button
          onClick={() => setActiveTab('websites')}
          style={{
            'padding': '12px 24px',
            'border-bottom': activeTab() === 'websites' ? '2px solid hsl(var(--foreground))' : '2px solid transparent',
            'background': 'transparent',
            'color': activeTab() === 'websites' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            'font-weight': activeTab() === 'websites' ? 700 : 500,
            'text-transform': 'uppercase',
            'font-size': '0.875rem',
            'letter-spacing': '0.05em',
            'cursor': 'pointer',
            'border': 'none',
            'margin-bottom': '-2px'
          }}
        >
          WEBSITES
        </button>
        <button
          onClick={() => setActiveTab('apps')}
          style={{
            'padding': '12px 24px',
            'border-bottom': activeTab() === 'apps' ? '2px solid hsl(var(--foreground))' : '2px solid transparent',
            'background': 'transparent',
            'color': activeTab() === 'apps' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            'font-weight': activeTab() === 'apps' ? 700 : 500,
            'text-transform': 'uppercase',
            'font-size': '0.875rem',
            'letter-spacing': '0.05em',
            'cursor': 'pointer',
            'border': 'none',
            'margin-bottom': '-2px'
          }}
        >
          APPS
        </button>
      </div>

      {/* Websites Tab */}
      {activeTab() === 'websites' && (
        <div style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column', 'min-width': 0 }}>
          <div class="flex items-center" style={{ 'gap': '12px', 'flex-shrink': 0, 'min-width': 0 }}>
            <TextField class="flex-grow" style={{ 'min-width': 0, 'max-width': '100%' }}>
              <TextFieldInput
                list="websites"
                type="text"
                placeholder="ANY UNPRODUCTIVE WEBSITES?"
                value={site()}
                onInput={(e) => setSite(e.currentTarget.value)}
                class="w-full uppercase"
                style={{ 'text-transform': 'uppercase', 'max-width': '100%', 'box-sizing': 'border-box' }}
              />
              <datalist id="websites">
                <option value="https://google.com" />
                <option value="https://github.com" />
                <option value="https://facebook.com" />
                <option value="https://twitter.com" />
                <option value="https://linkedin.com" />
                <option value="https://amazon.com" />
                <option value="https://whatsapp.com" />
              </datalist>
            </TextField>
            <Button onClick={addSite} variant="outline" size="sm" style={{ 'flex-shrink': 0, 'color': 'hsl(var(--foreground))', 'border-color': 'hsl(var(--foreground))' }}>
              <VsAdd />
            </Button>
          </div>

          <ul style={{ 'gap': '24px', display: 'flex', 'flex-direction': 'column', 'overflow-y': 'auto', 'max-height': '400px' }}>
            <For each={unproductiveSites()}>
              {(site) => (
                <li class="flex items-center justify-between" style={{ 'border-bottom': '2px solid hsl(var(--foreground))', 'padding-bottom': '24px', 'min-width': 0 }}>
                  <div class="flex items-center" style={{ 'gap': '16px', 'min-width': 0, 'flex': 1, 'overflow': 'hidden' }}>
                    <img src={getFavicon(site)} alt={`${site} favicon`} style={{ width: '24px', height: '24px', 'flex-shrink': 0 }} />
                    <span style={{ 'font-weight': 600, 'text-transform': 'uppercase', 'font-size': '0.875rem', 'overflow': 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{formatUrlForDisplay(site)}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleRemoveSite(site)} style={{ 'flex-shrink': 0, 'color': 'hsl(var(--foreground))', 'border-color': 'hsl(var(--foreground))' }}>
                    <IoRemoveCircleOutline />
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </div>
      )}

      {/* Apps Tab */}
      {activeTab() === 'apps' && (
        <div style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column', 'min-width': 0 }}>
          <div style={{ 'max-height': '300px', 'overflow-y': 'auto', 'overflow-x': 'hidden' }}>
            <ul style={{ 'gap': '24px', display: 'flex', 'flex-direction': 'column' }}>
              <For each={paginatedApps()}>
                {(app) => (
                  <li class="flex items-center justify-between" style={{ 'border-bottom': '2px solid hsl(var(--foreground))', 'padding-bottom': '24px', 'min-width': 0 }}>
                    <div class="flex items-center" style={{ 'gap': '16px', 'min-width': 0, 'flex': 1, 'overflow': 'hidden' }}>
                      <img src={app.iconPath} alt={`${app.appName} icon`} style={{ width: '24px', height: '24px', 'flex-shrink': 0 }} />
                      <span style={{ 'font-weight': 600, 'text-transform': 'uppercase', 'font-size': '0.875rem', 'overflow': 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{app.appName}</span>
                    </div>
                    <Button
                      variant={unproductiveApps().some((unproductiveApp) => unproductiveApp.appName === app.appName) ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => toggleUnproductive(app)}
                      style={{ 
                        'flex-shrink': 0,
                        'color': unproductiveApps().some((unproductiveApp) => unproductiveApp.appName === app.appName) ? undefined : 'hsl(var(--foreground))',
                        'border-color': unproductiveApps().some((unproductiveApp) => unproductiveApp.appName === app.appName) ? undefined : 'hsl(var(--foreground))'
                      }}
                    >
                      {unproductiveApps().some((unproductiveApp) => unproductiveApp.appName === app.appName) ? (
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

          <div class="flex justify-between">
            <Button onClick={prevPage} disabled={currentPage() === 1} variant="outline" size="sm" style={{ 'color': 'hsl(var(--foreground))', 'border-color': 'hsl(var(--foreground))' }}>
              PREVIOUS
            </Button>
            <Button onClick={nextPage} disabled={currentPage() * appsPerPage >= apps().length} variant="outline" size="sm" style={{ 'color': 'hsl(var(--foreground))', 'border-color': 'hsl(var(--foreground))' }}>
              NEXT
            </Button>
          </div>

          {unproductiveApps().length > 0 && (
            <div style={{ 'margin-top': '24px', 'flex-shrink': 0 }}>
              <h3 class="swiss-heading" style={{ 'font-size': '1rem', 'margin-bottom': '16px' }}>SELECTED APPS:</h3>
              <ul style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column', 'max-height': '200px', 'overflow-y': 'auto' }}>
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
          )}
        </div>
      )}
    </div>
  )
}

export default UnproductiveItems

