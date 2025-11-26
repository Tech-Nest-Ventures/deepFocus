import { IpcRendererEvent } from 'electron'
import { createSignal, onMount, onCleanup } from 'solid-js'
import { Button } from './components/ui/button'
import { IconMinus, IconPlus } from './components/ui/icons'

const DeepWorkTarget = () => {
  const [deepWorkTarget, setDeepWorkTarget] = createSignal(8) // Default to 8 if nothing is fetched

  // Fetch the current deep work target from the main thread
  onMount(() => {
    window.electron.ipcRenderer.send('fetch-deep-work-target')

    const handleDeepWorkTargetResponse = (_event: IpcRendererEvent, target: number) => {
      setDeepWorkTarget(target) // Set the fetched target value
    }

    window.electron.ipcRenderer.on('deep-work-target-response', handleDeepWorkTargetResponse)

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('deep-work-target-response')
      window.electron.ipcRenderer.removeAllListeners('fetch-deep-work-target')
    })
  })

  const updateTarget = (newValue: number) => {
    // Clamp value between 1 and 12
    const clampedValue = Math.max(1, Math.min(12, newValue))
    setDeepWorkTarget(clampedValue)
    window.electron.ipcRenderer.send('update-deep-work-target', clampedValue)
  }

  const decrement = () => {
    updateTarget(deepWorkTarget() - 1)
  }

  const increment = () => {
    updateTarget(deepWorkTarget() + 1)
  }

  return (
    <div style={{ 'margin-top': '0px', 'gap': '0px', display: 'flex', 'flex-direction': 'column' }}>
      <div class="flex items-center" style={{ 'gap': '32px', 'align-items': 'center' }}>
        <Button
          variant="outline"
          size="icon"
          onClick={decrement}
          disabled={deepWorkTarget() <= 1}
          style={{
            'color': 'hsl(var(--foreground))',
            'border-color': 'hsl(var(--foreground))',
            'width': '48px',
            'height': '48px'
          }}
        >
          <IconMinus style={{ 'width': '20px', 'height': '20px' }} />
        </Button>
        
        <span class="swiss-metric" style={{ 'font-size': '1.5rem', 'font-weight': 700, 'color': 'hsl(var(--foreground))', 'text-transform': 'uppercase', 'letter-spacing': '0.05em', 'min-width': '120px', 'text-align': 'center' }}>
          {deepWorkTarget()} HOURS
        </span>
        
        <Button
          variant="outline"
          size="icon"
          onClick={increment}
          disabled={deepWorkTarget() >= 12}
          style={{
            'color': 'hsl(var(--foreground))',
            'border-color': 'hsl(var(--foreground))',
            'width': '48px',
            'height': '48px'
          }}
        >
          <IconPlus style={{ 'width': '20px', 'height': '20px' }} />
        </Button>
      </div>
    </div>
  )
}

export default DeepWorkTarget

