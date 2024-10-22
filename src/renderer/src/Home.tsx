import { onMount, createSignal, createEffect, onCleanup } from 'solid-js'
import { useAuth } from './lib/AuthContext'
import User from './types'
import CircularProgress from './CircularProgress'
import SandTimer from './SandTimer'
import dayjs from 'dayjs'
import { WindowInfo } from './types'

const Home = () => {
  const [loggedIn, _setIsLoggedIn] = useAuth()
  const user = localStorage.getItem('user')
    ? (JSON.parse(localStorage.getItem('user') as string) as User)
    : undefined

  const [progress, setProgress] = createSignal(0)
  const [_deepWorkDone, setDeepWorkDone] = createSignal(0)
  const [deepWorkTarget, setDeepWorkTarget] = createSignal(8) // Default to 8 until fetched
  const [activeWindowInfo, setActiveWindowInfo] = createSignal<null | WindowInfo>(null) // New state to track active window info

  onMount(() => {
    if (user && loggedIn()) {
      fetchDeepWorkTarget()
      fetchDeepWorkData()

      window?.electron.ipcRenderer.on('deep-work-data-response', handleDeepWorkData)
      window?.electron.ipcRenderer.on('deep-work-target-response', handleDeepWorkTarget)

      window?.electron?.ipcRenderer.on('active-window-info', handleActiveWindowInfo)

      onCleanup(() => {
        window?.electron.ipcRenderer.removeListener('deep-work-data-response', handleDeepWorkData)
        window?.electron.ipcRenderer.removeListener(
          'deep-work-target-response',
          handleDeepWorkTarget
        )
        window?.electron?.ipcRenderer.removeListener('active-window-info', handleActiveWindowInfo)
      })
    } else {
      console.log('User is not logged in/Signed Up')
      return
    }
  })

  createEffect(() => {
    console.log('Updated progress:', progress())
    console.log('Updated windowInfo:', activeWindowInfo())
    console.log('Updated loggedIn:', loggedIn())
  })

  // Handle the active window info with isProductive
  const handleActiveWindowInfo = (_event, windowInfo: WindowInfo) => {
    console.log('Active window info:', windowInfo)
    if (windowInfo) {
      setActiveWindowInfo({
        appName: windowInfo.appName || 'Unknown App',
        URL: windowInfo.URL || 'Unknown URL',
        isProductive: windowInfo.isProductive
      })
    }
  }

  const fetchDeepWorkData = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  const handleDeepWorkData = (_event, data) => {
    const todayIndex = dayjs().day() === 0 ? 7 : dayjs().day()
    const dataIndex = todayIndex - 1
    console.log(todayIndex)
    if (data && data.length) {
      const workDone = data[dataIndex]
      setDeepWorkDone(workDone)
      console.log('workDone', workDone)
      setProgress(workDone / deepWorkTarget())
    } else {
      console.log('No data found for deep work hours.')
    }
  }

  // Fetch the deep work target from the main process
  const fetchDeepWorkTarget = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-target')
  }

  const handleDeepWorkTarget = (_event, target) => {
    setDeepWorkTarget(target) // Update the target in the signal
    console.log('Fetched deep work target: ', target)
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
          <div class="space-y-8">
            <CircularProgress progress={progress()} />
          </div>
          {activeWindowInfo() ? (
            <div class="mt-8">
              <h2>
                <span class="font-light">Active Task: </span>
                <span
                  class={activeWindowInfo()?.isProductive ? 'text-green-500' : 'text-red-500 ml-2'}
                >
                  {activeWindowInfo()?.URL !== 'Unknown URL'
                    ? activeWindowInfo()?.URL
                    : activeWindowInfo()?.appName}
                </span>
                {!activeWindowInfo()?.isProductive && (
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
