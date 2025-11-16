import { createSignal, onMount, onCleanup, lazy } from 'solid-js'
import { Button } from './components/ui/button'
import { SiteTimeTracker, TrackerType, AppIcon } from './types'
const BarChart = lazy(() => import('./BarChart'))
import { IpcRendererEvent } from 'electron'
import {Motion} from 'solid-motionone';
import { getFavicon } from './lib/utils'

const Analytics = () => {
  const [showDeepWork, setShowDeepWork] = createSignal(true) // State for toggle
  const [siteTrackers, setSiteTrackers] = createSignal([])
  const [iconCache, setIconCache] = createSignal({}) 
  const [apps, setApps] = createSignal<AppIcon[]>([])


  // Function to fetch the icon data URL
  const fetchAppIcon = async (iconPath?: string): Promise<string> => {
    try {
      const iconDataUrl = await window.electron.ipcRenderer.invoke('get-icon', iconPath)
      const iconUrl = iconDataUrl || 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'
      // Cache the fetched icon
      setIconCache({ ...iconCache(), [iconPath]: iconUrl })
      return iconUrl
    } catch (error) {
      console.error('Error fetching app icon:', error)
      return 'https://cdn-icons-png.freepik.com/512/7022/7022186.png' // Return default icon on error
    }
  }

  const fetchSiteTrackers = () => {
    window?.electron?.ipcRenderer.send('fetch-site-trackers')
  }

  const handleSiteTrackersResponse = async (_event: IpcRendererEvent, trackers: SiteTimeTracker[]) => {
    if (!trackers || !Array.isArray(trackers)) {
      console.error('Invalid trackers data received:', trackers)
      return
    }
    console.log('trackers', trackers)
    const trackersWithIcons = await Promise.all(
      trackers.map(async (tracker) => {
        // Ensure tracker is defined and has the necessary properties
        if (!tracker) {
          console.warn('Skipping invalid tracker:', tracker)
          return null
        }

        let iconUrl = ''

        if (tracker.type === TrackerType.Website) {
          // Fetch the favicon for websites
          iconUrl = getFavicon(tracker.url)
        } else if (tracker.type === TrackerType.App && tracker.iconUrl) {
          // If tracker has a valid iconPath, fetch the app icon
          iconUrl = await fetchAppIcon(tracker.iconUrl)
        } else {
          // Fallback to a default icon for apps without a valid iconPath
          iconUrl = 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'
        }
  
        return {
          ...tracker,
          iconUrl
        }
      })
    )
  
    setSiteTrackers(trackersWithIcons)
  }
  

  onMount(() => {
    fetchSiteTrackers()
    window.electron.ipcRenderer.send('fetch-app-icons')
    window.electron.ipcRenderer.on('app-icons-response', async (_event, appData: AppIcon[]) => {
      const sortedApps = appData.sort((a, b) => a.appName.localeCompare(b.appName))

      const appsWithIcons = await Promise.all(
        sortedApps.map(async (app) => ({
          ...app,
          iconPath: await fetchAppIcon(app.iconPath) // Fetch icon and update iconPath with base64 data URL
        }))
      )

      console.log('Apps with icons:', appsWithIcons)
      setApps(appsWithIcons)
    })

    window?.electron?.ipcRenderer.on('site-trackers-response', handleSiteTrackersResponse)

    onCleanup(() => {
      window?.electron?.ipcRenderer.removeAllListeners('site-trackers-response')
      window.electron.ipcRenderer.removeAllListeners('app-icons-response')

    })
  })

  return (
    <Motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, easing: "ease-out" }}
  >
    {/* Swiss Typography: Left-aligned, grid-based layout, extreme whitespace */}
    <div class="p-swiss-10">
      <div class="flex justify-start items-center mb-swiss-10">
        <Button variant="outline" size="sm" onClick={() => setShowDeepWork(!showDeepWork())}>
          {showDeepWork() ? 'SHOW TOP SITES' : 'SHOW DEEP WORK HOURS'}
        </Button>
      </div>
      {showDeepWork() ? (
        <BarChart />
      ) : (
        <div class="space-y-swiss-6">
          {siteTrackers().length > 0 ? (
            siteTrackers().map((tracker: SiteTimeTracker) => (
              <div class="flex items-center space-x-swiss-6 border-b-2 border-foreground pb-swiss-6">
                <img src={tracker.iconUrl} alt="icon" class="w-12 h-12" />
                <div>
                  <p class="text-lg font-bold uppercase tracking-tight mb-swiss-2">{tracker.title.toUpperCase()}</p>
                  <p class="text-lg font-extrabold mt-swiss-2 font-mono">{Math.round(tracker.timeSpent / 60)} MINS</p>
                  <p class="text-sm font-normal text-muted-foreground mt-swiss-2 uppercase">{tracker.type === TrackerType.Website ? 'WEBSITE' : 'APP'}</p>
                </div>
              </div>
            ))
          ) : (
            <p class="text-xl font-extrabold uppercase">NO DATA AVAILABLE</p>
          )}
        </div>
      )}
    </div>
    </Motion.div>
  )
}

export default Analytics
