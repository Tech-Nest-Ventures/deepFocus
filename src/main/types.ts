import Store from 'electron-store'
import { Result } from 'get-windows'

// Currently use electron-store for persisting data in our electron application.

export interface StoreSchema {
  unproductiveSites?: string[]
  siteTimeTrackers: SiteTimeTracker[]
}

export interface SiteTimeTracker {
  url: string
  title: string
  timeSpent: number
  lastActiveTimestamp: number
}

export type ExtendedResult = Result & { url?: string; siteTimeTracker?: SiteTimeTracker }

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void
}

export { Store, type Result }
