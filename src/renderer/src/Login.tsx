import type { SubmitHandler } from '@modular-forms/solid'
import { createSignal } from 'solid-js'
import { createForm } from '@modular-forms/solid'
import { useNavigate } from '@solidjs/router'
import { email, object, string, pipe, minLength, safeParse } from 'valibot'

import { sendUserToBackend } from './lib/utils'
import { IconBrandGithub, IconLoader } from './components/ui/icons'
import { Button } from './components/ui/button'
import { Grid } from './components/ui/grid'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'
import User from './types'
import { API_BASE_URL } from './config'

import type { InferInput } from 'valibot'

console.log(`Server URL: ${API_BASE_URL}`)

export const AuthSchema = object({
  email: pipe(string(), email()),
  password: pipe(string(), minLength(8))
})

// Example usage
const result = safeParse(AuthSchema, {
  email: 'jane@example.com',
  password: '12345678'
})

console.log(result)
export type AuthForm = InferInput<typeof AuthSchema>

function Login() {
  const [authForm, { Form, Field }] = createForm<AuthForm>()
  const [_loginError, setLoginError] = createSignal<null | string>(null)
  const navigate = useNavigate()

  const handleSubmit: SubmitHandler<AuthForm> = async (values) => {
    try {
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
      navigate('/')
    } catch (error) {
      console.error('Login error:', error)
      setLoginError('Login failed. Please try again.')
    }
  }

  return (
    <div class="grid gap-6">
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
          <Field name="email">
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
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <Button variant="outline" type="button" disabled={authForm.submitting}>
        {authForm.submitting ? (
          <IconLoader class="mr-2 size-4 animate-spin" />
        ) : (
          <IconBrandGithub class="mr-2 size-4" />
        )}{' '}
        Github
      </Button>
    </div>
  )
}

export default Login
