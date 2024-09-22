const isProduction = process.env.ENV === 'production'

export const API_BASE_URL = isProduction ? process.env.SERVER_URL_PROD : process.env.SERVER_URL_DEV
