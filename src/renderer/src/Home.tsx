import { onMount, createSignal, onCleanup, createEffect } from 'solid-js'
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

  onMount(() => {
    if (user) {
      fetchDeepWorkData()
      window?.electron.ipcRenderer.on('deep-work-data-response', handleDataResponse)

      // Cleanup the listener properly using onCleanup inside onMount
      return () => {
        window?.electron?.ipcRenderer.removeListener('deep-work-data-response', handleDataResponse)
      }
    } else {
      console.log('User is not logged in/Signed Up')
      return
    }
  })

  createEffect(() => {
    console.log('Updated progress:', progress())
  })

  const fetchDeepWorkData = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  const handleDataResponse = (event, data) => {
    const todayIndex = dayjs().day() - 1 // dayjs starts at 1
    if (data && data.length) {
      const workDone = data[todayIndex]
      setDeepWorkDone(workDone)
      const dailyTarget = 4
      console.log('deepWorkDone', workDone)
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
        <div class=" space-y-8">
          <h1 class="mb-10 text-lg">Welcome back {user?.firstName}!</h1>
          <div class="space-y-8">
            <CircularProgress progress={progress()} />
            <p class="italic">Tip: Take a break every 50 minutes to improve efficiency!</p>
          </div>
        </div>
      )}
      {!loggedIn() && <SandTimer />}
    </div>
  )
}

export default Home
