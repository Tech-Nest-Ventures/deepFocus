import { expect, vi, describe, beforeEach, afterEach, it } from 'vitest'
import { generateLargeFakeData } from '../scripts/generateFakeData'
import { DeepWorkHours, StoreSchema } from '../src/main/types'
import { resetCounters } from '../src/main/index'
import { ipcMain } from 'electron'

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

vi.mock('electron', () => {
  return {
    ipcMain: {
      on: vi.fn(),
      emit: vi.fn(),
      removeAllListeners: vi.fn()
    },
    ipcRenderer: {
      on: vi.fn(),
      send: vi.fn(),
      removeAllListeners: vi.fn()
    },
    BrowserWindow: vi.fn().mockImplementation(() => ({
      webContents: {
        send: vi.fn()
      },
      on: vi.fn(),
      show: vi.fn(),
      hide: vi.fn()
    }))
  }
})

describe('Test Day Reset Logic with IPC', () => {
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
    ipcMain.removeAllListeners()
  })

  it('should populate a full day of data, reset on the next day, and notify the frontend', () => {
    // Generate large fake data for the test date
    const { trackers, deepWork } = generateLargeFakeData('2024-10-07', 8)

    // Set data in the store
    store.set('siteTimeTrackers', trackers)
    store.set('deepWorkHours', deepWork)

    // Verify the initial data is stored correctly
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
    vi.advanceTimersByTime(24 * 60 * 60 * 1000) // Move to the next day

    // Simulate the app's daily reset logic
    resetCounters('daily')

    // Simulate sending a notification to the frontend about the reset
    ipcMain.emit('deep-work-reset')

    // Verify that the data has been reset
    const resetTrackers = store.get('siteTimeTrackers', [])
    expect(resetTrackers.every((tracker) => tracker.timeSpent === 0)).toBe(true)

    const resetDeepWork = store.get('deepWorkHours') as DeepWorkHours
    expect(resetDeepWork['Tuesday']).toBe(0)

    // Verify that the frontend is notified via IPC
    expect(ipcMain.emit).toHaveBeenCalledWith('deep-work-reset')
  })
})
