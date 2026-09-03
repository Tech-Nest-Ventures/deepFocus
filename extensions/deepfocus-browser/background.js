const BRIDGE_URL = 'http://127.0.0.1:17321/browser-event'
const REPORT_DEBOUNCE_MS = 400

const pendingReports = new Map()
const extensionApi =
  typeof browser !== 'undefined'
    ? browser
    : typeof chrome !== 'undefined'
      ? chrome
      : null

function callExtensionApi(namespace, methodName, ...args) {
  if (!extensionApi || !namespace || typeof namespace[methodName] !== 'function') {
    return Promise.reject(new Error(`Missing extension API method: ${methodName}`))
  }

  if (typeof browser !== 'undefined') {
    return namespace[methodName](...args)
  }

  return new Promise((resolve, reject) => {
    namespace[methodName](...args, (result) => {
      const lastError = extensionApi.runtime?.lastError
      if (lastError) {
        reject(new Error(lastError.message))
        return
      }

      resolve(result)
    })
  })
}

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
      !tab.incognito
  )
}

async function reportTab(tab) {
  if (!shouldReportTab(tab)) {
    return
  }

  try {
    const isWebURL = tab.url && /^https?:\/\//i.test(tab.url)
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        browser: detectBrowser(),
        url: isWebURL ? tab.url : '',
        title: tab.title || '',
        tabId: tab.id,
        incognito: tab.incognito,
        timestamp: Date.now()
      })
    })

    const result = await response.json().catch(() => ({ action: 'allow' }))
    if (result.action === 'block' && typeof tab.id === 'number') {
      await callExtensionApi(extensionApi.tabs, 'remove', tab.id)
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

async function reportActiveTab(windowId = extensionApi.windows.WINDOW_ID_CURRENT) {
  try {
    const [tab] = await callExtensionApi(extensionApi.tabs, 'query', { active: true, windowId })
    scheduleReport(tab)
  } catch (_) {}
}

if (extensionApi) {
  extensionApi.tabs.onActivated.addListener(({ tabId }) => {
    callExtensionApi(extensionApi.tabs, 'get', tabId).then(scheduleReport).catch(() => {})
  })

  extensionApi.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
      scheduleReport(tab)
    }
  })

  extensionApi.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== extensionApi.windows.WINDOW_ID_NONE) {
      reportActiveTab(windowId)
    }
  })

  extensionApi.runtime.onStartup.addListener(() => reportActiveTab())
  extensionApi.runtime.onInstalled.addListener(() => reportActiveTab())
}
