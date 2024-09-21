import { Schema, model } from 'mongoose'

const weeklyAggregateSchema = new Schema(
  {
    username: { type: String, required: true }, // Track per user
    weekStart: { type: String, required: true }, // 'YYYY-MM-DD' format for start of the week
    weekEnd: { type: String, required: true }, // 'YYYY-MM-DD' format for end of the week
    sites: [
      {
        url: { type: String, required: true },
        title: { type: String },
        totalTimeSpent: { type: Number, default: 0 } // Total time spent in seconds
      }
    ]
  },
  { timestamps: true }
)

const WeeklyAggregate = model('WeeklyAggregate', weeklyAggregateSchema)

export default WeeklyAggregate
