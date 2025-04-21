import { WebSocket } from 'ws'
import { SiteTimeTracker, DeepWorkHours } from './types'

class OptiSyncClient {
  private ws: WebSocket | null = null
  private lastSyncTrackers: SiteTimeTracker[] = []
  private reconnectAttempts = 0
  private readonly maxAttempts = 5

  constructor(private serverUrl: string) {
    this.connect()
  }

  private connect() {
    this.ws = new WebSocket(this.serverUrl)
    this.ws.on('open', () => {
      console.log('OptiSync: WebSocket connected')
      this.reconnectAttempts = 0
    })
    this.ws.on('message', (data) => this.handleMessage(data))
    this.ws.on('error', (err) => console.error('OptiSync: WebSocket error', err))
    this.ws.on('close', () => this.reconnect())
  }

  private reconnect(): void {
    if (this.reconnectAttempts < this.maxAttempts) {
      this.reconnectAttempts++
      setTimeout(() => this.connect(), 5000 * this.reconnectAttempts)
    } else {
      console.log('OptiSync: Falling back to HTTP')
    }
  }

  private handleMessage(data: Buffer) {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'SYNC_ACK') {
      console.log('OptiSync: Server acknowledged sync')
    }
  }

  sendUpdates(trackers: SiteTimeTracker[], deepWorkHours: DeepWorkHours) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    // Compute delta: new or updated trackers
    const deltaTrackers = trackers.filter((t) => {
      const last = this.lastSyncTrackers.find((lt) => lt.title === t.title && lt.url === t.url)
      return (
        !last ||
        last.timeSpent !== t.timeSpent ||
        last.lastActiveTimestamp !== t.lastActiveTimestamp
      )
    })

    if (deltaTrackers.length > 0) {
      this.ws.send(
        JSON.stringify({
          type: 'SYNC_UPDATE',
          data: { trackers: deltaTrackers, deepWorkHours }
        })
      )
      this.lastSyncTrackers = [...trackers] // Update last synced state
    }
  }
}

export const optiSync = new OptiSyncClient('ws://localhost:3001')
