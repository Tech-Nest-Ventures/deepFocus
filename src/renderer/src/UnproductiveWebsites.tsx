import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { TextField, TextFieldInput } from './components/ui/text-field'
import { Button } from './components/ui/button'
import { IoRemoveCircleOutline, VsAdd } from './components/ui/icons'
import { getFavicon } from './lib/utils'

const UnproductiveWebsites = () => {
  const [site, setSite] = createSignal('')
  const [unproductiveSites, setUnproductiveSites] = createSignal<string[]>([])


  onMount(() => {
    window.electron.ipcRenderer.send('fetch-unproductive-urls') // Request URLs from main process
    window.electron.ipcRenderer.on('unproductive-urls-response', (_event, urls) => {
      setUnproductiveSites(urls || [])
      console.log('Unproductive URLs received from main process:', urls)
    })

    onCleanup(() => {
      window.electron.ipcRenderer.removeAllListeners('unproductive-urls-response')
      window.electron.ipcRenderer.removeAllListeners('fetch-unproductive-urls')
    })
  })

  const addSite = () => {
    if (site().trim()) {
      const newSite = site().trim()
      if (newSite.startsWith('http://') || newSite.startsWith('https://')) {
        const updatedSites = [...unproductiveSites(), newSite]
        setUnproductiveSites(updatedSites)
        setSite('')
        console.log('Unproductive URLs updated:', updatedSites)
        window.electron.ipcRenderer.send('add-unproductive-url', updatedSites)
      } else {
        console.log('Invalid URL format:', newSite)
        const updatedSite = `https://${newSite}`
        const updatedSites = [...unproductiveSites(), updatedSite]
        setUnproductiveSites(updatedSites)
        setSite('')
        console.log('Unproductive URLs updated:', updatedSites)
        window.electron.ipcRenderer.send('add-unproductive-url', updatedSites)
      }
    }
  }

  const handleRemoveSite = (url: string) => {
    const updatedSites = unproductiveSites().filter((item) => item !== url)
    setUnproductiveSites(updatedSites)
    window.electron.ipcRenderer.send('remove-unproductive-url', updatedSites)
  }

  return (
    <div class="space-y-swiss-6">
      <div class="flex items-center gap-swiss-4 mb-swiss-6">
        <TextField class="flex-grow">
          <TextFieldInput
            list="websites"
            type="text"
            placeholder="ANY UNPRODUCTIVE WEBSITES?"
            value={site()}
            onInput={(e) => setSite(e.currentTarget.value)}
            class="w-full uppercase"
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
        <Button onClick={addSite} variant="outline" size="sm">
          <VsAdd />
        </Button>
      </div>

      <ul class="space-y-swiss-4">
        <For each={unproductiveSites()}>
          {(site) => (
            <li class="flex items-center justify-between border-b-2 border-foreground pb-swiss-3">
              <div class="flex items-center gap-swiss-3">
                <img src={getFavicon(site)} alt={`${site} favicon`} class="w-6 h-6" />
                <span class="font-semibold uppercase">{site}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveSite(site)}
              >
                <IoRemoveCircleOutline />
              </Button>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}

export default UnproductiveWebsites
