// Currently use electron-store for persisting data in our electron application.
export interface User {
  username: string
  firstName: string
  lastName: string
  country: string
  language: string
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
  deepWorkTarget?: number
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
