import express from 'express'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import { connectToDB } from './connectToDB'
import User from './models/User'

const app = express()
const port = process.env.PORT || 5000

dotenv.config()
const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  console.error('JWT_SECRET is not set. Please set it as an environment variable.')
  process.exit(1)
}

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

// Authentication routes
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    console.log('Incoming login request for username:', username)
    await connectToDB()
    const user = await User.findOne({ username }) // Use the User model

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ username: user.username }, jwtSecret, {
        expiresIn: '2h'
      })
      res.json({ token })
    } else {
      res.status(400).send('Invalid credentials')
    }
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).send('Server error')
  }
})

app.listen(port, '0.0.0.0', function () {
  console.log(`Server is running on port ${port}`)
})