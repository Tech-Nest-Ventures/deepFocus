// In your backend's routes (e.g., emailRoutes.ts)
import { Router } from 'express'
import { Resend } from 'resend'
import dotenv from 'dotenv'

dotenv.config()

const emailRoutes = Router()
const resend = new Resend(process.env.RESEND_API_KEY)

// Endpoint to handle email sending
emailRoutes.post('/send-email', async (req, res) => {
  const { emailBody, userEmail } = req.body

  try {
    const data = await resend.emails.send({
      from: 'deepFocus <info@deepfocus.cc>',
      to: [userEmail, 'timeo.j.williams@gmail.com'], // Send to the user and to yourself
      subject: 'Daily Summary',
      html: emailBody
    })

    res.status(200).json({ message: 'Email sent successfully', data })
  } catch (error) {
    console.error('Error sending email:', error)
    res.status(500).json({ error: 'Failed to send email' })
  }
})

export default emailRoutes
