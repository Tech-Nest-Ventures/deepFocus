import { createSignal } from 'solid-js'
import { Button } from './components/ui/button'
import DeepWorkSlider from './DeepWorkSlider'
import UnproductiveWebsites from './UnproductiveWebsites'
import UnproductiveApps from './UnproductiveApps'
import Modal from './components/modal'

const Settings = () => {
  const [showEditWebsites, setShowEditWebsites] = createSignal(false)
  const [showEditApps, setShowEditApps] = createSignal(false)

  return (
    <div class="flex justify-center items-center h-screen flex-col space-y-8">
      <div class="space-y-8">
        <h2 class="mb-10 text-2xl font-light">Settings</h2>

        <div class="mb-8">
          <h3 class="text-base font-normal mb-2">Unproductive Websites</h3>
          <Button class="mt-4" onClick={() => setShowEditWebsites(true)}>
            Change
          </Button>
          {showEditWebsites() && (
            <Modal title="" onClose={() => setShowEditWebsites(false)}>
              <UnproductiveWebsites />
            </Modal>
          )}
        </div>

        <div class="mb-8">
          <h3 class="text-base font-normal mb-2">Unproductive Apps</h3>
          <Button class="mt-4" onClick={() => setShowEditApps(true)}>
            Change
          </Button>
          {showEditApps() && (
            <Modal title="" onClose={() => setShowEditApps(false)}>
              <UnproductiveApps />
            </Modal>
          )}
        </div>

        <div>
          <DeepWorkSlider />
        </div>
      </div>
    </div>
  )
}

export default Settings
