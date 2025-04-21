import { startServer } from './server'
let wsServer: any = null

try {
  wsServer = startServer()
} catch (err) {
  console.error('Failed to start WebSocket server:', err)
  process.exit(1)
}

// Cleanup on exit
process.on('SIGINT', () => {
  if (wsServer) {
    wsServer.close()
  }
  process.exit(0)
})

// Handle process messages if needed
process.on('message', (message) => {
  // Handle any messages from the parent process
  console.log('Received message:', message)
})
