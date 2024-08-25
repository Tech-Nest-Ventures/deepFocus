/* eslint-env mocha */
import request from 'supertest'
import { expect } from 'chai'
import { app } from '../../server'
import { Server } from 'http'
describe('Authentication Endpoints', () => {
  let server: Server

  before((done) => {
    server = app.listen(5001, done) // Start the server on a different port for testing
  })

  after((done) => {
    server.close(done)
  })

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user and return a token, then delete the user', async () => {
      const res = await request(server).post('/api/v1/auth/signup').send({
        username: 'testuser1@gmail.com',
        password: 'testpassword',
        firstName: 'Test',
        lastName: 'User',
        country: 'Testland',
        language: 'English'
      })

      expect(res.status).to.equal(200)
      expect(res.body).to.have.property('token')

      // Delete the user after creation
      await request(server).delete('/api/v1/auth/delete').send({
        username: 'testuser1@gmail.com'
      })
    })

    it('should return 400 if username already exists', async () => {
      await request(server).post('/api/v1/auth/signup').send({
        username: 'testuser@gmail.com',
        password: 'testpassword',
        firstName: 'Test',
        lastName: 'User',
        country: 'Testland',
        language: 'English'
      })

      const res = await request(server).post('/api/v1/auth/signup').send({
        username: 'testuser@gmail.com',
        password: 'testpassword',
        firstName: 'Test',
        lastName: 'User',
        country: 'Testland',
        language: 'English'
      })

      expect(res.status).to.equal(400)
      expect(res.text).to.equal('Username already exists')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login an existing user and return a token', async () => {
      await request(server).post('/api/v1/auth/signup').send({
        username: 'testuser2@gmail.com',
        password: 'testpassword',
        firstName: 'Test',
        lastName: 'User',
        country: 'Testland',
        language: 'English'
      })

      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser2@gmail.com', password: 'testpassword' })

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
})
