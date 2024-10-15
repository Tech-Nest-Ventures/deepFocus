import { lazy, Suspense, onMount, createSignal, ComponentProps, createEffect } from 'solid-js'
import { Router, Route, A, useLocation, useNavigate } from '@solidjs/router'
import { render } from 'solid-js/web'
import { AuthProvider, useAuth } from './lib/AuthContext'

import { sendUserToBackend, stopActivityMonitoring } from './lib/utils'
import './assets/main.css'
import logo from './assets/deepWork.svg'
import { IoSettingsSharp, SiSimpleanalytics, VsHome, IoLogOutOutline } from './components/ui/icons'
import { Button } from './components/ui/button'
import Home from './Home'

// Lazy load the components
const Login = lazy(() => import('./Login'))
const Signup = lazy(() => import('./Signup'))
const BarChart = lazy(() => import('./BarChart'))

const Onboarding = lazy(() => import('./Onboarding'))

const Settings = lazy(() => import('./Settings'))

const App = (props: ComponentProps<typeof Router>) => {
  const [isLoggedIn, setIsLoggedIn] = useAuth()
  const [isNewUser, setIsNewUser] = createSignal(true)
  const location = useLocation()
  const navigate = useNavigate()

  onMount(() => {
    const token = localStorage.getItem('token') as string
    const user = localStorage.getItem('user')
    if (token && user) {
      setIsLoggedIn(true)
      sendUserToBackend(JSON.parse(user))
      setIsNewUser(false)
    }
  })

  const handleLogout = () => {
    localStorage.clear()
    setIsLoggedIn(false)
    setIsNewUser(false)
    stopActivityMonitoring()
    navigate('/')
  }

  createEffect(() => {
    console.log('Updated loggedIn:', isLoggedIn())
  })

  const NavBar = () => (
    <>
      <header class="flex justify-between items-center p-4 bg-gray-800 opacity-[0.50] w-full">
        <img alt="logo" class="logo" src={logo} />
        <nav class="flex items-center justify-center space-x-4">
          {!isLoggedIn() ? (
            <>
              {isNewUser() ? (
                location.pathname !== '/signup' ? (
                  <A href="/signup" class="px-4 py-2 rounded text-white">
                    <Button>Sign Up</Button>
                  </A>
                ) : (
                  <A href="/login" class="px-4 py-2 rounded text-white">
                    <Button>Login</Button>
                  </A>
                )
              ) : location.pathname === '/' ? (
                <A href="/login" class="px-4 py-2 rounded text-white">
                  <Button>Login</Button>
                </A>
              ) : (
                // Show Login by default for returning users
                <A href="/signup" class="px-4 py-2 rounded text-white">
                  <Button>Sign Up</Button>
                </A>
              )}
            </>
          ) : (
            <>
              <A href="/" class="px-4 py-2 rounded text-white">
                <VsHome />
              </A>
              <A href="/analytics" class="px-4 py-2 rounded text-white">
                <SiSimpleanalytics />
              </A>
              <A href="/settings" class="px-4 py-2 rounded text-white flex items-center">
                <IoSettingsSharp />
              </A>
              <Button onClick={handleLogout} class="px-4 rounded text-white">
                <IoLogOutOutline />
              </Button>
            </>
          )}
        </nav>
      </header>
    </>
  )

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
        <Suspense fallback={<div>Loading...</div>}>
          <>
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/analytics" component={BarChart} />
            <Route path="/settings" component={Settings} />
            <Route path="/onboarding" component={Onboarding} />
          </>
        </Suspense>
      </Router>
    </AuthProvider>
  ),
  document.getElementById('root') as HTMLElement
)
