import { parentPort } from 'worker_threads'
import schedule from 'node-schedule'
import axios from 'axios'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'

let currentUsername = null
let workerSiteTimeTrackers = []
let workerStore = {}

dayjs.extend(isoWeek)
dayjs.extend(weekday)

// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  console.log('Worker received message:', message)

  if (message.type === 'SET_USER_INFO') {
    const { username, firstName, lastName, country, language } = message.user
    currentUsername = username
    console.log(
      `User info received in worker: ${firstName} ${lastName} from ${country} (${language})`
    )
  }
  if (message.type === 'SET_TRACKERS') {
    workerSiteTimeTrackers = message.currentSiteTimeTrackers
    workerStore = message.storeData
    console.log('Trackers and store data set in worker')
  }
})

// Just a simple function to confirm the worker is running
setInterval(() => {
  if (currentUsername) {
    console.log('Worker is running for user:', currentUsername, 'at', dayjs().format())
  } else {
    console.log('Worker is running, but no username set yet.')
  }
}, 5000) // Log every 5 seconds to confirm the worker is alive

// Schedule daily reset at midnight
schedule.scheduleJob('0 0 * * *', () => {
  if (currentUsername) {
    console.log('Performing daily reset...')
    persistDailyData(currentUsername) // Provide the username
    parentPort.postMessage({ type: 'RESET_DAILY' }) // Inform main thread to reset
  } else {
    console.error('No username available for daily reset.')
  }
})

// Schedule weekly aggregation at the end of Sunday (midnight)
schedule.scheduleJob('0 0 * * 0', () => {
  if (currentUsername) {
    console.log('Performing weekly aggregation...')
    aggregateWeeklyData(currentUsername) // Provide the username
    parentPort.postMessage({ type: 'RESET_WEEKLY' }) // Inform main thread to reset
  } else {
    console.error('No username available for weekly aggregation.')
  }
})

async function persistDailyData(username) {
  // Get the current date in 'YYYY-MM-DD' format
  const today = dayjs().format('YYYY-MM-DD')
  console.log('Today is ', today) // This will print the current date in 'YYYY-MM-DD' format

  const dailyData = workerSiteTimeTrackers.map((tracker) => ({
    username,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent,
    date: today
  }))

  workerStore.set(`dailyData.${today}`, dailyData)
  console.log('Daily data persisted:', dailyData)

  try {
    const response = await axios.post('http://localhost:5000/api/v1/activity/persist', {
      dailyData
    })
    console.log('Daily activity data sent to backend:', response.data)
  } catch (error) {
    console.error('Error sending daily activity data to backend:', error)
  }
}

async function aggregateWeeklyData(username) {
  // Get the start of the current ISO week (Monday) and the end of the week (Sunday)
  const weekStart = dayjs().weekday(1).startOf('day').format('YYYY-MM-DD') // This gets last Sunday
  const weekEnd = dayjs().weekday(7).endOf('day').format('YYYY-MM-DD') // This gets next Saturday

  console.log(`Week start: ${weekStart}, Week end: ${weekEnd}`)

  const weeklyData = currentSiteTimeTrackers.map((tracker) => ({
    username,
    weekStart,
    weekEnd,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent
  }))

  try {
    const response = await axios.post('http://localhost:5000/api/v1/activity/aggregate-weekly', {
      weeklyData
    })
    console.log('Weekly data sent to backend:', response.data)
  } catch (error) {
    console.error('Error sending weekly data to backend:', error)
  }
}
