import dotenv from 'dotenv'
dotenv.config()

const isProduction = process.env.ENV === 'production'

export const API_BASE_URL = isProduction ? process.env.VITE_SERVER_URL_PROD : process.env.VITE_SERVER_URL_DEV
