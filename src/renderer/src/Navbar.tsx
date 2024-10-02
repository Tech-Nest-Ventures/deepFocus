import { Button } from './components/ui/button'
import { IconSettings } from './components/ui/icons'
import { A } from '@solidjs/router'
import logo from './assets/deepWork.svg'

const Navbar = (props) => {
  const { isLoggedIn, handleLogout, isNewUser } = props

  return (
    <>
      <header class="flex justify-between items-center p-4 bg-gray-800 w-full">
        <img alt="logo" class="logo" src={logo} />
        <nav class="flex space-x-4">
          {!isLoggedIn() ? (
            <>
              {isNewUser() ? (
                <>
                  <A href="/signup" class="bg-blue-500 px-4 py-2 rounded text-white">
                    Sign Up
                  </A>
                  <A href="/login" class="bg-blue-500 px-4 py-2 rounded text-white">
                    Login
                  </A>
                </>
              ) : (
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
}

export default Navbar
