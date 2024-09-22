import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const sendUserToBackend = (user) => {
  console.log('Sending user data to backend:', user)
  const sanitizedUser = JSON.parse(JSON.stringify(user))
  window?.electron.ipcRenderer.send('send-user-data', sanitizedUser)
}
