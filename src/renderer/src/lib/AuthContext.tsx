import { RouterProps } from '@solidjs/router'
import { createContext, useContext, createSignal, Accessor, Setter, JSX } from 'solid-js'

// Create a context with two signals: `isLoggedIn` and `setIsLoggedIn`
type AuthContextType = [Accessor<boolean>, Setter<boolean>]
const AuthContext = createContext<AuthContextType>()

export const AuthProvider = (props: {
  children: number | boolean | Node | JSX.ArrayElement | (string & {}) | null | undefined
}) => {
  const [isLoggedIn, setIsLoggedIn] = createSignal(false) // Create the state here
  return (
    <AuthContext.Provider value={[isLoggedIn, setIsLoggedIn]}>
      {props.children}
    </AuthContext.Provider>
  )
}

// Custom hook to access the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
