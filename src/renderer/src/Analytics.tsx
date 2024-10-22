import { createSignal, onMount, onCleanup, lazy } from 'solid-js'
import { Button } from './components/ui/button'
import { SiteTimeTracker } from './types'
const BarChart = lazy(() => import('./BarChart'))

const Analytics = () => {
  const [showDeepWork, setShowDeepWork] = createSignal(true) // State for toggle
  const [siteTrackers, setSiteTrackers] = createSignal([])

  const fetchSiteTrackers = () => {
    window?.electron?.ipcRenderer.send('fetch-site-trackers')
  }

  const handleSiteTrackersResponse = (_event, trackers) => {
    setSiteTrackers(trackers)
  }

  onMount(() => {
    fetchSiteTrackers()

    window?.electron?.ipcRenderer.on('site-trackers-response', handleSiteTrackersResponse)

    onCleanup(() => {
      window?.electron?.ipcRenderer.removeListener(
        'site-trackers-response',
        handleSiteTrackersResponse
      )
    })
  })

  return (
    <div>
      <div class="flex justify-between items-center p-4">
        <Button onClick={() => setShowDeepWork(!showDeepWork())}>
          {showDeepWork() ? 'Show Top Sites' : 'Show Deep Work Hours'}
        </Button>
      </div>
      {showDeepWork() ? (
        <BarChart />
      ) : (
        <div class="space-y-4">
          {siteTrackers().length > 0 ? (
            siteTrackers().map((tracker: SiteTimeTracker) => (
              <div class="flex items-center space-x-4">
                <img src={tracker?.iconUrl} alt="icon" class="w-8 h-8" />
                <div>
                  <p class="text-white">{tracker.title}</p>
                  <p class="text-gray-400">{Math.round(tracker.timeSpent / 60)} mins</p>
                </div>
              </div>
            ))
          ) : (
            <p>No data available.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default Analytics
