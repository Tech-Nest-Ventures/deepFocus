import { createSignal, onCleanup, onMount } from 'solid-js'
import { Button } from './components/ui/button'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'

const Settings = () => {
  const [unproductiveUrls, setUnproductiveUrls] = createSignal<string[]>([])
  const [newUrl, setNewUrl] = createSignal('')

  onMount(() => {
    window?.electron.ipcRenderer.send('fetch-unproductive-urls') // Request URLs from main process
    window?.electron.ipcRenderer.on('unproductive-urls-response', (event, urls) => {
      setUnproductiveUrls(urls || []) // Update the state with the received URLs
      console.log('Unproductive URLs received from main process:', urls, event.processId)
    })

    onCleanup(() => {
      window?.electron.ipcRenderer.removeAllListeners('unproductive-urls-response')
    })
  })

  const handleAddUrl = () => {
    if (newUrl().trim()) {
      setUnproductiveUrls([...unproductiveUrls(), newUrl().trim()])
      setNewUrl('')
    }
    console.log('Unproductive URLs updated:', unproductiveUrls())
    window?.electron.ipcRenderer.send('add-unproductive-url', unproductiveUrls())
  }

  const handleRemoveUrl = (url: string) => {
    const updatedUrls = unproductiveUrls().filter((item) => item !== url)
    setUnproductiveUrls(updatedUrls)
    window?.electron.ipcRenderer.send('remove-unproductive-url', unproductiveUrls())
  }

  return (
    <div class="p-4">
      <h2 class="text-2xl font-bold mb-4">Settings</h2>

      <div class="mb-6">
        <h3 class="text-xl font-semibold mb-2">Unproductive Websites</h3>
        <ul class="list-disc pl-6">
          {unproductiveUrls().map((url) => (
            <li class="mb-2 flex justify-between">
              <span>{url}</span>
              <Button type="submit" onClick={() => handleRemoveUrl(url)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <div class="mt-4 flex">
          <TextField class="gap-1">
            <TextFieldLabel class="sr-only">Unproductive Websites</TextFieldLabel>
            <TextFieldInput
              type="text"
              placeholder="Enter a website or App"
              value={newUrl()}
              onInput={(e) => setNewUrl(e.currentTarget.value)}
            />
          </TextField>
          <Button class="bg-blue-500 text-white px-4 py-2 ml-2 rounded" onClick={handleAddUrl}>
            Add URL
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Settings
