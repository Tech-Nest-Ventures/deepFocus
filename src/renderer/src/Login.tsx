import type { SubmitHandler } from '@modular-forms/solid'
import { createSignal } from 'solid-js'
import { createForm } from '@modular-forms/solid'
import { useNavigate } from '@solidjs/router'
import { Motion } from 'solid-motionone'
// import { email, object, string, pipe, minLength, safeParse } from 'valibot'

import { sendUserToBackend } from './lib/utils'
import { IconLoader } from './components/ui/icons'
import { Button } from './components/ui/button'
import { Grid } from './components/ui/grid'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'
import User from './types'
import { API_BASE_URL } from './config'
import { useAuth } from './lib/AuthContext'

// import type { InferInput } from 'valibot'

console.log(`Server URL: ${API_BASE_URL}`)

// export const AuthSchema = object({
//   email: pipe(string(), email()),
//   password: pipe(string(), minLength(8))
// })

// export type AuthForm = InferInput<typeof AuthSchema>

function Login() {
  const [authForm, { Form, Field }] = createForm()
  const [_loginError, setLoginError] = createSignal<null | string>(null)
  const navigate = useNavigate()
  const [_loggedIn, setIsLoggedIn] = useAuth()

  const handleSubmit: SubmitHandler<any> = async (values) => {
    try {
      console.log('Values are ', values)

      console.log('Login values are ', values)
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: values.email,
          password: values.password
        })
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      const { token, user } = result as { token: string; user: User }

      // Store token and user info in localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      sendUserToBackend(user)
      setIsLoggedIn(true)
      navigate('/')
    } catch (error) {
      console.error('Login error:', error)
      setLoginError('Login failed. Please try again.')
    }
  }

  return (
    <Motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.5, easing: "ease-in-out" }}
  >
    <div class="grid gap-6 mt-20">
      <h2 class="text-2xl font-light">Login</h2>
      <Form onSubmit={handleSubmit}>
        <Grid class="gap-4">
          <Field name="email">
            {(_, props) => (
              <TextField class="gap-1">
                <TextFieldLabel class="sr-only">Email</TextFieldLabel>
                <TextFieldInput {...props} type="email" placeholder="me@email.com" />
              </TextField>
            )}
          </Field>
          <Field name="password">
            {(_, props) => (
              <TextField class="gap-1">
                <TextFieldLabel class="sr-only">Password</TextFieldLabel>
                <TextFieldInput {...props} type="password" placeholder="Enter your password" />
              </TextField>
            )}
          </Field>
          <Button type="submit" disabled={authForm.submitting}>
            {authForm.submitting && <IconLoader class="mr-2 size-4 animate-spin" />}
            Login
          </Button>
        </Grid>
      </Form>
      <p class="text-gray-500 text-sm">
        Don't have an account?{' '}
        <a href="/signup" class="text-blue-500">
          Sign Up
        </a>
      </p>
    </div>
    </Motion.div>
  )
}

export default Login
