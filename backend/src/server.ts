// server.ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectToDB, closeDBConnection } from './connectToDB'
import authRoutes from './routes/authRoutes'
import activityRoutes from './routes/activityRoutes'
import emailRoutes from './routes/emailRoutes'

export const app = express()
const port = process.env.PORT || 5000

dotenv.config()

app.use(express.json())

app.use(
  cors({
    origin: '*',
    credentials: true
  })
)

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).send('Server is healthy')
})

app.get('/api/v1/test-db', async (req, res) => {
  await connectToDB()
  res.status(200).send('DB is connected')
})

// Include the routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/activity', activityRoutes)
app.use('/api/v1/emails', emailRoutes)

app.listen(port, function () {
  console.log(`Server is running on port ${port}`)
})
