import { expect, vi, describe, beforeEach, afterEach, it } from 'vitest'
import { generateLargeFakeData } from '../scripts/generateFakeData'
import { DeepWorkHours, StoreSchema } from '../src/main/types'
import dayjs from 'dayjs'
import { resetCounters } from '../src/main/utils'

vi.mock('electron-store', () => {
  const storeData = new Map()
  return {
    default: class {
      get(key: string, defaultValue: any) {
        return storeData.has(key) ? storeData.get(key) : defaultValue
      }
      set(key: string, value: any) {
        storeData.set(key, value)
      }
      clear() {
        storeData.clear()
      }
      delete(key: string) {
        storeData.delete(key)
      }
    }
  }
})

describe('Test Day Reset Logic', () => {
  let clock: ReturnType<typeof vi.useFakeTimers>
  let store: any

  beforeEach(async () => {
    // Use fake timers to simulate specific dates
    clock = vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-10-07T00:00:00').getTime())
    // Create a new store mock for each test
    const Store = (await import('electron-store')).default
    store = new Store<StoreSchema>()
  })

  afterEach(() => {
    // Restore original timers
    clock.useRealTimers()
  })

  it('should populate a full day of data and reset on the next day', () => {
    // Generate large fake data for the test date
    const { trackers, deepWork } = generateLargeFakeData('2024-10-07', 8)

    // Set data in the store
    store.set('siteTimeTrackers', trackers)
    store.set('deepWorkHours', deepWork)

    // Check if the data is stored correctly
    const savedTrackers = store.get('siteTimeTrackers', [])
    expect(savedTrackers).toHaveLength(50)

    const savedDeepWork = store.get('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    }) as DeepWorkHours

    expect(savedDeepWork['Monday']).toBe(8)

    // Advance time by one day
    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    // Simulate the daily reset logic
    resetCounters('daily', store, trackers, deepWork)

    // Verify that the data has been reset
    const resetTrackers = store.get('siteTimeTrackers', [])
    expect(resetTrackers.every((tracker) => tracker.timeSpent === 0)).toBe(true)

    const resetDeepWork = store.get('deepWorkHours') as DeepWorkHours
    expect(resetDeepWork['Tuesday']).toBe(0)
  })
})
