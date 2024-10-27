import { createSignal, onMount, onCleanup, lazy } from 'solid-js'
import { Button } from './components/ui/button'
import { SiteTimeTracker, TrackerType, AppIcon } from './types'
const BarChart = lazy(() => import('./BarChart'))
import { IpcRendererEvent } from 'electron'

const Analytics = () => {
  const [showDeepWork, setShowDeepWork] = createSignal(true) // State for toggle
  const [siteTrackers, setSiteTrackers] = createSignal([])
  const [iconCache, setIconCache] = createSignal({}) 
  const [apps, setApps] = createSignal<AppIcon[]>([])


  // Function to fetch the icon data URL
  const fetchAppIcon = async (iconPath?: string) => {
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

  // Function to fetch the favicon for websites
  const fetchFavicon = (url: string) => {
    return `https://www.google.com/s2/favicons?sz=64&domain=${new URL(url).hostname}`
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
          iconUrl = fetchFavicon(tracker.url)
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
                <img src={tracker.iconUrl} alt="icon" class="w-8 h-8" />
                <div>
                  <p class="text-white">{tracker.title}</p>
                  <p class="text-gray-400">{Math.round(tracker.timeSpent / 60)} mins</p>
                  <p class="text-sm italic text-gray-500">{tracker.type === TrackerType.Website ? 'Website' : 'App'}</p>
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
