import Store from 'electron-store'

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

export { Store }

export type Options = {
  /**
	Enable the accessibility permission check. _(macOS)_

	Setting this to `false` will prevent the accessibility permission prompt on macOS versions 10.15 and newer. The `url` property won't be retrieved.

	@default true
	*/
  readonly accessibilityPermission: boolean

  /**
	Enable the screen recording permission check. _(macOS)_

	Setting this to `false` will prevent the screen recording permission prompt on macOS versions 10.15 and newer. The `title` property in the result will always be set to an empty string.

	@default true
	*/
  readonly screenRecordingPermission: boolean
}

export type BaseOwner = {
  /**
	Name of the app.
	*/
  name: string

  /**
	Process identifier
	*/
  processId: number

  /**
	Path to the app.
	*/
  path: string
}

export type BaseResult = {
  /**
	Window title.
	*/
  title: string

  /**
	Window identifier.

	On Windows, there isn't a clear notion of a "Window ID". Instead it returns the memory address of the window "handle" in the `id` property. That "handle" is unique per window, so it can be used to identify them. [Read more…](https://msdn.microsoft.com/en-us/library/windows/desktop/ms632597(v=vs.85).aspx#window_handle).
	*/
  id: number

  /**
	Window position and size.
	*/
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }

  /**
	App that owns the window.
	*/
  owner: BaseOwner

  /**
	Memory usage by the window.
	*/
  memoryUsage: number
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export type MacOSOwner = {
  /**
	Bundle identifier.
	*/
  bundleId: string
} & BaseOwner

// eslint-disable-next-line @typescript-eslint/naming-convention
export type MacOSResult = {
  platform: 'macos'

  owner: MacOSOwner

  /**
	URL of the active browser tab if the active window is Safari (includes Technology Preview), Chrome (includes Beta, Dev, and Canary), Edge (includes Beta, Dev, and Canary), Brave (includes Beta and Nightly), Mighty, Ghost Browser, WaveBox, Sidekick, Opera (includes Beta and Developer), or Vivaldi.
	*/
  url?: string
} & BaseResult

export type LinuxResult = {
  platform: 'linux'
} & BaseResult

export type WindowsResult = {
  platform: 'windows'
} & BaseResult

export type Result = MacOSResult | LinuxResult | WindowsResult
