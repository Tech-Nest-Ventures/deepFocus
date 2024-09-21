import request from 'supertest'
import { expect } from 'chai'
import { app } from '../../server'
import { connectToDB, closeDBConnection } from '../../connectToDB'
import { Server } from 'http'

describe('Activity Tracking and Authentication Endpoints', function () {
  let server: Server
  this.timeout(10000)
  const baseUsername = 'testuser'

  before(async () => {
    await connectToDB() // Open the DB connection before the tests
    server = app.listen(5001) // Start the server on a different port for testing
  })

  after(async () => {
    await closeDBConnection() // Close the DB connection after the tests
    server.close() // Stop the server
  })

  afterEach(async () => {
    await request(server)
      .delete('/api/v1/auth/delete')
      .send({
        username: `${baseUsername}@gmail.com`
      })
  })

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user for activity tracking', async () => {
      const res = await request(server)
        .post('/api/v1/auth/signup')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword',
          firstName: 'Test',
          lastName: 'User',
          country: 'Testland',
          language: 'English'
        })

      expect(res.status).to.equal(200)
      expect(res.body).to.have.property('token')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login an existing user and return a token', async () => {
      await request(server)
        .post('/api/v1/auth/signup')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword',
          firstName: 'Test',
          lastName: 'User',
          country: 'Testland',
          language: 'English'
        })

      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword'
        })

      expect(res.status).to.equal(200)
      expect(res.body).to.have.property('token')
    })

    it('should return 400 for invalid credentials', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistentuser', password: 'wrongpassword' })

      expect(res.status).to.equal(400)
      expect(res.text).to.equal('Invalid credentials')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login an existing user and return a token', async () => {
      await request(server)
        .post('/api/v1/auth/signup')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword',
          firstName: 'Test',
          lastName: 'User',
          country: 'Testland',
          language: 'English'
        })

      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword'
        })

      expect(res.status).to.equal(200)
      expect(res.body).to.have.property('token')
    })

    it('should return 400 for invalid credentials', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistentuser', password: 'wrongpassword' })

      expect(res.status).to.equal(400)
      expect(res.text).to.equal('Invalid credentials')
    })
  })

  describe('POST /api/v1/activity/persist', () => {
    it('should persist daily activity data for a user', async () => {
      // First, sign up a new user
      await request(server)
        .post('/api/v1/auth/signup')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword',
          firstName: 'Test',
          lastName: 'User',
          country: 'Testland',
          language: 'English'
        })

      // Now, simulate daily activity persistence
      const res = await request(server)
        .post('/api/v1/activity/persist')
        .send({
          dailyData: [
            {
              username: `${baseUsername}@gmail.com`,
              url: 'https://example.com',
              title: 'Example Site',
              timeSpent: 120, // 2 minutes spent
              date: '2024-09-20'
            }
          ]
        })

      expect(res.status).to.equal(200)
      expect(res.text).to.equal('Daily activity data saved')
    })
  })

  describe('POST /api/v1/activity/aggregate-weekly', () => {
    it('should aggregate weekly activity data for a user', async () => {
      // First, sign up a new user
      await request(server)
        .post('/api/v1/auth/signup')
        .send({
          username: `${baseUsername}@gmail.com`,
          password: 'testpassword',
          firstName: 'Test',
          lastName: 'User',
          country: 'Testland',
          language: 'English'
        })

      // Simulate weekly aggregation data
      const res = await request(server)
        .post('/api/v1/activity/aggregate-weekly')
        .send({
          weeklyData: [
            {
              username: `${baseUsername}@gmail.com`,
              weekStart: '2024-09-16',
              weekEnd: '2024-09-22',
              url: 'https://example.com',
              title: 'Example Site',
              timeSpent: 600 // 10 minutes spent over the week
            }
          ]
        })

      expect(res.status).to.equal(200)
      expect(res.text).to.equal('Weekly data aggregated and saved')
    })
  })
})
