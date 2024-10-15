import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import User from '../types'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const sendUserToBackend = (user: User) => {
  console.log('Sending user data to backend:', user)
  const sanitizedUser = JSON.parse(JSON.stringify(user))
  console.log('window is ', window)
  window?.electron.ipcRenderer.send('send-user-data', sanitizedUser)
}

export const stopActivityMonitoring = () => {
  console.log('Stopping activity monitoring')
  window?.electron.ipcRenderer.send('logout-user')
}
