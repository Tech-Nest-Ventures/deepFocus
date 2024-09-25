import { lazy, Suspense, onMount, createSignal, ComponentProps } from 'solid-js'
import { Router, Route, A, useLocation } from '@solidjs/router'
import { render } from 'solid-js/web'
import { AuthProvider, useAuth } from './lib/AuthContext'

import { sendUserToBackend } from './lib/utils'
import './assets/main.css'
import logo from './assets/deepWork.svg'

// Lazy load the components
const Login = lazy(() => import('./Login'))
const Signup = lazy(() => import('./Signup'))
const Versions = lazy(() => import('./Versions'))
const HelloWorld = () => <h1>Hello World!</h1>

const App = (props: ComponentProps<typeof Router>) => {
  const [isLoggedIn, setIsLoggedIn] = useAuth()
  const [isNewUser, setIsNewUser] = createSignal(true)
  const location = useLocation()

  // Check for the token in localStorage on component mount
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
    localStorage.removeItem('token')
    setIsLoggedIn(false)
    setIsNewUser(false)
  }

  return (
    <>
      <header class="flex justify-between items-center p-4 bg-gray-800 w-full mb-20">
        <img alt="logo" class="logo" src={logo} />
        <div class="text">
          the future of <span class="solid">deep</span>
          <span class="ts">Focus</span>
        </div>
        <p>
          <button id="new-window">Create new window</button>
        </p>
        <nav class="flex space-x-4">
          <A href="/" class="bg-blue-500 px-4 py-2 rounded text-white">
            Home
          </A>
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
            <button onClick={handleLogout} class="bg-red-500 px-4 py-2 rounded text-white">
              Logout
            </button>
          )}
        </nav>
      </header>

      {props.children}
    </>
  )
}

render(
  () => (
    <AuthProvider>
      <Router root={App}>
        <Suspense fallback={<div>Loading...</div>}>
          <Route path="/" component={Versions} />
          <Route path="/login" component={Login} />
          <Route path="/hello-world" component={HelloWorld} />
          <Route path="/signup" component={Signup} />
        </Suspense>
      </Router>
    </AuthProvider>
  ),
  document.getElementById('root') as HTMLElement
)
