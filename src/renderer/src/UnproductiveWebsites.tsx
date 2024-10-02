import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { TextField, TextFieldLabel, TextFieldInput } from './components/ui/text-field'
import { Button } from './components/ui/button'

const UnproductiveWebsites = () => {
  const [site, setSite] = createSignal('')
  const [unproductiveSites, setUnproductiveSites] = createSignal<string[]>([])

  const getFavicon = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}`
    } catch (error) {
      console.error('Invalid URL format:', url)
      return ''
    }
  }

  onMount(() => {
    window.electron.ipcRenderer.send('fetch-unproductive-urls') // Request URLs from main process
    window.electron.ipcRenderer.on('unproductive-urls-response', (event, urls) => {
      setUnproductiveSites(urls || [])
      console.log('Unproductive URLs received from main process:', urls)
    })

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('unproductive-urls-response')
    })
  })

  const addSite = () => {
    if (site().trim()) {
      const updatedSites = [...unproductiveSites(), site().trim()]
      setUnproductiveSites(updatedSites)
      setSite('')
      console.log('Unproductive URLs updated:', updatedSites)
      window.electron.ipcRenderer.send('add-unproductive-url', updatedSites)
    }
  }

  const handleRemoveSite = (url: string) => {
    const updatedSites = unproductiveSites().filter((item) => item !== url)
    setUnproductiveSites(updatedSites)
    window.electron.ipcRenderer.send('remove-unproductive-url', updatedSites)
  }

  return (
    <div>
      <h1 class="mb-4 text-2xl font-bold mt-4">Unproductive Websites</h1>
      <div class="flex items-center gap-2 mb-4">
        <TextField class="flex-grow">
          <TextFieldLabel class="sr-only">Unproductive Websites</TextFieldLabel>
          <TextFieldInput
            list="websites"
            type="text"
            placeholder="Any unproductive websites?"
            value={site()}
            onInput={(e) => setSite(e.currentTarget.value)}
            class="w-full p-2 border border-gray-300 rounded"
          />
          <datalist id="websites">
            <option value="https://google.com" />
            <option value="https://github.com" />
            <option value="https://facebook.com" />
            <option value="https://twitter.com" />
            <option value="https://linkedin.com" />
            <option value="https://amazon.com" />
            <option value="https://whatsapp.com" />
            <option value="https://twitter.com" />
          </datalist>
        </TextField>
        <Button onClick={addSite} class="ml-2 p-2 bg-blue-500 text-white rounded">
          Add
        </Button>
      </div>

      <ul class="mt-4">
        <For each={unproductiveSites()}>
          {(site) => (
            <li class="flex items-center mb-2">
              <img src={getFavicon(site)} alt={`${site} favicon`} class="w-4 h-4 mr-2" />
              {site}
              <button
                class="ml-4 bg-red-500 text-white px-2 py-1 rounded"
                onClick={() => handleRemoveSite(site)}
              >
                Remove
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}

export default UnproductiveWebsites
