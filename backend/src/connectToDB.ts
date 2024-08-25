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
async function closeDBConnection(): Promise<void> {
  try {
    await mongoose.connection.close()
    console.log('Disconnected successfully from MongoDB server')
  } catch (error) {
    console.error('Error closing the database connection:', error)
  }
}

export { connectToDB, closeDBConnection }
