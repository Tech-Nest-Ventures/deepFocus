import { lazy, onMount, createSignal, ComponentProps, createEffect, onCleanup } from 'solid-js'
import { Router, Route, A, useLocation, useNavigate } from '@solidjs/router'
import { render } from 'solid-js/web'
import { AuthProvider, useAuth } from './lib/AuthContext'

import { sendUserToBackend, stopActivityMonitoring } from './lib/utils'
import './assets/main.css'
import logo from './assets/deepWork.svg'
import { IoSettingsSharp, SiSimpleanalytics, VsHome, IoLogOutOutline } from './components/ui/icons'
import { Button } from './components/ui/button'
import Home from './Home'
import Modal from './components/modal'

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
    const token = localStorage.getItem('token') as string
    const user = localStorage.getItem('user')
    if (token && user) {
      setIsLoggedIn(true)
      sendUserToBackend(JSON.parse(user))
      setIsNewUser(false)
    }
    navigate('/')
  })

  createEffect(() => {
    console.log('Updated loggedIn:', isLoggedIn())
  })

  const NavBar = () => {
    const [showLogoutModal, setShowLogoutModal] = createSignal(false) // Modal visibility state

    // Function to show the logout confirmation modal
    const handleLogoutClick = () => {
      setShowLogoutModal(true)
    }

    // Function to handle modal close (cancel)
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
        <header class="flex justify-between items-center p-4 bg-gray-800 opacity-[0.50] w-full">
          <img alt="logo" class="logo h-[40px] w-[40px]" src={logo} />
          <nav class="flex items-center justify-center space-x-4">
            {!isLoggedIn() ? (
              location.pathname !== '/signup' ? (
                <A href="/signup" class="px-4 py-2 rounded text-white logo">
                  <Button>Sign Up</Button>
                </A>
              ) : (
                <A href="/login" class="px-4 py-2 rounded text-white logo">
                  <Button>Login</Button>
                </A>
              )
            ) : (
              <>
                <A href="/" class=" py-2 rounded text-white logo">
                  <Button class="logo">
                    <VsHome />
                  </Button>
                </A>

                <A href="/analytics" class="py-2 rounded text-white logo">
                  <Button class="logo">
                    <SiSimpleanalytics />
                  </Button>
                </A>

                <A href="/settings" class="py-2 rounded text-white flex items-center logo">
                  <Button class="logo">
                    <IoSettingsSharp />
                  </Button>
                </A>
                <Button onClick={handleLogoutClick} class="px-4 rounded text-white logo">
                  <IoLogOutOutline />
                </Button>
              </>
            )}
          </nav>
        </header>

        {/* Modal for logout confirmation */}
        {showLogoutModal() && (
          <Modal onClose={handleCloseModal}>
            <div class="p-4 text-center">
              <h2 class="text-lg font-medium mb-4">Are you sure you want to logout?</h2>
              <div class="flex justify-center space-x-4">
                <Button onClick={handleCloseModal} class="bg-gray-500 text-white px-4 py-2 rounded">
                  Cancel
                </Button>
                <Button onClick={handleLogout} class="bg-red-500 text-white px-4 py-2 rounded">
                  Yes, Logout
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
      {props.children}
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
