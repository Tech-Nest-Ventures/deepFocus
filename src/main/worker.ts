import { workerData, parentPort } from 'worker_threads'

import schedule from 'node-schedule'
import axios from 'axios'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'
import { SiteTimeTracker } from './types'

let currentUsername: string | null = null
let workerSiteTimeTrackers: SiteTimeTracker[] = []
let deepWorkHours = {
  Monday: 0,
  Tuesday: 0,
  Wednesday: 0,
  Thursday: 0,
  Friday: 0,
  Saturday: 0,
  Sunday: 0
}

dayjs.extend(isoWeek)
dayjs.extend(weekday)

const API_BASE_URL = workerData.API_BASE_URL

console.log(`API_BASE_URL is ${API_BASE_URL}`)

function updateDeepWorkHours(siteTrackers: SiteTimeTracker[]) {
  const today = dayjs().format('dddd') // Get the current day of the week (e.g., Monday, Tuesday)
  console.log('today is ', today)
  // Calculate total deep work time spent for today
  let totalDeepWorkTime = 0

  siteTrackers.forEach((tracker) => {
    if (isDeepWork(tracker.title)) {
      totalDeepWorkTime += tracker.timeSpent
    }
  })

  // Convert time from milliseconds to hours and update deep work hours for today
  deepWorkHours[today] += totalDeepWorkTime / (1000 * 60 * 60) // Convert ms to hours
  console.log(`Deep work hours for ${today}: ${deepWorkHours[today]} hours`)
  return deepWorkHours[today]
}

// Determine if current activity is considered deep work
function isDeepWork(windowInfo) {
  // You can customize this condition based on specific apps, sites, or window titles
  const deepWorkSites = ['vscode', 'notion', 'github'] // Example: deep work occurs in these apps
  return deepWorkSites.includes(windowInfo?.title?.toLowerCase())
}

// Function to reset daily counters
function resetDailyCounters() {
  workerSiteTimeTrackers?.forEach((tracker) => {
    tracker.timeSpent = 0
    tracker.lastActiveTimestamp = Date.now()
  })
  console.log('Daily counters reset')
  // Reset deep work hours
  const today = dayjs().format('dddd')
  deepWorkHours[today] = 0
}

function resetWeeklyData() {
  workerSiteTimeTrackers.length = 0
  console.log('Weekly data reset')
}

// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  console.log('Worker received message:', message)

  if (message.type === 'SET_USER_INFO') {
    const { user, currentSiteTimeTrackers } = message
    currentUsername = user.username
    workerSiteTimeTrackers = currentSiteTimeTrackers
    console.log('Username and trackers set in worker:', currentUsername)
  }

  if (message.type === 'RESET_DAILY') {
    console.log('Performing daily reset triggered by missed reset check.')
    persistDailyData()
    resetDailyCounters()
  }
  if (message.type === 'STORE_DATA') {
    console.log('messageData', message.data)
    const hoursSoFar = updateDeepWorkHours(message.data)
    parentPort?.postMessage({ type: 'STORE_DATA', data: hoursSoFar })
    console.log('hoursSoFar', hoursSoFar)
  }
})

// Just a simple function to confirm the worker is running
setInterval(() => {
  if (currentUsername) {
    console.log('Worker is running for user:', currentUsername, 'at', dayjs().format())
  } else {
    console.log('Worker is running, but no username set yet.')
  }
}, 120000)

// Schedule daily reset at midnight
schedule.scheduleJob('0 0 * * *', () => {
  if (currentUsername) {
    console.log('Performing daily reset...')
    persistDailyData()
    parentPort?.postMessage({ type: 'RESET_DAILY' })
  } else {
    console.error('No username available for daily reset.')
  }
})

// Schedule weekly aggregation at the end of Sunday (midnight)
schedule.scheduleJob('0 0 * * 0', () => {
  if (currentUsername) {
    console.log('Performing weekly aggregation...')
    aggregateWeeklyData()
    parentPort?.postMessage({ type: 'RESET_WEEKLY' })
    resetWeeklyData()
  } else {
    console.error('No username available for weekly aggregation.')
  }
})

async function persistDailyData() {
  if (!currentUsername || workerSiteTimeTrackers.length === 0) {
    console.log('No site time trackers found to persist.')
    return
  }

  const today = dayjs().format('YYYY-MM-DD')
  const dailyData = workerSiteTimeTrackers.map((tracker) => ({
    username: currentUsername,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent,
    date: today
  }))

  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/activity/persist`, {
      dailyData
    })
    console.log('Daily activity data sent to backend:', response.data)
  } catch (error) {
    console.error('Error sending daily activity data to backend:', error)
  }
}

async function aggregateWeeklyData() {
  if (!currentUsername || workerSiteTimeTrackers.length === 0) {
    console.log('No site time trackers found to aggregate.')
    return
  }

  const weekStart = dayjs().weekday(1).startOf('day').format('YYYY-MM-DD')
  const weekEnd = dayjs().weekday(7).endOf('day').format('YYYY-MM-DD')

  console.log(`Week start: ${weekStart}, Week end: ${weekEnd}`)

  const weeklyData = workerSiteTimeTrackers.map((tracker) => ({
    username: currentUsername,
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
