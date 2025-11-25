import { onMount, createSignal, createEffect, onCleanup } from 'solid-js'
import { useAuth } from './lib/AuthContext'
import User, { WindowInfo } from './types'
import CircularProgress from './CircularProgress'
import SandTimer from './SandTimer'
import dayjs from 'dayjs'
import { IpcRendererEvent } from 'electron'
import { Motion } from 'solid-motionone'
import { formatUrlForDisplay } from './lib/utils'

const Home = () => {
  const [loggedIn] = useAuth()
  const user = localStorage.getItem('user')
    ? (JSON.parse(localStorage.getItem('user') as string) as User)
    : undefined

  const [progress, setProgress] = createSignal(0)
  const [deepWorkDone, setDeepWorkDone] = createSignal(0)
  const [deepWorkTarget, setDeepWorkTarget] = createSignal(8) // Default to 8 hours
  const [activeWindowInfo, setActiveWindowInfo] = createSignal<null | WindowInfo>(null)



  // Fetch initial data and set up IPC listeners on mount
  onMount(() => {
    if (user && loggedIn()) {
      fetchDeepWorkTarget()
      fetchDeepWorkData()

      window?.electron.ipcRenderer.on('deep-work-data-response', handleDeepWorkData)
      window?.electron.ipcRenderer.on('deep-work-target-response', handleDeepWorkTarget)
      window?.electron.ipcRenderer.on('active-window-info', handleActiveWindowInfo)

      // Clean up IPC listeners on unmount
      onCleanup(() => {
        window?.electron.ipcRenderer.removeListener('deep-work-data-response', handleDeepWorkData)
        window?.electron.ipcRenderer.removeListener(
          'deep-work-target-response',
          handleDeepWorkTarget
        )
        window?.electron.ipcRenderer.removeListener('active-window-info', handleActiveWindowInfo)
      })
    } else {
      console.log('User is not logged in/Signed Up')
    }
  })

  createEffect(() => {
    console.log('Updated progress:', progress())
    console.log('Active Window Info:', activeWindowInfo())
  })

  // Handle deep work data response from IPC
  const handleDeepWorkData = (_event: IpcRendererEvent, response: number[] | { data: number[]; labels: string[] }) => {
    // Handle both old format (array) and new format (object with data and labels)
    let data: number[]

    if (Array.isArray(response)) {
      // Old format - just an array of numbers
      data = response
    } else {
      // New format - object with data and labels
      data = response.data
    }

    // Get today's data - data is always ordered MON, TUE, WED, THU, FRI, SAT, SUN
    // dayjs().day() returns 0 for Sunday, 1 for Monday, etc.
    // We need to convert: Sunday (0) -> index 6, Monday (1) -> index 0, etc.
    const todayIndex = dayjs().day() === 0 ? 6 : dayjs().day() - 1
    if (data && data.length > todayIndex) {
      const workDone = data[todayIndex]
      setDeepWorkDone(workDone)
      setProgress(workDone / deepWorkTarget()) // Calculate the progress percentage
    } else {
      console.log('No deep work data available for today.')
    }
  }

  // Handle deep work target response from IPC
  const handleDeepWorkTarget = (_event: IpcRendererEvent, target: number) => {
    setDeepWorkTarget(target)
    console.log('Deep work target updated:', target)
  }

  // Handle active window information response from IPC
  const handleActiveWindowInfo = (_event: IpcRendererEvent, windowInfo: WindowInfo) => {
    setActiveWindowInfo({
      appName: windowInfo.appName || 'Unknown App',
      URL: windowInfo.URL || 'Unknown URL',
      isProductive: windowInfo.isProductive
    })
  }

  // Fetch the deep work data
  const fetchDeepWorkData = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  // Fetch the deep work target from main process
  const fetchDeepWorkTarget = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-target')
  }

  return (
    <Motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, easing: "ease-out" }}
  >
    {/* Swiss Typography: Asymmetric layout, left-aligned, extreme whitespace */}
    <div class="flex justify-start items-start h-full flex-col p-swiss-8 space-y-swiss-12">
      {!loggedIn() || !user ? (
        <div class="w-full">
          <h1 class="mb-swiss-8 text-3xl font-extrabold tracking-tight uppercase">WELCOME TO DEEP FOCUS</h1>
          <SandTimer />
        </div>
      ) : (
        <div class="space-y-swiss-12 w-full">
          <h1 class="mb-swiss-8 text-2xl font-extrabold tracking-tight uppercase">
            {user?.firstName.toUpperCase()}'S DAILY DEEP WORK
          </h1>
          <CircularProgress progress={progress()} />
          {activeWindowInfo() ? (
            <div class="mt-swiss-10">
              <h2 class="text-xl font-bold mb-swiss-4">
                <span class="font-normal">ACTIVE TASK:</span>
                <span
                  class={activeWindowInfo().isProductive ? 'text-foreground ml-swiss-3 font-extrabold' : 'text-foreground ml-swiss-3 font-extrabold'}
                >
                  {activeWindowInfo().URL !== 'Unknown URL'
                    ? formatUrlForDisplay(activeWindowInfo().URL).toUpperCase()
                    : activeWindowInfo().appName.toUpperCase()}
                </span>
                {!activeWindowInfo().isProductive && (
                  <span class="ml-swiss-3 text-muted-foreground font-normal uppercase">(UNPRODUCTIVE)</span>
                )}
              </h2>
            </div>
          ) : (
            <div class="mt-swiss-10">
              <h2 class="text-xl font-bold">
                <span class="font-normal">ACTIVE TASK:</span>
                <span class="text-foreground ml-swiss-3 font-extrabold uppercase">NO ACTIVE TASK DETECTED</span>
              </h2>
            </div>
          )}
        </div>
      )}
    </div>
    </Motion.div>
  )
}

export default Home
