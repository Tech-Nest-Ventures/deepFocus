// activityRoutes.ts
import { Router } from 'express'
import Activity from '../models/Activity'
import WeeklyAggregate from '../models/WeeklyAggregate'
import { connectToDB, closeDBConnection } from '../connectToDB'

const activityRoutes = Router()

activityRoutes.post('/persist', async (req, res) => {
  const { dailyData } = req.body // Data sent from Electron app

  try {
    await connectToDB()
    await Activity.insertMany(dailyData)
    res.status(200).send('Daily activity data saved')
  } catch (error) {
    console.error('Error saving daily activity data:', error)
    res.status(500).send('Error saving daily activity data')
  }
})

activityRoutes.post('/aggregate-weekly', async (req, res) => {
  const { weeklyData } = req.body // Data sent from Electron app

  try {
    await connectToDB()

    const weekStart = weeklyData[0]?.weekStart
    const weekEnd = weeklyData[0]?.weekEnd

    const aggregatedData = weeklyData.reduce(
      (
        acc: { [x: string]: { url: string; totalTimeSpent: number; title: string } },
        current: { url: string; title: any; timeSpent: any }
      ) => {
        if (!acc[current.url]) {
          acc[current.url] = {
            url: current.url,
            title: current.title,
            totalTimeSpent: 0
          }
        }
        acc[current.url].totalTimeSpent += current.timeSpent
        return acc
      },
      {}
    )

    const aggregatedArray = Object.values(aggregatedData)

    const weeklyAggregate = new WeeklyAggregate({
      username: weeklyData[0].username,
      weekStart,
      weekEnd,
      sites: aggregatedArray
    })

    await weeklyAggregate.save()
    res.status(200).send('Weekly data aggregated and saved')
  } catch (error) {
    console.error('Error saving weekly data:', error)
    res.status(500).send('Error saving weekly data')
  }
})

export default activityRoutes
