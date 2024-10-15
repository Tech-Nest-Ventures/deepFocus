import { SiteTimeTracker, DeepWorkHours } from '../src/main/types'
import dayjs from 'dayjs'

export function generateLargeFakeData(
  day: string,
  hoursActive: number = 8
): { trackers: SiteTimeTracker[]; deepWork: DeepWorkHours } {
  const now = dayjs(day).unix() // Convert day to a timestamp
  const trackers: SiteTimeTracker[] = []
  const deepWork: DeepWorkHours = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0
  }

  // Generate data for multiple apps/sites with varying time spent
  for (let i = 0; i < 50; i++) {
    trackers.push({
      url: `/Applications/App${i}.app`,
      title: `App${i}`,
      timeSpent: hoursActive * 60 * (i + 1), // Varying time spent on each app
      lastActiveTimestamp: now - hoursActive * 60 * i
    })
  }

  // Simulate deep work for that day
  deepWork[dayjs(day).format('dddd')] = hoursActive

  return { trackers, deepWork }
}
