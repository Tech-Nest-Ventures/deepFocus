import WebSocket from 'isomorphic-ws'
import dayjs from 'dayjs'
import log from 'electron-log'

// Export a function to start the server
export function startServer() {
  try {
    const wss = new WebSocket.Server({ port: 3001 })
    const API_BASE_URL = 'https://backend-production-5eec.up.railway.app'

    // Handle server errors
    wss.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log.error('OptiSync Server: Port 3001 is already in use. Another instance may be running.')
        // Optionally, you could try a different port here
        return
      }
      log.error('OptiSync Server: WebSocket error:', error)
    })

    wss.on('connection', (ws) => {
      log.info('OptiSync Server: Client connected')
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'SYNC_UPDATE') {
            const { trackers, deepWorkHours } = msg.data
            // Forward to Railway using native fetch
            const response = await fetch(`${API_BASE_URL}/api/v1/activity/persist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dailyData: trackers.map((t: any) => ({
                  username: 'user', // Updated dynamically in main.ts
                  date: dayjs().format('dddd'),
                  url: t.url.slice(0, 200),
                  title: t.title.slice(0, 100),
                  timeSpent: t.timeSpent
                })),
                deepWorkHours,
                today: dayjs().format('dddd'),
                username: 'user'
              })
            })
            if (response.ok) {
              ws.send(JSON.stringify({ type: 'SYNC_ACK' }))
              log.info('OptiSync Server: Forwarded update to Railway')
            } else {
              log.error('OptiSync Server: Failed to forward to Railway', response.status)
            }
          }
        } catch (err) {
          log.error('OptiSync Server: Error processing message', err)
        }
      })
      ws.on('close', () => log.info('OptiSync Server: Client disconnected'))
    })

    log.info('OptiSync Server: Listening on ws://localhost:3001')

    return wss // Return the server instance so it can be closed if needed
  } catch (err) {
    log.error('OptiSync Server: Failed to start server:', err)
    throw err
  }
}

// Add this to handle running as a child process
if (require.main === module) {
  startServer()
}
