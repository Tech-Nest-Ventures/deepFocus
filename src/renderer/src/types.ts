export default interface User {
  username: string
  firstName: string
  lastName: string
  country: string
  language: string
}

export type WindowInfo = {
  appName: string
  URL: string
  isProductive: boolean
}

export interface SiteTimeTracker {
  url: string
  title: string
  timeSpent: number
  lastActiveTimestamp: number
  iconUrl?: string
  type: TrackerType
}

export interface AppIcon {
  appName: string
  iconPath: string
}

export enum TrackerType {
  Website = 'website',
  App = 'app'
}
