// authRoutes.ts
import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import { connectToDB, closeDBConnection } from '../connectToDB'
import Activity from '../models/Activity'
import WeeklyAggregate from '../models/WeeklyAggregate'

const authRoutes = Router()
const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  console.error('JWT_SECRET is not set. Please set it as an environment variable.')
  process.exit(1)
}

authRoutes.post('/signup', async (req, res) => {
  try {
    const { username, password, firstName, lastName, country, language } = req.body
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

    const token = jwt.sign({ username: newUser.username }, jwtSecret, { expiresIn: '2h' })
    res.json({
      token,
      user: {
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        country: newUser.country,
        language: newUser.language
      }
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).send('Server error')
  }
})

authRoutes.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
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
      res.json({
        token,
        user: {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          language: user.language
        }
      })
    } else {
      res.status(400).send('Invalid credentials')
    }
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).send('Server error')
  }
})

authRoutes.delete('/delete', async (req, res) => {
  const { username } = req.body

  try {
    await connectToDB()
    const user = await User.findOneAndDelete({ username })
    if (!user) {
      return res.status(404).send('User not found')
    }

    // Add cascading delete for related data
    await Activity.deleteMany({ username })
    await WeeklyAggregate.deleteMany({ username })

    res.status(200).send('User and associated data deleted successfully')
  } catch (error) {
    res.status(500).send('Internal server error')
  }
})

export default authRoutes
