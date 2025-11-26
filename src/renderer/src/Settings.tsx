import { createSignal, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'
import { Toggle } from './components/ui/toggle'
import DeepWorkTarget from './DeepWorkTarget'
import UnproductiveItems from './UnproductiveItems'
import Modal from './components/modal'
import { Motion } from 'solid-motionone'
import { IpcRendererEvent } from 'electron'

const Settings = () => {
  const [showEditItems, setShowEditItems] = createSignal(false)
  const [focusMode, setFocusMode] = createSignal(false)
  const [unproductiveWebsitesCount, setUnproductiveWebsitesCount] = createSignal(0)
  const [unproductiveAppsCount, setUnproductiveAppsCount] = createSignal(0)

  onMount(() => {
    // Fetch current focus mode state
    window.electron.ipcRenderer.send('fetch-focus-mode')
    window.electron.ipcRenderer.send('fetch-unproductive-urls')
    window.electron.ipcRenderer.send('fetch-unproductive-apps')

    const handleFocusModeResponse = (_event: IpcRendererEvent, enabled: boolean): void => {
      setFocusMode(enabled)
    }

    const handleUnproductiveUrlsResponse = (_event: IpcRendererEvent, urls: string[]): void => {
      setUnproductiveWebsitesCount(urls?.length || 0)
    }

    const handleUnproductiveAppsResponse = (_event: IpcRendererEvent, apps: any[]): void => {
      setUnproductiveAppsCount(apps?.length || 0)
    }

    window.electron.ipcRenderer.on('focus-mode-response', handleFocusModeResponse)
    window.electron.ipcRenderer.on('unproductive-urls-response', handleUnproductiveUrlsResponse)
    window.electron.ipcRenderer.on('unproductive-apps-response', handleUnproductiveAppsResponse)

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('focus-mode-response')
      window.electron.ipcRenderer.removeAllListeners('unproductive-urls-response')
      window.electron.ipcRenderer.removeAllListeners('unproductive-apps-response')
    })
  })

  const toggleFocusMode = (): void => {
    const newState = !focusMode()
    setFocusMode(newState)
    window.electron.ipcRenderer.send('toggle-focus-mode', newState)
  }

  return (
    <Motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, easing: "ease-out" }}
  >
    {/* Swiss Typography: Left-aligned, asymmetric layout, balanced whitespace */}
    <div class="flex justify-start items-start h-full flex-col w-full" style={{ padding: '48px 64px', 'gap': '64px', 'max-width': '100%', 'overflow-x': 'hidden', 'box-sizing': 'border-box' }}>
      <div class="w-full" style={{ 'gap': '64px', display: 'flex', 'flex-direction': 'column', 'max-width': '600px', 'width': '100%', 'box-sizing': 'border-box' }}>
        {/* Primary heading */}
        <div style={{ 'gap': '24px', display: 'flex', 'flex-direction': 'column' }}>
          <h1 class="swiss-heading" style={{ 'font-size': '1.75rem' }}>SETTINGS</h1>
        </div>

        {/* Settings sections with clear hierarchy - Balanced whitespace */}
        <div style={{ 'gap': '64px', display: 'flex', 'flex-direction': 'column' }}>
          <section style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column' }}>
              <label class="swiss-label">CONFIGURATION</label>
              <h3 style={{ 'font-size': '1.125rem', 'font-weight': 700, 'text-transform': 'uppercase', 'margin': 0, 'padding': 0, 'line-height': 1.2 }}>UNPRODUCTIVE ITEMS</h3>
            </div>
            <div style={{ 'gap': '20px', display: 'flex', 'flex-direction': 'column' }}>
              <div style={{ 'gap': '12px', display: 'flex', 'flex-direction': 'column' }}>
                <div style={{ 'gap': '8px', display: 'flex', 'flex-direction': 'column' }}>
                  <span class="swiss-metric" style={{ 'font-size': '1rem', 'font-weight': 700, 'color': (unproductiveWebsitesCount() + unproductiveAppsCount()) > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                    {unproductiveWebsitesCount() + unproductiveAppsCount()} {(unproductiveWebsitesCount() + unproductiveAppsCount()) === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                  <div style={{ 'gap': '4px', display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'wrap' }}>
                    <span class="swiss-metric" style={{ 'font-size': '0.875rem', 'font-weight': 600, 'color': unproductiveWebsitesCount() > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                      {unproductiveWebsitesCount()} {unproductiveWebsitesCount() === 1 ? 'WEBSITE' : 'WEBSITES'}
                    </span>
                    <span style={{ 'color': 'hsl(var(--muted-foreground))', 'margin': '0 8px' }}>•</span>
                    <span class="swiss-metric" style={{ 'font-size': '0.875rem', 'font-weight': 600, 'color': unproductiveAppsCount() > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                      {unproductiveAppsCount()} {unproductiveAppsCount() === 1 ? 'APP' : 'APPS'}
                    </span>
                  </div>
                  {(unproductiveWebsitesCount() + unproductiveAppsCount()) === 0 && (
                    <span style={{ 'font-size': '0.75rem', 'color': 'hsl(var(--muted-foreground))', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>
                      NO ITEMS CONFIGURED
                    </span>
                  )}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditItems(true)}
                style={{ 
                  'max-width': '200px', 
                  'font-size': '0.875rem', 
                  'white-space': 'nowrap',
                  'color': 'hsl(var(--foreground))',
                  'border-color': 'hsl(var(--foreground))'
                }}
              >
                {(unproductiveWebsitesCount() + unproductiveAppsCount() > 0 ? 'CHANGE' : 'ADD')}
              </Button>
            </div>
            {showEditItems() && (
              <Modal title="" onClose={() => {
                setShowEditItems(false)
                // Refresh counts when modal closes
                window.electron.ipcRenderer.send('fetch-unproductive-urls')
                window.electron.ipcRenderer.send('fetch-unproductive-apps')
              }}>
                <UnproductiveItems />
              </Modal>
            )}
          </section>

          <section style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column' }}>
              <label class="swiss-label">TARGET</label>
              <h3 style={{ 'font-size': '1.125rem', 'font-weight': 700, 'text-transform': 'uppercase', 'margin': 0, 'padding': 0, 'line-height': 1.2 }}>DAILY DEEP WORK TARGET</h3>
            </div>
            <DeepWorkTarget />
          </section>

          <section style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column' }}>
              <label class="swiss-label">BEHAVIOR</label>
              <h3 style={{ 'font-size': '1.125rem', 'font-weight': 700, 'text-transform': 'uppercase', 'margin': 0, 'padding': 0, 'line-height': 1.2 }}>FOCUS MODE</h3>
            </div>
            <div style={{ 'gap': '24px', display: 'flex', 'flex-direction': 'column' }}>
              <p style={{ 'font-size': '0.875rem', 'color': 'hsl(var(--muted-foreground))', 'line-height': 1.8, 'max-width': '32rem', 'margin': 0, 'padding': 0 }}>
                {focusMode() 
                  ? "Unproductive apps and websites will be automatically closed when detected."
                  : "You'll receive notifications when unproductive apps and websites are detected."}
              </p>
              
              {/* Apple-inspired toggle switch design */}
              <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column' }}>
                <div 
                  class="flex items-center justify-between"
                  style={{ 
                    'padding': '16px 0',
                    'border-top': '2px solid hsl(var(--foreground))',
                    'border-bottom': '2px solid hsl(var(--foreground))'
                  }}
                >
                  <div style={{ 'gap': '8px', display: 'flex', 'flex-direction': 'column', 'flex': 1 }}>
                    <div class="flex items-center" style={{ 'gap': '12px' }}>
                      <span 
                        class="swiss-metric" 
                        style={{ 
                          'font-size': '1.125rem', 
                          'font-weight': 700, 
                          'color': focusMode() ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                          'text-transform': 'uppercase',
                          'letter-spacing': '0.02em'
                        }}
                      >
                        {focusMode() ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <span 
                      style={{ 
                        'font-size': '0.75rem', 
                        'color': 'hsl(var(--muted-foreground))', 
                        'text-transform': 'uppercase', 
                        'letter-spacing': '0.05em',
                        'line-height': 1.4
                      }}
                    >
                      {focusMode() ? 'AUTOMATIC CLOSURE ENABLED' : 'NOTIFICATIONS ONLY'}
                    </span>
                  </div>
                  <Toggle
                    checked={focusMode()}
                    onCheckedChange={toggleFocusMode}
                    aria-label="Toggle Focus Mode"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
    </Motion.div>
  )
}

export default Settings
