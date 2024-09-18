import { Result, SiteTimeTracker } from './types'
export declare function getUrlFromResult(result: Result): string | undefined
export declare function capitalizeFirstLetter(text: string): string
export declare function formatUrl(input: string): string
export declare function formatTime(milliseconds: number): string
export declare function updateSiteTimeTracker(windowInfo: Result): SiteTimeTracker
