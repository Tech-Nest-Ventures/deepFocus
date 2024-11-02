// Currently use electron-store for persisting data in our electron application.
export interface User {
  username: string
  firstName: string
  lastName: string
  country: string
  language: string
}

export enum MessageType {
  RESET_DAILY,
  RESET_WEEKLY,
  RESET_TRACKERS,
  UPDATE_DATA,
  GET_DATA,
  REPLY_DATA,
  SET_USER_INFO
}

export interface StoreSchema {
  unproductiveSites?: string[]
  unproductiveApps?: string[]
  siteTimeTrackers: SiteTimeTracker[]
  user?: User
  lastResetDate?: string
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

export type ExtendedResult = Result & { url?: string; siteTimeTracker?: SiteTimeTracker }

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