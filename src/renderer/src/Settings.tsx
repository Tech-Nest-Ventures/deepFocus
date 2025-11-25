import { createSignal, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'
import DeepWorkSlider from './DeepWorkSlider'
import UnproductiveWebsites from './UnproductiveWebsites'
import UnproductiveApps from './UnproductiveApps'
import Modal from './components/modal'
import { Motion } from 'solid-motionone'
import { IpcRendererEvent } from 'electron'

const Settings = () => {
  const [showEditWebsites, setShowEditWebsites] = createSignal(false)
  const [showEditApps, setShowEditApps] = createSignal(false)
  const [focusMode, setFocusMode] = createSignal(false)

  onMount(() => {
    // Fetch current focus mode state
    window.electron.ipcRenderer.send('fetch-focus-mode')

    const handleFocusModeResponse = (_event: IpcRendererEvent, enabled: boolean): void => {
      setFocusMode(enabled)
    }

    window.electron.ipcRenderer.on('focus-mode-response', handleFocusModeResponse)

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('focus-mode-response')
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
    {/* Swiss Typography: Left-aligned, asymmetric layout, extreme whitespace */}
    <div class="flex justify-start items-start h-full flex-col p-swiss-10 space-y-swiss-12">
      <div class="space-y-swiss-12 w-full">
        <h2 class="mb-swiss-8 text-2xl font-extrabold tracking-tight uppercase">SETTINGS</h2>

        <div class="mb-swiss-10 border-b-2 border-foreground pb-swiss-6">
          <h3 class="text-xl font-bold mb-swiss-4 uppercase tracking-tight">UNPRODUCTIVE WEBSITES</h3>
          <Button variant="outline" size="sm" class="mt-swiss-4" onClick={() => setShowEditWebsites(true)}>
            CHANGE
          </Button>
          {showEditWebsites() && (
            <Modal title="" onClose={() => setShowEditWebsites(false)}>
              <UnproductiveWebsites />
            </Modal>
          )}
        </div>

        <div class="mb-swiss-10 border-b-2 border-foreground pb-swiss-6">
          <h3 class="text-xl font-bold mb-swiss-4 uppercase tracking-tight">UNPRODUCTIVE APPS</h3>
          <Button variant="outline" size="sm" class="mt-swiss-4" onClick={() => setShowEditApps(true)}>
            CHANGE
          </Button>
          {showEditApps() && (
            <Modal title="" onClose={() => setShowEditApps(false)}>
              <UnproductiveApps />
            </Modal>
          )}
        </div>

        <div class="border-b-2 border-foreground pb-swiss-6">
          <h3 class="text-xl font-bold mb-swiss-4 uppercase tracking-tight">DAILY DEEP WORK TARGET</h3>
          <DeepWorkSlider />
        </div>

        <div class="border-b-2 border-foreground pb-swiss-6">
          <h3 class="text-xl font-bold mb-swiss-4 uppercase tracking-tight">FOCUS MODE</h3>
          <p class="text-sm text-muted-foreground mb-swiss-4 uppercase">
            When enabled, unproductive apps and websites will be automatically closed. When disabled, you'll receive notifications instead.
          </p>
          <Button
            variant={focusMode() ? 'default' : 'outline'}
            size="default"
            onClick={toggleFocusMode}
            class="w-full"
          >
            {focusMode() ? 'FOCUS MODE: ON' : 'FOCUS MODE: OFF'}
          </Button>
        </div>
      </div>
    </div>
    </Motion.div>
  )
}

export default Settings
