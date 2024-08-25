import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()
const uri = process.env.MONGODB_URI || ''

if (!uri) {
  throw new Error('MONGODB_URI is not defined in the environment variables')
}

async function connectToDB(): Promise<typeof mongoose> {
  try {
    // Connect to the MongoDB server using Mongoose
    await mongoose.connect(uri)
    console.log('Connected successfully to MongoDB server')
    return mongoose
  } catch (error) {
    console.error('Error connecting to the database:', error)
    throw error
  }
}

export { connectToDB }
