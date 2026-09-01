import { lazy, onMount, createSignal, ComponentProps, createEffect, onCleanup } from 'solid-js'
import { Router, Route, useLocation, useNavigate } from '@solidjs/router'
import { render } from 'solid-js/web'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { sendUserToBackend, stopActivityMonitoring } from './lib/utils'
// import { Frigade, FlowStep } from '@frigade/js'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

import './assets/main.css'
import logo from './assets/deepWork.svg'
import { IoSettingsSharp, SiSimpleanalytics, VsHome, IoLogOutOutline } from './components/ui/icons'
import { Button } from './components/ui/button'
import Home from './Home'
import Modal from './components/modal'
import { Motion, Presence } from 'solid-motionone'

// Lazy load the components
const Login = lazy(() => import('./Login'))
const Signup = lazy(() => import('./Signup'))
const Analytics = lazy(() => import('./Analytics'))
const Onboarding = lazy(() => import('./Onboarding'))
const Settings = lazy(() => import('./Settings'))

const App = (props: ComponentProps<typeof Router>) => {
  const [isLoggedIn, setIsLoggedIn] = useAuth()
  const [_isNewUser, setIsNewUser] = createSignal(true)
  const location = useLocation()
  const navigate = useNavigate()

  const refreshDeepWorkData = () => {
    console.log('Fetching latest deep work data...')
    window?.electron.ipcRenderer.send('fetch-deep-work-data')
  }

  const updateDeepWorkTarget = () => {
    console.log('Updating deep work target...')
    window?.electron.ipcRenderer.send('fetch-deep-work-target')
  }

  const initializeTour = () => {
    const tour = new Shepherd.Tour({
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shepherd-theme-arrows',
        scrollTo: { behavior: 'smooth', block: 'center' }
      }
    })

    tour.addStep({
      id: 'home-step',
      text: 'View your daily progress here.',
      attachTo: { element: '#home', on: 'bottom' },
      buttons: [
        {
          text: 'Next',
          action: tour.next
        }
      ],
      beforeShowPromise: () => {
        return new Promise((resolve) => {
          document.querySelector('#home')?.click() // Simulate click on the Home button
          resolve()
        })
      }
    })

    tour.addStep({
      id: 'analytics-step',
      text: 'This button will show analytics (weekly trends & top sites) ',
      attachTo: { element: '#analytics', on: 'bottom' },
      buttons: [
        {
          text: 'Next',
          action: tour.next
        }
      ],
      beforeShowPromise: () => {
        return new Promise((resolve) => {
          document.querySelector('#analytics')?.click() // Simulate click on the Analytics button
          resolve()
        })
      }
    })

    tour.addStep({
      id: 'settings-step',
      text: 'Customize what is considered productive and unproductive here.',
      attachTo: { element: '#settings', on: 'bottom' },
      buttons: [
        {
          text: 'Finish',
          action: tour.complete
        }
      ],
      beforeShowPromise: () => {
        return new Promise((resolve) => {
          document.querySelector('#settings')?.click() // Simulate click on the Settings button
          resolve()
        })
      }
    })

    tour.start()
  }

  // Initialize the tour for new users
  createEffect(() => {
    console.log('checking if logged in and new user')
    console.log('localStorage.getItem(onboarded)', localStorage.getItem('onboarded'))
    if (
      (localStorage.getItem('onboarded') === 'false' || !localStorage.getItem('onboarded')) &&
      localStorage.getItem('token') &&
      localStorage.getItem('user')
    ) {
      initializeTour()
      localStorage.setItem('onboarded', 'true')
      setIsNewUser(false)
    }
  })

  // Set up IPC listeners at the top level
  onMount(() => {
    console.log('Setting up IPC listeners in App.tsx...')
    window?.electron.ipcRenderer.on('refresh-deep-work-data', refreshDeepWorkData)
    window?.electron.ipcRenderer.on('update-deep-work-target', updateDeepWorkTarget)

    onCleanup(() => {
      window?.electron.ipcRenderer.removeListener('refresh-deep-work-data', refreshDeepWorkData)
      window?.electron.ipcRenderer.removeListener('update-deep-work-target', updateDeepWorkTarget)
    })
  })

  onMount(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    if (token && user) {
      setIsLoggedIn(true)
      sendUserToBackend(JSON.parse(user))
      setIsNewUser(false)
    }
    // TODO: better navigate user to home page to show Home component
    navigate('/')
  })

  const NavBar = () => {
    const [showLogoutModal, setShowLogoutModal] = createSignal(false)

    const handleLogoutClick = () => {
      setShowLogoutModal(true)
    }

    const handleCloseModal = () => {
      setShowLogoutModal(false)
    }

    const handleLogout = () => {
      localStorage.clear()
      setIsLoggedIn(false)
      setIsNewUser(false)
      stopActivityMonitoring()
      handleCloseModal()
      navigate('/')
    }

    return (
      <>
        {/* Swiss Typography: Clean header with grid-based layout, centered nav */}
        <header class="flex justify-center items-center bg-background border-b-2 border-foreground w-full relative" style={{ padding: '24px 48px' }}>
          <div class="flex items-center" style={{ position: 'absolute', left: '48px', gap: '12px' }}>
            <img alt="logo" class="logo" src={logo} style={{ height: '20px', width: '20px' }} />
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:block">DEEP FOCUS</span>
          </div>
          <nav class="flex items-center justify-center" style={{ gap: '8px' }}>
            {!isLoggedIn() ? (
              location.pathname !== '/signup' ? (
                <Button id="signup" variant="outline" size="sm" onClick={() => navigate('/signup')}>SIGN UP</Button>
              ) : (
                <Button id="login" variant="outline" size="sm" onClick={() => navigate('/login')}>LOGIN</Button>
              )
            ) : (
              <>
                <Button variant="ghost" size="icon" class="logo" id="home" onClick={() => navigate('/')}>
                  <VsHome />
                </Button>
                <Button variant="ghost" size="icon" class="logo" id="analytics" onClick={() => navigate('/analytics')}>
                  <SiSimpleanalytics />
                </Button>
                <Button variant="ghost" size="icon" class="logo" id="settings" onClick={() => navigate('/settings')}>
                  <IoSettingsSharp />
                </Button>
                <Button
                  onClick={handleLogoutClick}
                  variant="ghost"
                  size="icon"
                  class="logo"
                  id="logout"
                >
                  <IoLogOutOutline />
                </Button>
              </>
            )}
          </nav>
        </header>

        {showLogoutModal() && (
          <Modal onClose={handleCloseModal}>
            {/* Swiss Typography: Left-aligned, clean typography, extreme whitespace */}
            <div class="p-swiss-8">
              <h2 class="text-xl font-extrabold mb-swiss-6 uppercase tracking-tight">ARE YOU SURE YOU WANT TO LOGOUT?</h2>
              <div class="flex justify-start space-x-swiss-4">
                <Button onClick={handleCloseModal} variant="outline" size="sm">
                  CANCEL
                </Button>
                <Button onClick={handleLogout} variant="destructive" size="sm">
                  YES, LOGOUT
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </>
    )
  }

  return (
    <>
      <NavBar />
      <main class="flex-1 overflow-y-auto overflow-x-hidden">
        {props.children}
      </main>
    </>
  )
}

export default App

render(
  () => (
    <AuthProvider>
      <Router root={App}>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
        <Route path="/onboarding" component={Onboarding} />
      </Router>
    </AuthProvider>
  ),
  document.getElementById('root') as HTMLElement
)
