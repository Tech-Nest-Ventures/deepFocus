// Currently use electron-store for persisting data in our electron application.
export interface User {
  username: string
  firstName: string
  lastName: string
  country: string
  language: string
}

export interface QueuedActivityData {
  id: string
  username: string
  dailyData: Array<{
    url: string
    title: string
    timeSpent: number
    date: string
  }>
  timestamp: number
  retryCount: number
  lastRetryAttempt?: number
}

export interface FocusModeStats {
  websitesBlocked: number
  appsBlocked: number
  totalBlocked: number
}

export interface StoreSchema {
  unproductiveSites?: string[]
  unproductiveApps?: string[]
  siteTimeTrackers: SiteTimeTracker[]
  user?: User
  lastResetDate?: string
  lastEmailDate?: string
  unproductiveUrls?: string[]
  deepWorkHours?: {
    Monday: number
    Tuesday: number
    Wednesday: number
    Thursday: number
    Friday: number
    Saturday: number
    Sunday: number
  }
  deepWorkHoursWithDates?: DeepWorkHoursWithDates
  deepWorkTarget?: number
  offlineQueue?: QueuedActivityData[]
  lastSyncTimestamp?: number
  focusMode?: boolean
  focusModeStats?: FocusModeStats
  manualTimeEntries?: ManualTimeEntry[]
}
export interface SiteTimeTracker {
  url: string
  title: string
  timeSpent: number
  lastActiveTimestamp: number
  iconUrl?: string
  type: TrackerType
}

export type DeepWorkHours = {
  Monday: number
  Tuesday: number
  Wednesday: number
  Thursday: number
  Friday: number
  Saturday: number
  Sunday: number
}

export interface DeepWorkHoursWithDates {
  Monday?: { hours: number; date: string }
  Tuesday?: { hours: number; date: string }
  Wednesday?: { hours: number; date: string }
  Thursday?: { hours: number; date: string }
  Friday?: { hours: number; date: string }
  Saturday?: { hours: number; date: string }
  Sunday?: { hours: number; date: string }
}
export interface ElectronAPI {
  sendUserData: (user: {
    username: string
    language: string
    country: string
    firstName: string
    lastName: string
  }) => void
}

export type browser =
  | 'Google Chrome'
  | 'Arc'
  | 'Brave Browser'
  | 'Microsoft Edge'
  | 'Vivaldi'
  | 'Opera'
  | 'Safari'
  | 'Firefox'
  | 'firefox'
  | 'Orion'

export interface WorkContext {
  type: 'URL' | 'appName'
  value: string
}

export interface AppIcon {
  appName: string
  iconPath: string
}

export enum TrackerType {
  Website = 'website',
  App = 'app'
}

export interface ManualTimeEntry {
  id: string
  taskName: string
  hours: number
  date: string // ISO date format: YYYY-MM-DD
  createdAt: number // timestamp
}
