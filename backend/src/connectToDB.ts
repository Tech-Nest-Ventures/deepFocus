import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()
const uri = process.env.MONGODB_URI || ''

if (!uri) {
  throw new Error('MONGODB_URI is not defined in the environment variables')
}

let isConnected = false

async function connectToDB(): Promise<typeof mongoose> {
  if (isConnected) {
    console.log('Already connected to MongoDB')
    return mongoose
  }

  try {
    // Connect to the MongoDB server using Mongoose
    await mongoose.connect(uri)
    isConnected = true
    console.log('Connected successfully to MongoDB server')
    return mongoose
  } catch (error) {
    console.error('Error connecting to the database:', error)
    throw error
  }
}

async function closeDBConnection(): Promise<void> {
  try {
    await mongoose.connection.close()
    isConnected = false
    console.log('Disconnected successfully from MongoDB server')
  } catch (error) {
    console.error('Error closing the database connection:', error)
  }
}

export { connectToDB, closeDBConnection }