import { onMount, createSignal, createEffect, onCleanup } from 'solid-js'
import { useAuth } from './lib/AuthContext'
import User from './types'
import CircularProgress from './CircularProgress'
import SandTimer from './SandTimer'
import dayjs from 'dayjs'

const Home = () => {
  const [loggedIn, setIsLoggedIn] = useAuth()
  const user = localStorage.getItem('user')
    ? (JSON.parse(localStorage.getItem('user')) as User)
    : undefined
  const [progress, setProgress] = createSignal(0)
  const [deepWorkDone, setDeepWorkDone] = createSignal(0)
  const [activeWindowInfo, setActiveWindowInfo] = createSignal(null) // New state to track active window info

  onMount(() => {
    if (user) {
      fetchDeepWorkData()
      window?.electron.ipcRenderer.on('deep-work-data-response', handleDataResponse)

      // Add the listener for active window info
      window?.electron?.ipcRenderer.on('active-window-info', handleActiveWindowInfo)

      onCleanup(() => {
        window?.electron.ipcRenderer.removeListener('deep-work-data-response', handleDataResponse)

        // Clean up the listener for active window info
        window?.electron?.ipcRenderer.removeListener('active-window-info', handleActiveWindowInfo)
      })
    } else {
      console.log('User is not logged in/Signed Up')
      return
    }
  })

  createEffect(() => {
    console.log('Updated progress:', progress())
    console.log("Updated windowInfo:", activeWindowInfo())
  })

  // New function to handle active window info
  const handleActiveWindowInfo = (event, windowInfo) => {
    console.log('Active window info:', windowInfo)
    if(windowInfo.URL !== '' ) {
    setActiveWindowInfo(windowInfo.URL) 
  } else if(windowInfo.tracker.title !== '') {
    setActiveWindowInfo(windowInfo.tracker.title) 
  }
}

  const fetchDeepWorkData = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  const handleDataResponse = (event, data) => {
    const todayIndex = dayjs().day() === 0 ? 7 : dayjs().day()
    const dataIndex = todayIndex - 1
    console.log(todayIndex)
    if (data && data.length) {
      console.log('dataIndex is ', dataIndex, 'data is ', data)
      const workDone = data[dataIndex]
      setDeepWorkDone(workDone)
      const dailyTarget = 4
      console.log('workDone', workDone)
      setProgress(workDone / dailyTarget)
    } else {
      console.log('No data found for deep work hours.')
    }
  }

  return (
    <div class="flex justify-center items-center h-screen flex-col space-y-8">
      {!loggedIn() && !user ? (
        <div>
          <h1 class="mb-10 text-lg">Welcome to Deep Focus</h1>
        </div>
      ) : (
        <div class="space-y-8">
          <h1 class="mb-10 text-lg">Welcome back {user?.firstName}!</h1>
          <div class="space-y-8">
            <CircularProgress progress={progress()} />
            <p class="italic">Tip: Take a break every 50 minutes to improve efficiency!</p>
          </div>
          {activeWindowInfo() && ( // Display the active window info if available
            <div class="mt-8">
              <h2>Active Window: {activeWindowInfo()}</h2>
            </div>
          )}
        </div>
      )}
      {!loggedIn() && <SandTimer />}
    </div>
  )
}

export default Home
