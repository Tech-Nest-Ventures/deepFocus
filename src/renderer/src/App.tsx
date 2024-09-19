import { lazy, Suspense, onMount, createSignal } from 'solid-js'
import { Router, Route, A, useLocation } from '@solidjs/router'
import { render } from 'solid-js/web'
import './assets/main.css'

import logo from './assets/deepWork.svg'

// Lazy load the components
const Login = lazy(() => import('./Login'))
const Signup = lazy(() => import('./Signup'))
const Versions = lazy(() => import('./Versions'))
const HelloWorld = () => <h1>Hello World!</h1>

const App = (props) => {
  const [isLoggedIn, setIsLoggedIn] = createSignal(false)
  const location = useLocation()

  // Check for the token in localStorage on component mount
  onMount(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsLoggedIn(true)
    }
  })

  // Logout function to remove the token and set login state to false
  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsLoggedIn(false)
  }

  return (
    <>
      <header class="flex justify-between items-center p-4 bg-gray-800 w-full mb-20">
        <img alt="logo" class="logo" src={logo} />
        <div class="text">
          the future of <span class="solid">deep</span>
          <span class="ts">Focus</span>
        </div>
        <nav class="flex space-x-4">
          <A href="/" class="bg-blue-500 px-4 py-2 rounded text-white">
            Home
          </A>
          {!isLoggedIn() ? (
            <>
              {location.pathname !== '/login' ? (
                <A href="/signup" class="bg-blue-500 px-4 py-2 rounded text-white">
                  Sign Up
                </A>
              ) : (
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
    <Router root={App}>
      <Suspense fallback={<div>Loading...</div>}>
        <Route path="/" component={Versions} />
        <Route path="/login" component={Login} />
        <Route path="/hello-world" component={HelloWorld} />
        <Route path="/signup" component={Signup} />
      </Suspense>
    </Router>
  ),
  document.getElementById('root') as HTMLElement
)
