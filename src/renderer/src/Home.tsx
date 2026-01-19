import { onMount, createSignal, createEffect, onCleanup, For } from 'solid-js'
import { useAuth } from './lib/AuthContext'
import User, { WindowInfo, ManualTimeEntry } from './types'
import CircularProgress from './CircularProgress'
import SandTimer from './SandTimer'
import dayjs from 'dayjs'
import { IpcRendererEvent } from 'electron'
import { Motion } from 'solid-motionone'
import { formatUrlForDisplay } from './lib/utils'
import Modal from './components/modal'
import { Button } from './components/ui/button'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'
import { IconX } from './components/ui/icons'

const Home = () => {
  const [loggedIn] = useAuth()
  const user = localStorage.getItem('user')
    ? (JSON.parse(localStorage.getItem('user') as string) as User)
    : undefined

  const [progress, setProgress] = createSignal(0)
  const [deepWorkDone, setDeepWorkDone] = createSignal(0)
  const [deepWorkTarget, setDeepWorkTarget] = createSignal(8) // Default to 8 hours
  const [activeWindowInfo, setActiveWindowInfo] = createSignal<null | WindowInfo>(null)
  const [showManualEntryModal, setShowManualEntryModal] = createSignal(false)
  const [manualEntries, setManualEntries] = createSignal<ManualTimeEntry[]>([])
  const [taskName, setTaskName] = createSignal('')
  const [hours, setHours] = createSignal('')
  const [entryDate, setEntryDate] = createSignal(dayjs().format('YYYY-MM-DD'))



  // Fetch initial data and set up IPC listeners on mount
  onMount(() => {
    if (user && loggedIn()) {
      fetchDeepWorkTarget()
      fetchDeepWorkData()
      fetchManualEntries()

      window?.electron.ipcRenderer.on('deep-work-data-response', handleDeepWorkData)
      window?.electron.ipcRenderer.on('deep-work-target-response', handleDeepWorkTarget)
      window?.electron.ipcRenderer.on('active-window-info', handleActiveWindowInfo)
      window?.electron.ipcRenderer.on('manual-time-entries-response', handleManualEntriesResponse)

      // Clean up IPC listeners on unmount
      onCleanup(() => {
        window?.electron.ipcRenderer.removeListener('deep-work-data-response', handleDeepWorkData)
        window?.electron.ipcRenderer.removeListener(
          'deep-work-target-response',
          handleDeepWorkTarget
        )
        window?.electron.ipcRenderer.removeListener('active-window-info', handleActiveWindowInfo)
        window?.electron.ipcRenderer.removeListener('manual-time-entries-response', handleManualEntriesResponse)
      })
    } else {
      console.log('User is not logged in/Signed Up')
    }
  })

  createEffect(() => {
    console.log('Updated progress:', progress())
    console.log('Active Window Info:', activeWindowInfo())
  })

  // Handle deep work data response from IPC
  const handleDeepWorkData = (_event: IpcRendererEvent, response: number[] | { data: number[]; labels: string[] }) => {
    // Handle both old format (array) and new format (object with data and labels)
    let data: number[]

    if (Array.isArray(response)) {
      // Old format - just an array of numbers
      data = response
    } else {
      // New format - object with data and labels
      data = response.data
    }

    // Get today's data - data is always ordered MON, TUE, WED, THU, FRI, SAT, SUN
    // dayjs().day() returns 0 for Sunday, 1 for Monday, etc.
    // We need to convert: Sunday (0) -> index 6, Monday (1) -> index 0, etc.
    const todayIndex = dayjs().day() === 0 ? 6 : dayjs().day() - 1
    if (data && data.length > todayIndex) {
      const workDone = data[todayIndex]
      setDeepWorkDone(workDone)
      setProgress(workDone / deepWorkTarget()) // Calculate the progress percentage
    } else {
      console.log('No deep work data available for today.')
    }
  }

  // Handle deep work target response from IPC
  const handleDeepWorkTarget = (_event: IpcRendererEvent, target: number) => {
    setDeepWorkTarget(target)
    console.log('Deep work target updated:', target)
  }

  // Handle active window information response from IPC
  const handleActiveWindowInfo = (_event: IpcRendererEvent, windowInfo: WindowInfo) => {
    setActiveWindowInfo({
      appName: windowInfo.appName || 'Unknown App',
      URL: windowInfo.URL || 'Unknown URL',
      isProductive: windowInfo.isProductive
    })
  }

  // Fetch the deep work data
  const fetchDeepWorkData = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  // Fetch the deep work target from main process
  const fetchDeepWorkTarget = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-target')
  }

  // Fetch manual time entries
  const fetchManualEntries = () => {
    const today = dayjs().format('YYYY-MM-DD')
    window?.electron?.ipcRenderer.send('fetch-manual-time-entries', today)
  }

  // Handle manual entries response
  const handleManualEntriesResponse = (_event: IpcRendererEvent, entries: ManualTimeEntry[]) => {
    setManualEntries(entries)
  }

  // Handle manual entry submission
  const handleSubmitManualEntry = () => {
    const taskNameValue = taskName().trim()
    const hoursValue = parseFloat(hours())

    // Validation
    if (!taskNameValue) {
      alert('Task name is required')
      return
    }
    if (isNaN(hoursValue) || hoursValue <= 0 || hoursValue > 24) {
      alert('Hours must be between 0 and 24')
      return
    }
    if (!dayjs(entryDate()).isValid()) {
      alert('Invalid date')
      return
    }

    // Send to main process
    window?.electron?.ipcRenderer.send('add-manual-time-entry', {
      taskName: taskNameValue,
      hours: hoursValue,
      date: entryDate()
    })

    // Reset form
    setTaskName('')
    setHours('')
    setEntryDate(dayjs().format('YYYY-MM-DD'))
    setShowManualEntryModal(false)

    // Refresh data
    setTimeout(() => {
      fetchDeepWorkData()
      fetchManualEntries()
    }, 100)
  }

  // Handle delete manual entry
  const handleDeleteManualEntry = (entryId: string) => {
    window?.electron?.ipcRenderer.send('delete-manual-time-entry', entryId)
    setTimeout(() => {
      fetchDeepWorkData()
      fetchManualEntries()
    }, 100)
  }

  return (
    <Motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, easing: "ease-out" }}
  >
    {/* Swiss Typography: Asymmetric layout, left-aligned, balanced whitespace */}
    <div class="flex justify-start items-start h-full flex-col" style={{ padding: '48px 64px', 'gap': '48px' }}>
      {!loggedIn() || !user ? (
        <div class="w-full" style={{ 'gap': '48px', display: 'flex', 'flex-direction': 'column' }}>
          <h1 class="swiss-heading" style={{ 'font-size': '2rem' }}>WELCOME TO DEEP FOCUS</h1>
          <SandTimer />
        </div>
      ) : (
        <div class="w-full" style={{ 'gap': '48px', display: 'flex', 'flex-direction': 'column' }}>
          {/* Primary heading - Largest, boldest */}
          <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column' }}>
            <h1 class="swiss-heading" style={{ 'font-size': '1.75rem' }}>
              {user?.firstName.toUpperCase()}'S DAILY DEEP WORK
            </h1>
          </div>
          
          {/* Progress indicator - Clear visual hierarchy */}
          <div style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
            <CircularProgress progress={progress()} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualEntryModal(true)}
              style={{
                'max-width': '200px',
                'font-size': '0.875rem',
                'color': 'hsl(var(--foreground))',
                'border-color': 'hsl(var(--foreground))'
              }}
            >
              ADD MANUAL ENTRY
            </Button>
          </div>
          
          {/* Active task - Secondary information */}
          {activeWindowInfo() ? (
            <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column', 'border-top': '2px solid hsl(var(--foreground))', 'padding-top': '32px' }}>
              <label class="swiss-label">ACTIVE TASK</label>
              <h2 style={{ 'margin': 0, 'padding': 0, 'font-size': '1.125rem', 'font-weight': 700, 'text-transform': 'uppercase', 'line-height': 1.2 }}>
                <span
                  style={{ 
                    'color': activeWindowInfo().isProductive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    'font-weight': activeWindowInfo().isProductive ? 900 : 700
                  }}
                >
                  {activeWindowInfo().URL !== 'Unknown URL'
                    ? formatUrlForDisplay(activeWindowInfo().URL).toUpperCase()
                    : activeWindowInfo().appName.toUpperCase()}
                </span>
                {!activeWindowInfo().isProductive && (
                  <span style={{ 'margin-left': '24px', 'color': 'hsl(var(--muted-foreground))', 'font-weight': 400, 'font-size': '0.875rem' }}>(UNPRODUCTIVE)</span>
                )}
              </h2>
            </div>
          ) : (
            <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column', 'border-top': '2px solid hsl(var(--foreground))', 'padding-top': '32px' }}>
              <label class="swiss-label">ACTIVE TASK</label>
              <h2 style={{ 'margin': 0, 'padding': 0, 'font-size': '1.125rem', 'font-weight': 700, 'text-transform': 'uppercase', 'color': 'hsl(var(--muted-foreground))', 'line-height': 1.2 }}>NO ACTIVE TASK DETECTED</h2>
            </div>
          )}

          {/* Manual Time Entries */}
          {manualEntries().length > 0 && (
            <div style={{ 'gap': '16px', display: 'flex', 'flex-direction': 'column', 'border-top': '2px solid hsl(var(--foreground))', 'padding-top': '32px' }}>
              <label class="swiss-label">MANUAL ENTRIES (TODAY)</label>
              <div style={{ 'gap': '12px', display: 'flex', 'flex-direction': 'column' }}>
                <For each={manualEntries()}>
                  {(entry) => (
                    <div style={{ 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'padding': '12px 0', 'border-bottom': '1px solid hsl(var(--muted-foreground))' }}>
                      <div style={{ 'gap': '4px', display: 'flex', 'flex-direction': 'column', 'flex': 1 }}>
                        <span style={{ 'font-size': '0.875rem', 'font-weight': 700, 'text-transform': 'uppercase', 'color': 'hsl(var(--foreground))' }}>
                          {entry.taskName}
                        </span>
                        <span style={{ 'font-size': '0.75rem', 'color': 'hsl(var(--muted-foreground))', 'text-transform': 'uppercase' }}>
                          {entry.hours} {entry.hours === 1 ? 'HOUR' : 'HOURS'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteManualEntry(entry.id)}
                        style={{
                          'color': 'hsl(var(--muted-foreground))',
                          'border-color': 'transparent',
                          'width': '32px',
                          'height': '32px'
                        }}
                      >
                        <IconX style={{ 'width': '16px', 'height': '16px' }} />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualEntryModal() && (
        <Modal onClose={() => setShowManualEntryModal(false)}>
          <div style={{ 'gap': '32px', display: 'flex', 'flex-direction': 'column' }}>
            <h2 class="swiss-heading" style={{ 'font-size': '1.25rem', 'margin': 0, 'padding': 0 }}>ADD MANUAL TIME ENTRY</h2>
            
            <div style={{ 'gap': '24px', display: 'flex', 'flex-direction': 'column' }}>
              <TextField>
                <TextFieldLabel>TASK NAME</TextFieldLabel>
                <TextFieldInput
                  type="text"
                  value={taskName()}
                  onInput={(e) => setTaskName(e.currentTarget.value)}
                  placeholder="e.g., Reading academic papers"
                />
              </TextField>

              <TextField>
                <TextFieldLabel>HOURS</TextFieldLabel>
                <TextFieldInput
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={hours()}
                  onInput={(e) => setHours(e.currentTarget.value)}
                  placeholder="1.5"
                />
              </TextField>

              <TextField>
                <TextFieldLabel>DATE</TextFieldLabel>
                <TextFieldInput
                  type="date"
                  value={entryDate()}
                  onInput={(e) => setEntryDate(e.currentTarget.value)}
                />
              </TextField>
            </div>

            <div style={{ 'gap': '12px', display: 'flex', 'flex-direction': 'row', 'justify-content': 'flex-start' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualEntryModal(false)}
              >
                CANCEL
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSubmitManualEntry}
              >
                ADD ENTRY
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    </Motion.div>
  )
}

export default Home
