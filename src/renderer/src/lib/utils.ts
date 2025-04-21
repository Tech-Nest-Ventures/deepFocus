import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import User from '../types'
import type { ElectronAPI } from '../../../preload'

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// export const sendUserToBackend = (user: User) => {
//   console.log('Sending user data to backend:', user)
//   const sanitizedUser = JSON.parse(JSON.stringify(user))
//   console.log('window is ', window)
//   window?.electron.ipcRenderer.send('login-user', sanitizedUser)
// }

export const sendUserToBackend = (user: User) => {
  console.log('Sending user data to backend:', user)
  const sanitizedUser = JSON.parse(JSON.stringify(user))
  window?.electron.sendUserToBackend(sanitizedUser)
}

export const stopActivityMonitoring = () => {
  console.log('Stopping activity monitoring')
  window?.electron.ipcRenderer.send('logout-user')
}

export const getFavicon = (url: string): string => {
  try {
    const formattedUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url
    const domain = new URL(formattedUrl).hostname
    if (domain === 'mail.google.com') {
      return 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
    } else {
      return `https://www.google.com/s2/favicons?sz=64&domain=${formattedUrl}`
    }
  } catch (error) {
    console.error('Invalid URL format:', url)
    return ''
  }
}
