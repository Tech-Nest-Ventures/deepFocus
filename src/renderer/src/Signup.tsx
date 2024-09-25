import { createForm } from '@modular-forms/solid'
import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { email, object, string, pipe, minLength } from 'valibot'
import { IconBrandGithub, IconLoader } from './components/ui/icons'
import { Button } from './components/ui/button'
import { Grid } from './components/ui/grid'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'
import { sendUserToBackend } from './lib/utils'
import User from './types'
import { API_BASE_URL } from './config'
import { useAuth } from './lib/AuthContext'

import type { SubmitHandler } from '@modular-forms/solid'
import type { InferInput } from 'valibot'

export const AuthSchema = object({
  email: pipe(string(), email()),
  password: pipe(string(), minLength(8)),
  firstName: pipe(string(), minLength(2)),
  lastName: pipe(string(), minLength(2)),
  country: pipe(string(), minLength(4)),
  language: pipe(string(), minLength(4))
})

export type AuthForm = InferInput<typeof AuthSchema>

function Signup() {
  const [authForm, { Form, Field }] = createForm<AuthForm>()
  const [signUpError, setSignUpError] = createSignal<null | string>(null)
  const navigate = useNavigate()
  const [loggedIn, setIsLoggedIn] = useAuth()

  const handleSubmit: SubmitHandler<AuthForm> = async (values) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          country: values.country,
          language: values.language
        })
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      console.log('User signed up successfully:', result)

      const { token, user } = result as { token: string; user: User }

      // Store token and user info in localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      sendUserToBackend(user)
      setIsLoggedIn(true)
      navigate('/')
      console.info('Navigating to home')
    } catch (error) {
      console.error('Signup error:', error)
      setSignUpError('Sign-up failed. Please try again.')
    }
  }

  return (
    <div class="grid gap-6">
      {signUpError && <p class="text-red-500">{signUpError()}</p>}
      <Form onSubmit={handleSubmit}>
        <Grid class="gap-4">
          <Field name="firstName">
            {(_, props) => (
              <TextField class="gap-1">
                <TextFieldLabel class="sr-only">First Name</TextFieldLabel>
                <TextFieldInput {...props} type="text" placeholder="First Name" />
              </TextField>
            )}
          </Field>
          <Field name="lastName">
            {(_, props) => (
              <TextField class="gap-1">
                <TextFieldLabel class="sr-only">Last Name</TextFieldLabel>
                <TextFieldInput {...props} type="text" placeholder="Last Name" />
              </TextField>
            )}
          </Field>
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
          <Field name="country">
            {(_, props) => (
              <TextField class="gap-1">
                <TextFieldLabel class="sr-only">Country</TextFieldLabel>
                <TextFieldInput {...props} type="text" placeholder="Country" />
              </TextField>
            )}
          </Field>
          <Field name="language">
            {(_, props) => (
              <TextField class="gap-1">
                <TextFieldLabel class="sr-only">Language</TextFieldLabel>
                <TextFieldInput {...props} type="text" placeholder="Language of preference" />
              </TextField>
            )}
          </Field>
          <Button type="submit" disabled={authForm.submitting}>
            {authForm.submitting && <IconLoader class="mr-2 size-4 animate-spin" />}
            Sign Up
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

export default Signup
