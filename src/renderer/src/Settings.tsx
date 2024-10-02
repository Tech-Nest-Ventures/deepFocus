import { createSignal, onCleanup, onMount } from 'solid-js'
import { Button } from './components/ui/button'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'
import UnproductiveWebsites from './UnproductiveWebsites'
import UnproductiveApps from './UnproductiveApps'

const Settings = () => {
  const [showEditWebsites, setShowEditWebsites] = createSignal(false)
  const [showEditApps, setShowEditApps] = createSignal(false)

  return (
    <div class="p-4">
      <h2 class="text-2xl font-bold mb-4">Settings</h2>

      <div class="mb-6">
        <h3 class="text-xl font-semibold mb-2">Unproductive Websites</h3>

        <Button class="mt-4" onClick={() => setShowEditWebsites(!showEditWebsites())}>
          {showEditWebsites() ? 'Close Website Editor' : 'Edit Unproductive Websites'}
        </Button>

        {showEditWebsites() && <UnproductiveWebsites />}
      </div>

      <div class="mb-6">
        <h3 class="text-xl font-semibold mb-2">Unproductive Apps</h3>

        <Button class="mt-4" onClick={() => setShowEditApps(!showEditApps())}>
          {showEditApps() ? 'Close App Editor' : 'Edit Unproductive Apps'}
        </Button>

        {showEditApps() && <UnproductiveApps />}
      </div>
    </div>
  )
}

export default Settings
