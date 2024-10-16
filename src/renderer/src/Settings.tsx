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
    <div class="p-4">
      <h2 class="text-2xl font-light mb-4">Settings</h2>

      <div class="mb-6">
        <h3 class="text-base font-normal mb-2">Unproductive Websites</h3>
        <Button class="mt-4" onClick={() => setShowEditWebsites(true)}>
          Edit Unproductive Websites
        </Button>
        {showEditWebsites() && (
          <Modal title="Edit Unproductive Websites" onClose={() => setShowEditWebsites(false)}>
            <UnproductiveWebsites />
          </Modal>
        )}
      </div>

      <div class="mb-6">
        <h3 class="text-base font-normal mb-2">Unproductive Apps</h3>
        <Button class="mt-4" onClick={() => setShowEditApps(true)}>
          Edit Unproductive Apps
        </Button>
        {showEditApps() && (
          <Modal title="Edit Unproductive Apps" onClose={() => setShowEditApps(false)}>
            <UnproductiveApps />
          </Modal>
        )}
      </div>

      <div class="mb-6">
        <DeepWorkSlider />
      </div>
    </div>
  )
}

export default Settings
