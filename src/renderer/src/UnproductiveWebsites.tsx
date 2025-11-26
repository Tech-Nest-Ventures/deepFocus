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
    <div style={{ 'gap': '48px', display: 'flex', 'flex-direction': 'column' }}>
      <div class="flex items-center" style={{ 'gap': '16px', 'margin-bottom': '48px' }}>
        <TextField class="flex-grow">
          <TextFieldInput
            list="websites"
            type="text"
            placeholder="ANY UNPRODUCTIVE WEBSITES?"
            value={site()}
            onInput={(e) => setSite(e.currentTarget.value)}
            class="w-full uppercase"
            style={{ 'text-transform': 'uppercase' }}
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

      <ul style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
        <For each={unproductiveSites()}>
          {(site) => (
            <li class="flex items-center justify-between" style={{ 'border-bottom': '2px solid hsl(var(--foreground))', 'padding-bottom': '24px' }}>
              <div class="flex items-center" style={{ 'gap': '16px' }}>
                <img src={getFavicon(site)} alt={`${site} favicon`} style={{ width: '24px', height: '24px' }} />
                <span style={{ 'font-weight': 600, 'text-transform': 'uppercase', 'font-size': '0.875rem' }}>{site}</span>
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
