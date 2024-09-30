import { workerData, parentPort } from 'worker_threads'
import schedule from 'node-schedule'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import weekday from 'dayjs/plugin/weekday.js'
import { SiteTimeTracker, DeepWorkHours, FocusInterval, MessageType } from './types'

let currentUsername: string = ''

dayjs.extend(isoWeek)
dayjs.extend(weekday)

const API_BASE_URL = workerData.API_BASE_URL

function updateDeepWorkHours(siteTrackers: SiteTimeTracker[], deepWorkHours: DeepWorkHours) {
  const today = dayjs().format('dddd')
  const focusIntervals: FocusInterval[] = []

  siteTrackers.forEach((tracker) => {
    if (tracker) {
      focusIntervals.push({
        start: tracker.lastActiveTimestamp - tracker.timeSpent,
        end: tracker.lastActiveTimestamp
      })
    }
  })

  const mergedIntervals = mergeOverlappingIntervals(focusIntervals)

  const totalDeepWorkTime = mergedIntervals.reduce((acc, interval) => {
    return acc + (interval.end - interval.start)
  }, 0)

  const timeSpentInHours = totalDeepWorkTime / (1000 * 60 * 60)
  deepWorkHours[today] = parseFloat(timeSpentInHours.toFixed(2))

  console.log(`Deep work hours for ${today}: ${deepWorkHours[today]} hours`)
  return deepWorkHours
}

//TODO: Add when logic is added in frontend +  Determine if current activity is considered deep work
function isDeepWork(windowInfo) {
  // You can customize this condition based on specific apps, sites, or window titles
  // Check if the tracker is a deep work app (e.g., VSCode, GitHub, etc.)

  const deepWorkSites = [
    'vscode',
    'settings',
    'notion',
    'https://github.com',
    'https://chatgpt.com'
  ]
  return deepWorkSites.includes(windowInfo?.title?.toLowerCase())
}

// Listen for messages from the main thread
parentPort?.on('message', (message) => {
  console.log('Worker received message:', message)

  if (message.type === MessageType.SET_USER_INFO) {
    const { user } = message
    currentUsername = user.username
    console.log('Username set in worker:', currentUsername)
  }

  if (message.type === MessageType.UPDATE_DATA) {
    const { deepWorkHours, currentSiteTimeTrackers } = message.data
    const hoursSoFar = updateDeepWorkHours(currentSiteTimeTrackers, deepWorkHours)
    parentPort?.postMessage({ type: MessageType.UPDATE_DATA, data: hoursSoFar })
    console.log('hoursSoFar', hoursSoFar)
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

  const today = dayjs().format('dddd') // Get back Monday, Tuesday, etc.
  const dailyData: {
    username: string
    url: string
    title: string
    timeSpent: number
    date: string
  }[] = workerSiteTimeTrackers.map((tracker) => ({
    username: currentUsername,
    url: tracker.url,
    title: tracker.title,
    timeSpent: tracker.timeSpent,
    date: dayjs().format('YYYY-MM-DD') // Get back 2023-09-27
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

// Function to merge overlapping time intervals
function mergeOverlappingIntervals(intervals: FocusInterval[]) {
  if (!intervals.length) return []

  // Sort intervals by the start time
  intervals.sort((a, b) => a.start - b.start)

  const mergedIntervals = [intervals[0]]

  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i]
    const lastMerged = mergedIntervals[mergedIntervals.length - 1]

    // If intervals overlap, merge them
    if (current.start <= lastMerged.end) {
      lastMerged.end = Math.max(lastMerged.end, current.end)
    } else {
      // Otherwise, add the current interval
      mergedIntervals.push(current)
    }
  }

  return mergedIntervals
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
