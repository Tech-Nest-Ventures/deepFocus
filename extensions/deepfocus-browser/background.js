const BRIDGE_URL = 'http://127.0.0.1:17321/browser-event'
const REPORT_DEBOUNCE_MS = 400

const pendingReports = new Map()

function detectBrowser() {
  const userAgent = navigator.userAgent

  if (userAgent.includes('Edg/')) return 'Microsoft Edge'
  if (userAgent.includes('Chrome/')) return 'Google Chrome'
  if (userAgent.includes('Firefox/')) return 'Firefox'

  return 'Browser'
}

function shouldReportTab(tab) {
  return Boolean(
    tab &&
      tab.active &&
      !tab.incognito &&
      tab.url &&
      /^https?:\/\//i.test(tab.url)
  )
}

async function reportTab(tab) {
  if (!shouldReportTab(tab)) {
    return
  }

  try {
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        browser: detectBrowser(),
        url: tab.url,
        title: tab.title || '',
        tabId: tab.id,
        incognito: tab.incognito,
        timestamp: Date.now()
      })
    })

    const result = await response.json().catch(() => ({ action: 'allow' }))
    if (result.action === 'block' && typeof tab.id === 'number') {
      await chrome.tabs.remove(tab.id)
    }
  } catch (_) {
    // Deep Focus may not be running yet. The desktop poller remains as fallback.
  }
}

function scheduleReport(tab) {
  if (!shouldReportTab(tab) || typeof tab.id !== 'number') {
    return
  }

  clearTimeout(pendingReports.get(tab.id))
  pendingReports.set(
    tab.id,
    setTimeout(() => {
      pendingReports.delete(tab.id)
      reportTab(tab)
    }, REPORT_DEBOUNCE_MS)
  )
}

async function reportActiveTab(windowId = chrome.windows.WINDOW_ID_CURRENT) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId })
    scheduleReport(tab)
  } catch (_) {}
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then(scheduleReport).catch(() => {})
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
    scheduleReport(tab)
  }
})

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    reportActiveTab(windowId)
  }
})

chrome.runtime.onStartup.addListener(() => reportActiveTab())
chrome.runtime.onInstalled.addListener(() => reportActiveTab())
