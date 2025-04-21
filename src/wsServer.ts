import { startServer } from './server'

// Start the WebSocket server
startServer()

// Handle process messages if needed
process.on('message', (message) => {
  // Handle any messages from the parent process
  console.log('Received message:', message)
})
