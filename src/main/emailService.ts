import axios from 'axios'
import * as schedule from 'node-schedule'
import { TypedStore } from './index'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

interface TopSite {
  url: string
  timeSpent: string
}

export class EmailService {
  private userEmail: string
  private store: TypedStore

  constructor(userEmail: string, store: TypedStore) {
    this.userEmail = userEmail || ''
    this.store = store
  }

  public scheduleEmailSend(): void {
    // Schedule the email to be sent every 4 hours
    schedule.scheduleJob('0 */4 * * *', () => {
      this.sendDailySummary()
    })

    // Schedule the email to be sent at the end of each day (11:59 PM)
    schedule.scheduleJob('59 23 * * *', () => {
      this.sendDailySummary()
    })

    if (!app.isPackaged) {
      // For testing, send the email immediately
      this.sendDailySummary()
    }
  }

  private async sendDailySummary(): Promise<void> {
    console.log('Sending daily summary...')

    const deepWorkHours = await this.getDeepWorkHours()
    const topSites = await this.getTopSites()

    if (topSites.length === 0) {
      console.log('Not enough data to send email')
      return
    }

    const emailBody = this.composeEmailBody(deepWorkHours, topSites)

    try {
      const response = await axios.post(
        `${process.env.VITE_SERVER_URL_PROD}/api/v1/emails/send-email`,
        {
          emailBody,
          userEmail: this.userEmail
        }
      )

      console.log('Email sent successfully:', response.data)
    } catch (error) {
      console.error('Error sending email to backend:', error)
    }
  }

  public async testEmailSend(): Promise<void> {
    console.log('Testing email send...')

    // Get the app path and resolve the email template file path
    const emailTemplatePath = path.join(app.getAppPath(), '/src/main/emailTemplates/welcome.html')
    console.log('app.getAppPath() ', app.getAppPath())
    console.log('Resolved email template path: ', emailTemplatePath)

    let emailBody: string
    try {
      emailBody = fs.readFileSync(emailTemplatePath, 'utf8')
    } catch (err) {
      console.error('Error reading email template file:', err)
      return
    }

    try {
      const response = await axios.post(
        `${process.env.VITE_SERVER_URL_PROD}/api/v1/emails/send-email`,
        {
          emailBody,
          userEmail: this.userEmail
        }
      )

      console.log('Response from backend email send:', response.data)
    } catch (error) {
      console.error('Error sending email to backend:', error)
    }
  }

  private formatTime(timeSpentInMinutes: number): string {
    if (timeSpentInMinutes >= 60) {
      const hours = Math.floor(timeSpentInMinutes / 60)
      const minutes = timeSpentInMinutes % 60
      return `${hours}h ${minutes}m`
    }
    return `${timeSpentInMinutes} minutes`
  }

  public composeEmailBody(deepWorkHours: number, topSites: TopSite[]): string {
    return `
      <div style="font-family: Arial, sans-serif; color: #fff; background-color: #000; padding: 20px; border-radius: 8px; max-width: 80%; margin: auto;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <h1 style="color: #ecf0f1; margin: 0; font-style: italic; font-family: 'Montserrat', sans-serif;">deepFocus</h1>
        </div>
        <p style="font-size: 16px; margin-bottom: 20px;">Total Deep Work Hours: <strong>${deepWorkHours}</strong></p>
        <h3 style="color: #ecf0f1; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; margin-top: 30px;">Top 3 Sites Visited</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          ${topSites
            .map(
              (site) => `
                <li style="background-color: #333; margin-bottom: 10px; padding: 10px; border-radius: 4px; border: 1px solid #555; color: #fff;">
                  <strong>${site.url}</strong>: ${site.timeSpent} 
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

    const productiveTime = siteTimeTrackers
      .filter((tracker) => !unproductiveSites?.includes(tracker.url))
      .reduce((total, tracker) => total + tracker.timeSpent, 0)

    // Convert ms to hours and return rounded to 1 decimal place
    return parseFloat((productiveTime / (1000 * 60 * 60)).toFixed(1))
  }

  private async getTopSites(): Promise<TopSite[]> {
    const siteTimeTrackers = this.store.get('siteTimeTrackers', [])

    const getTrimmedTitle = (title: string): string => {
      const maxLength = 50
      return title.length > maxLength ? title.slice(0, maxLength) + '...' : title
    }

    // Filter out trackers with zero time, then sort and slice to get top 3
    const topSites = siteTimeTrackers
      .filter((tracker) => tracker.timeSpent > 0)
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .slice(0, 3) // Get top 3
      .map((tracker) => ({
        url: tracker.url || getTrimmedTitle(tracker.title || 'Unknown Title'),
        timeSpent: this.formatTime(Math.round(tracker.timeSpent / (1000 * 60))) // Convert to minutes and format
      }))

    return topSites
  }
}
