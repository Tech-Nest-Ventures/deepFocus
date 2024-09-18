import { TypedStore } from './types'
interface TopSite {
  url: string
  timeSpent: number
}
export declare class EmailService {
  private userEmail
  private store
  private resend
  constructor(userEmail: string, store: TypedStore)
  scheduleEmailSend(): void
  private shouldSendEmail
  private checkUserLoggedIn
  private sendDailySummary
  composeEmailBody(deepWorkHours: number, topSites: TopSite[]): string
  private getDeepWorkHours
  private getTopSites
  testEmailSend(): Promise<void>
}
export {}
