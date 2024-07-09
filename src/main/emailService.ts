import { Resend } from 'resend'
import * as schedule from 'node-schedule'
import { TypedStore } from './types'
// import html from '../renderer/src/components/Waitlist'

const logoUrl = 'https://www.deepfocus.cc/assets/deepWork-Bb_70LlS.ico'
interface TopSite {
  url: string
  timeSpent: number
}

export class EmailService {
  private userEmail: string
  private store: TypedStore
  private resend: Resend

  constructor(userEmail: string, store: TypedStore) {
    this.userEmail = userEmail || ''
    this.store = store
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  public scheduleEmailSend(): void {
    // Schedule the email to be sent at the end of each day (e.g., 11:59 PM)
    schedule.scheduleJob('59 23 * * *', () => {
      this.sendDailySummary()
    })
  }
  // Avoid sending emails to customers on the weekends
  private async shouldSendEmail(): Promise<boolean> {
    const now = new Date()
    const isWeekend = now.getDay() === 0 || now.getDay() === 6
    return !isWeekend && (await this.checkUserLoggedIn())
  }

  private async checkUserLoggedIn(): Promise<boolean> {
    // Implement logic to check if user has logged in today
    // You might need to pass this information from your main process
    return true
  }

  private async sendDailySummary(): Promise<void> {
    if (!(await this.shouldSendEmail())) {
      console.log('Skipping email send')
      return
    }

    const deepWorkHours = await this.getDeepWorkHours()
    const topSites = await this.getTopSites()

    if (!deepWorkHours || topSites.length === 0) {
      console.log('Not enough data to send email')
      return
    }

    //TODO: const emailBody = this.composeEmailBody(deepWorkHours, topSites)

    try {
      const data = await this.resend.emails.send({
        from: 'deepFocus <info@deepfocus.cc>',
        to: [this.userEmail, 'timeo.j.williams@gmail.com'],
        subject: 'Hello World',
        html: '<strong>It works!</strong>'
      })

      console.log(data)
    } catch (error) {
      console.error(error)
    }
  }

  public composeEmailBody(deepWorkHours: number, topSites: TopSite[]): string {
    return `
      <div style="font-family: Arial, sans-serif; color: #fff; background-color: #000; padding: 20px; border-radius: 8px; max-width: 80%; margin: auto;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
         <img src="${logoUrl}" alt="Logo" style="height: 40px; margin-right: 10px;">
          <h1 style="color: #ecf0f1; margin: 0;">deepFocus</h1>
        </div>
        <h2 style="color: #ecf0f1; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px;">Daily Summary</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">Total Deep Work Hours: <strong>${deepWorkHours}</strong></p>
        
        <h3 style="color: #ecf0f1; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; margin-top: 30px;">Top 5 Sites Visited</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          ${topSites
            .map(
              (site) => `
            <li style="background-color: #333; margin-bottom: 10px; padding: 10px; border-radius: 4px; border: 1px solid #555; color: #fff;">
              <strong>${site.url}</strong>: ${site.timeSpent} minutes
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `
  }

  private async getDeepWorkHours(): Promise<number> {
    const siteTimeTrackers = this.store.get('siteTimeTrackers', [])
    const unproductiveSites = this.store.get('unproductiveSites', [])

    // Calculate total time spent on productive sites (not in unproductiveSites)
    const productiveTime = siteTimeTrackers
      .filter((tracker) => !unproductiveSites?.includes(tracker.url))
      .reduce((total, tracker) => total + tracker.timeSpent, 0)

    // Convert milliseconds to hours
    return productiveTime / (1000 * 60 * 60)
  }

  private async getTopSites(): Promise<TopSite[]> {
    const siteTimeTrackers = this.store.get('siteTimeTrackers', [])

    // Sort trackers by time spent (descending) and take top 5
    const topSites = siteTimeTrackers
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .slice(0, 5)
      .map((tracker) => ({
        url: tracker.url,
        timeSpent: Math.round(tracker.timeSpent / (1000 * 60)) // Convert ms to minutes
      }))

    return topSites
  }

  public async testEmailSend(): Promise<void> {
    console.log('Testing email send...')

    // Use placeholder data for testing
    const testDeepWorkHours = 5
    const testTopSites: TopSite[] = [
      { url: 'example.com', timeSpent: 120 },
      { url: 'github.com', timeSpent: 90 },
      { url: 'stackoverflow.com', timeSpent: 60 },
      { url: 'docs.google.com', timeSpent: 45 },
      { url: 'chat.openai.com', timeSpent: 30 }
    ]

    const emailBody = this.composeEmailBody(testDeepWorkHours, testTopSites)

    try {
      const data = await this.resend.emails.send({
        from: 'deepFocus <info@deepfocus.cc>',
        to: [this.userEmail, 'timeo.j.williams@gmail.com'],
        subject: 'Hello World',
        html: emailBody
      })

      console.log('Response from testEmail is ', data)
    } catch (error) {
      console.error(error)
    }
  }
}
