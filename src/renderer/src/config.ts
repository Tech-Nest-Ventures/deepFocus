const isProduction = import.meta.env.PROD

export const API_BASE_URL = isProduction
  ? import.meta.env.VITE_SERVER_URL_PROD
  : import.meta.env.VITE_SERVER_URL_DEV
