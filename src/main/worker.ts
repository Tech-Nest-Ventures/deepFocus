import { workerData, parentPort } from 'worker_threads'
import schedule from 'node-schedule'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'
import { SiteTimeTracker, DeepWorkHours, MessageType } from './types'

let currentUsername: string = ''

dayjs.extend(isoWeek)
dayjs.extend(weekday)

const API_BASE_URL = workerData.API_BASE_URL

// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  console.log('Worker received message:', message)

  if (message.type === MessageType.SET_USER_INFO) {
    const { user } = message
    currentUsername = user.username
    console.log('Username set in worker:', currentUsername)
  }

  if (message.type === MessageType.REPLY_DATA) {
    const {
      currentSiteTimeTrackers,
      deepWorkHours
    }: { currentSiteTimeTrackers: SiteTimeTracker[]; deepWorkHours: DeepWorkHours } = message.data
    persistDailyData(currentSiteTimeTrackers, deepWorkHours) // Now persist the data with the latest info
  }
})

function requestData() {
  parentPort?.postMessage({ type: MessageType.GET_DATA })
}

// Schedule daily reset at midnight
schedule.scheduleJob('0 0 19 * *', () => {
  if (currentUsername) {
    console.log('Performing daily reset...')
    requestData()
    parentPort?.postMessage({ type: MessageType.RESET_DAILY })
  } else {
    console.error('No username available for daily reset.')
  }
})

// Schedule weekly aggregation at the end of Sunday (midnight)
schedule.scheduleJob('0 19 * * 0', () => {
  if (currentUsername) {
    console.log('Performing weekly aggregation...')
    aggregateWeeklyData()
    parentPort?.postMessage({ type: MessageType.RESET_WEEKLY })
  } else {
    console.error('No username available for weekly aggregation.')
  }
})

async function persistDailyData(
  workerSiteTimeTrackers: SiteTimeTracker[],
  deepWorkHours: DeepWorkHours
) {
  if (!currentUsername || workerSiteTimeTrackers.length === 0) {
    console.log('No site time trackers found to persist.')
    return
  }

  const MIN_TIME_THRESHOLD = 60

  // Filter out sites/apps with time spent less than the threshold
  const filteredTrackers = workerSiteTimeTrackers.filter(
    (tracker) => tracker.timeSpent >= MIN_TIME_THRESHOLD * 1000 // timeSpent is in milliseconds
  )

  if (filteredTrackers.length === 0) {
    console.log('No site time trackers met the minimum time threshold to persist.')
    return
  }

  const today = dayjs().format('dddd') // Get back Monday, Tuesday, etc.

  const dailyData = filteredTrackers.map((tracker) => ({
    username: currentUsername,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent,
    date: dayjs().format('YYYY-MM-DD') // Get back 2024-09-30
  }))

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activity/persist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dailyData,
        username: currentUsername,
        deepWorkHours,
        today
      })
    })
    console.log('Response from backend:', response.status)
  } catch (error) {
    console.error('Error sending daily activity data to backend:', error)
  }
}

async function aggregateWeeklyData() {
  if (!currentUsername) {
    console.log('No site time trackers found to aggregate.')
    return
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activity/aggregate-weekly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: currentUsername
      })
    })
    console.log('Response from backend:', response.status)
  } catch (error) {
    console.error('Error sending weekly data to backend:', error)
  }
}

/*
  function getDeepWorkHours(): Promise<number> {
    const siteTimeTrackers = this.store.get('siteTimeTrackers', [])
    const unproductiveSites = this.store.get('unproductiveSites', [])

    const productiveTime = siteTimeTrackers
      .filter((tracker) => !unproductiveSites?.includes(tracker.url))
      .reduce((total, tracker) => total + tracker.timeSpent, 0)

    // Convert ms to hours and return rounded to 1 decimal place
    return parseFloat((productiveTime / (1000 * 60 * 60)).toFixed(1))
  }

   async function getTopSites(): Promise<TopSite[]> {
    const siteTimeTrackers = this.store.get('siteTimeTrackers', [])

    const getTrimmedTitle = (title: string): string => {
      const maxLength = 50
      return title.length > maxLength ? title.slice(0, maxLength) + '...' : title
    }

    // Filter out trackers with zero time, then sort and slice to get top 3
    const topSites = siteTimeTrackers
      .filter((tracker) => tracker.timeSpent > 0)
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .slice(0, 3) // Get top 3
      .map((tracker) => ({
        url: tracker.url || getTrimmedTitle(tracker.title || 'Unknown Title'),
        timeSpent: formatTime(Math.round(tracker.timeSpent / (1000 * 60))) // Convert to minutes and format
      }))

    return topSites
  }
*/
