import { createSignal, onMount, onCleanup } from 'solid-js'

const DeepWorkSlider = () => {
  const [deepWorkTarget, setDeepWorkTarget] = createSignal(8) // Default to 8 if nothing is fetched

  // Fetch the current deep work target from the main thread
  onMount(() => {
    window.electron.ipcRenderer.send('fetch-deep-work-target')

    const handleDeepWorkTargetResponse = (event, target) => {
      setDeepWorkTarget(target) // Set the fetched target value
    }

    window.electron.ipcRenderer.on('deep-work-target-response', handleDeepWorkTargetResponse)

    onCleanup(() => {
      window.electron.ipcRenderer.removeListener(
        'deep-work-target-response',
        handleDeepWorkTargetResponse
      )
    })
  })

  const handleSliderChange = (e) => {
    const value = parseInt(e.target.value, 10)
    setDeepWorkTarget(value) // Update the local state
    window.electron.ipcRenderer.send('update-deep-work-target', value)
  }

  return (
    <div class="my-6">
      <h3 class="text-base font-normal mb-2">Select Deep Work Goal Hours</h3>
      <input
        type="range"
        min="1"
        max="12"
        value={deepWorkTarget()}
        class="slider"
        onInput={handleSliderChange}
      />
      <div class="mt-2">
        <span>Selected Deep Work Goal: {deepWorkTarget()} hours</span>
      </div>
    </div>
  )
}

export default DeepWorkSlider
