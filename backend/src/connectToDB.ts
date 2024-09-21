import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()
const uri = process.env.MONGODB_URI || ''

if (!uri) {
  throw new Error('MONGODB_URI is not defined in the environment variables')
}

let isConnected = false // Track connection state

async function connectToDB() {
  if (!isConnected) {
    try {
      await mongoose.connect(uri)

      console.log('Connected successfully to MongoDB server')
      isConnected = true
    } catch (error) {
      console.error('Error connecting to MongoDB:', error)
      throw error
    }
  } else {
    console.log('Already connected to MongoDB')
  }
}

async function closeDBConnection() {
  if (isConnected) {
    try {
      await mongoose.connection.close()
      console.log('Disconnected successfully from MongoDB server')
      isConnected = false
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error)
    }
  }
}

export { connectToDB, closeDBConnection }
