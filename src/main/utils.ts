import dayjs from 'dayjs'
import { SiteTimeTracker, DeepWorkHours } from './types'

export function resetCounters(
  type: 'daily' | 'weekly',
  store: any,
  siteTrackers: SiteTimeTracker[],
  deepWorkHours: DeepWorkHours
) {
  const now = dayjs()
  if (type === 'daily') {
    siteTrackers.forEach((tracker) => {
      tracker.timeSpent = 0
      tracker.lastActiveTimestamp = 0
    })
    store.set('lastResetDate', dayjs().format('YYYY-MM-DD'))
    deepWorkHours[now.format('dddd')] = 0
    store.set('deepWorkHours', deepWorkHours)
    store.set('siteTimeTrackers', siteTrackers)
  } else if (type === 'weekly') {
    siteTrackers = []
    store.set('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    })
    store.set('siteTimeTrackers', [])
  }
}
