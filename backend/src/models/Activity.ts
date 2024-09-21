import { Document, Schema, model } from 'mongoose'

const activitySchema = new Schema(
  {
    username: { type: String, required: true }, // Assuming you track user activity by username
    date: { type: String, required: true }, // Store as 'YYYY-MM-DD' for daily logs
    url: { type: String, required: true },
    title: { type: String },
    timeSpent: { type: Number, default: 0 } // Time spent in seconds
  },
  { timestamps: true }
)

const Activity = model('Activity', activitySchema)

export default Activity
