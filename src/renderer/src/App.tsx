import { lazy, Suspense, onMount, createSignal, ComponentProps } from 'solid-js'
import { Router, Route, A, useLocation, HashRouter } from '@solidjs/router'
import { render } from 'solid-js/web'
import { AuthProvider, useAuth } from './lib/AuthContext'

import { sendUserToBackend } from './lib/utils'
import './assets/main.css'
import logo from './assets/deepWork.svg'
import { IconSettings } from './components/ui/icons'
import { Button } from './components/ui/button'

// Lazy load the components
const Login = lazy(() => import('./Login'))
const Signup = lazy(() => import('./Signup'))
const Home = lazy(() => import('./Home'))
const HelloWorld = () => <h1>Hello World!</h1>
const BarChart = lazy(() => import('./BarChart'))

const Onboarding = lazy(() => import('./Onboarding'))

const Settings = lazy(() => import('./Settings'))

const App = (props: ComponentProps<typeof Router>) => {
  const [isLoggedIn, setIsLoggedIn] = useAuth()
  const [isNewUser, setIsNewUser] = createSignal(true)
  const location = useLocation()

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
  }

  const NavBar = () => (
    <>
      <header class="flex justify-between items-center p-4 bg-gray-800 w-full">
        <img alt="logo" class="logo" src={logo} />
        <nav class="flex space-x-4">
          {!isLoggedIn() ? (
            <>
              {isNewUser() ? (
                location.pathname !== '/signup' ? (
                  <A href="/signup" class="bg-blue-500 px-4 py-2 rounded text-white">
                    Sign Up
                  </A>
                ) : (
                  <A href="/login" class="bg-blue-500 px-4 py-2 rounded text-white">
                    Login
                  </A>
                )
              ) : (
                // Show Login by default for returning users
                <A href="/login" class="bg-blue-500 px-4 py-2 rounded text-white">
                  Login
                </A>
              )}
            </>
          ) : (
            <>
              <A href="/" class="bg-blue-500 px-4 py-2 rounded text-white">
                Home
              </A>
              <A href="/analytics" class="bg-green-500 px-4 py-2 rounded text-white">
                Analytics
              </A>
              <A
                href="/settings"
                class="bg-gray-500 px-4 py-2 rounded text-white flex items-center"
              >
                <IconSettings class="w-5 h-5 mr-2" />
                Settings
              </A>
              <Button onClick={handleLogout} class="bg-red-500 px-4 py-2 rounded text-white">
                Logout
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
