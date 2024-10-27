import { onMount, createSignal, createEffect, onCleanup } from 'solid-js'
import { useAuth } from './lib/AuthContext'
import User, { WindowInfo } from './types'
import CircularProgress from './CircularProgress'
import SandTimer from './SandTimer'
import dayjs from 'dayjs'
import { IpcRendererEvent } from 'electron'

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
  const handleDeepWorkData = (_event: IpcRendererEvent, data: number[]) => {
    const todayIndex = dayjs().day() === 0 ? 7 : dayjs().day()
    const dataIndex = todayIndex - 1
    if (data && data.length > dataIndex) {
      const workDone = data[dataIndex]
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
    <div class="flex justify-center items-center h-screen flex-col space-y-8">
      {!loggedIn() || !user ? (
        <div>
          <h1 class="mb-10 text-2xl font-light">Welcome to Deep Focus</h1>
          <SandTimer />
        </div>
      ) : (
        <div class="space-y-8">
          <h1 class="mb-10 text-2xl font-thin">
            {user?.firstName.toLowerCase()}'s daily deep work
          </h1>
          <CircularProgress progress={progress()} />
          {activeWindowInfo() ? (
            <div class="mt-8">
              <h2>
                <span class="font-light">Active Task: </span>
                <span
                  class={activeWindowInfo().isProductive ? 'text-green-500' : 'text-red-500 ml-2'}
                >
                  {activeWindowInfo().URL !== 'Unknown URL'
                    ? activeWindowInfo().URL
                    : activeWindowInfo().appName}
                </span>
                {!activeWindowInfo().isProductive && (
                  <span class="ml-2 italic text-gray-500">(Unproductive)</span>
                )}
              </h2>
            </div>
          ) : (
            <div class="mt-8">
              <h2>
                <span>Active Task:</span>
                <span class="text-red-500 ml-2">No active task detected</span>
              </h2>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Home
