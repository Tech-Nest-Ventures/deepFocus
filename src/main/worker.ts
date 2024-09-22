import { parentPort } from 'worker_threads'
import schedule from 'node-schedule'
import axios from 'axios'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'
import { SiteTimeTracker, TypedStore } from './types'
import { API_BASE_URL } from './config'

let currentUsername = null
let workerSiteTimeTrackers: SiteTimeTracker[] = []
let workerStore = {} as TypedStore

dayjs.extend(isoWeek)
dayjs.extend(weekday)

function resetDailyCounters() {
  workerSiteTimeTrackers?.forEach((tracker) => {
    tracker.timeSpent = 0
  })
  console.log('Daily counters reset')
}

function resetWeeklyData() {
  workerSiteTimeTrackers.length = 0
  console.log('Weekly data reset')
}

// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  console.log('Worker received message:', message)

  if (message.type === 'SET_USER_INFO') {
    const { user, currentSiteTimeTrackers: trackers } = message
    currentUsername = user.username
    workerSiteTimeTrackers = trackers
    console.log('Username and trackers set in worker:', currentUsername)
  }
  if (message.type === 'SET_TRACKERS') {
    workerSiteTimeTrackers = message.currentSiteTimeTrackers
    workerStore = message.storeData
    console.log('Trackers and store data set in worker')
  }
  if (message.type === 'RESET_DAILY') {
    console.log('Performing daily reset triggered by missed reset check.')
    persistDailyData(message.username)
    resetDailyCounters()
  }
})

// Just a simple function to confirm the worker is running
setInterval(() => {
  if (currentUsername) {
    console.log('Worker is running for user:', currentUsername, 'at', dayjs().format())
  } else {
    console.log('Worker is running, but no username set yet.')
  }
}, 30000) // Log every 30 seconds to confirm the worker is alive

// Schedule daily reset at midnight
schedule.scheduleJob('0 0 * * *', () => {
  if (currentUsername) {
    console.log('Performing daily reset...')
    persistDailyData(currentUsername) // Provide the username
    parentPort?.postMessage({ type: 'RESET_DAILY' }) // Inform main thread to reset
  } else {
    console.error('No username available for daily reset.')
  }
})

// Schedule weekly aggregation at the end of Sunday (midnight)
schedule.scheduleJob('0 0 * * 0', () => {
  if (currentUsername) {
    console.log('Performing weekly aggregation...')
    aggregateWeeklyData(currentUsername) // Provide the username
    parentPort?.postMessage({ type: 'RESET_WEEKLY' }) // Inform main thread to reset
    resetWeeklyData()
  } else {
    console.error('No username available for weekly aggregation.')
  }
})

async function persistDailyData(username) {
  const today = dayjs().format('YYYY-MM-DD')
  const lastResetDate = workerStore.get('lastResetDate')

  if (lastResetDate !== today) {
    const dailyData = workerSiteTimeTrackers.map((tracker) => ({
      username,
      url: tracker.url,
      title: tracker.title,
      timeSpent: tracker.timeSpent,
      date: today
    }))

    // Persist data in store
    workerStore.set(`dailyData.${today}`, dailyData)
    workerStore.set('lastResetDate', today) // Store the last reset date
    console.log('Daily data persisted:', dailyData)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/activity/persist`, {
        dailyData
      })
      console.log('Daily activity data sent to backend:', response.data)
    } catch (error) {
      console.error('Error sending daily activity data to backend:', error)
    }
  } else {
    console.log('Daily reset has already been performed today.')
  }
}

async function aggregateWeeklyData(username) {
  // Get the start of the current ISO week (Monday) and the end of the week (Sunday)
  const weekStart = dayjs().weekday(1).startOf('day').format('YYYY-MM-DD') // This gets last Sunday
  const weekEnd = dayjs().weekday(7).endOf('day').format('YYYY-MM-DD') // This gets next Saturday

  console.log(`Week start: ${weekStart}, Week end: ${weekEnd}`)

  const weeklyData = workerSiteTimeTrackers.map((tracker) => ({
    username,
    weekStart,
    weekEnd,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent
  }))

  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/activity/aggregate-weekly`, {
      weeklyData
    })
    console.log('Weekly data sent to backend:', response.data)
  } catch (error) {
    console.error('Error sending weekly data to backend:', error)
  }
}
