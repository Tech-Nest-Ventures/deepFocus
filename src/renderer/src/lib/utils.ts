import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const sendUserToBackend = (user) => {
  console.log('Sending username to backend:', user)
  window?.electron.ipcRenderer.send('send-username', user)
}
