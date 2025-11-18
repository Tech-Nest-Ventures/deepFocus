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
  window?.electron.ipcRenderer.send('login-user', sanitizedUser)
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

/**
 * Formats a URL for display by extracting just the domain name.
 * Removes protocol (https://, http://) and www. prefix.
 * Example: "https://www.google.com/search?q=..." -> "google.com"
 */
export const formatUrlForDisplay = (url: string): string => {
  if (!url || url === 'Unknown URL') {
    return url
  }
  
  try {
    // Ensure the URL has a protocol for URL parsing
    const urlWithProtocol = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`
    
    const urlObj = new URL(urlWithProtocol)
    let hostname = urlObj.hostname
    
    // Remove www. prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }
    
    return hostname
  } catch (error) {
    // If URL parsing fails, try to extract domain manually
    console.error('Error parsing URL for display:', error)
    
    // Remove protocol
    let cleaned = url.replace(/^https?:\/\//i, '')
    
    // Remove www. prefix
    if (cleaned.startsWith('www.')) {
      cleaned = cleaned.substring(4)
    }
    
    // Remove path and query parameters
    const domain = cleaned.split('/')[0]
    
    return domain || url
  }
}