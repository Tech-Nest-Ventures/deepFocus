import { parentPort } from 'worker_threads'
import schedule from 'node-schedule'
import axios from 'axios'
import { currentSiteTimeTrackers, saveSiteTimeTrackers, store } from '.'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'


let currentUsername = null // Store the username globally

dayjs.extend(isoWeek)
dayjs.extend(weekday)

// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  if (message.type === 'SET_USERNAME') {
    console.log('message received from main thread', message.type)
    currentUsername = message.username
  }
})

// Schedule daily reset at midnight
schedule.scheduleJob('0 0 * * *', () => {
  if (currentUsername) {
    console.log('Performing daily reset...')
    persistDailyData(currentUsername) // Provide the username
    resetDailyCounters() // Still locally resetting
  } else {
    console.error('No username available for daily reset.')
  }
})

// Schedule weekly aggregation at the end of Sunday (midnight)
schedule.scheduleJob('0 0 * * 0', () => {
  if (currentUsername) {
    console.log('Performing weekly aggregation...')
    aggregateWeeklyData(currentUsername) // Provide the username
    resetWeeklyData() // Still locally resetting weekly data
  } else {
    console.error('No username available for weekly aggregation.')
  }
})

async function persistDailyData(username) {
  // Get the current date in 'YYYY-MM-DD' format
  const today = dayjs().format('YYYY-MM-DD')
  console.log('Today is ', today) // This will print the current date in 'YYYY-MM-DD' format

  const dailyData = currentSiteTimeTrackers.map((tracker) => ({
    username,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent,
    date: today
  }))

  // Save the daily data to electron-store (locally)
  store.set(`dailyData.${today}`, dailyData)
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

function resetDailyCounters() {
  currentSiteTimeTrackers.forEach((tracker) => {
    tracker.timeSpent = 0 // Reset time spent on each site
  })
  saveSiteTimeTrackers()
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

function resetWeeklyData() {
  currentSiteTimeTrackers.length = 0
  saveSiteTimeTrackers() // Clear the trackers for a new week
}
