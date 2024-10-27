import { workerData, parentPort } from 'worker_threads'
import { MessageType, SiteTimeTracker, DeepWorkHours } from './types'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'
import log from 'electron-log/node.js'
import schedule from 'node-schedule'

let currentUsername = ''

dayjs.extend(isoWeek)
dayjs.extend(weekday)
log.info(currentUsername, dayjs().format('dddd'))

const API_BASE_URL = workerData.API_BASE_URL
// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  log.info('Worker received message:', message)

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
    log.info('Persisting daily data...')
    persistDailyData(currentSiteTimeTrackers, deepWorkHours)
  }
})

function requestData() {
  parentPort?.postMessage({ type: MessageType.GET_DATA })
}

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
    (tracker) => tracker.timeSpent >= MIN_TIME_THRESHOLD
  )

  if (filteredTrackers.length === 0) {
    console.log('No site time trackers met the minimum time threshold to persist.')
    return
  }
  console.log('Sending data to backend')
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
