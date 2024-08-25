import express from 'express'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import { connectToDB, closeDBConnection } from './connectToDB'
import User from './models/User'

export const app = express()
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
app.post('/api/v1/auth/signup', async (req, res) => {
  try {
    const { username, password, firstName, lastName, country, language } = req.body
    console.log('Incoming signup request for username:', username)
    await connectToDB()
    const existingUser = await User.findOne({ username })

    if (existingUser) {
      return res.status(400).send('Username already exists')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = new User({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      country,
      language
    })
    await newUser.save()

    const token = jwt.sign({ username: newUser.username }, jwtSecret, {
      expiresIn: '2h'
    })
    res.json({ token })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).send('Server error')
  } finally {
    await closeDBConnection()
  }
})

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    console.log('Incoming login request for username:', username)
    await connectToDB()
    const user = await User.findOne({ username })

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          language: user.language
        },
        jwtSecret,
        { expiresIn: '2h' }
      )
      res.json({ token })
    } else {
      res.status(400).send('Invalid credentials')
    }
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).send('Server error')
  } finally {
    await closeDBConnection()
  }
})

// Add the delete user route
app.delete('/api/v1/auth/delete', async (req, res) => {
  const { username } = req.body

  try {
    await connectToDB()
    const user = await User.findOneAndDelete({ username })
    if (!user) {
      return res.status(404).send('User not found')
    }
    res.status(200).send('User deleted successfully')
  } catch (error) {
    res.status(500).send('Internal server error')
  } finally {
    await closeDBConnection()
  }
})

app.listen(port, function () {
  console.log(`Server is running on port ${port}`)
})
