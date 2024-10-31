import { IpcRendererEvent } from 'electron'
import { createSignal, onMount, onCleanup } from 'solid-js'

const DeepWorkSlider = () => {
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

  const handleSliderChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const value = parseInt(target.value, 10)
    setDeepWorkTarget(value)
    window.electron.ipcRenderer.send('update-deep-work-target', value)
  }
  

  return (
    <div class="my-6">
      {/* <h3 class="text-base font-normal mb-2">Select Deep Work Goal Hours</h3> */}
      <input
        type="range"
        min="1"
        max="12"
        value={deepWorkTarget()}
        class="slider"
        onInput={handleSliderChange}
      />
      <div class="mt-2">
        <span>{deepWorkTarget()} hours</span>
      </div>
    </div>
  )
}

export default DeepWorkSlider
