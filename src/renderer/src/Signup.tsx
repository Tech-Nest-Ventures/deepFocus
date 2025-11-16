import { createForm } from '@modular-forms/solid'
import { createSignal, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { IconLoader, AiOutlineEye, AiOutlineEyeInvisible } from './components/ui/icons'
import { Button } from './components/ui/button'
import { Grid } from './components/ui/grid'
import { TextField, TextFieldInput, TextFieldLabel } from './components/ui/text-field'
import { sendUserToBackend } from './lib/utils'
import User from './types'
import { API_BASE_URL } from './config'
import { useAuth } from './lib/AuthContext'
import countries from 'world-countries'
import 'flag-icons/css/flag-icons.min.css'
import { Motion } from 'solid-motionone'

import type { SubmitHandler } from '@modular-forms/solid'
// import type { InferInput } from 'valibot'

// export const AuthSchema = object({
//   email: pipe(string(), email()),
//   password: pipe(string(), minLength(8)),
//   confirmPassword: pipe(string(), minLength(8)),
//   firstName: pipe(string(), minLength(2)),
//   lastName: pipe(string(), minLength(2)),
//   country: pipe(string(), minLength(2)),
//   language: pipe(string(), minLength(2))
// })

// export type AuthForm = InferInput<typeof AuthSchema>

function Signup() {
  const [authForm, { Form, Field }] = createForm()
  const [signUpError, setSignUpError] = createSignal<null | string>(null)
  const [showPassword, setShowPassword] = createSignal(false) // Signal to toggle password visibility
  const [showConfirmPassword, setShowConfirmPassword] = createSignal(false) // Signal to toggle confirm password visibility
  const [selectedCountry, setSelectedCountry] = createSignal('')
  const [selectedLanguage, setSelectedLanguage] = createSignal('')
  const navigate = useNavigate()
  const [_loggedIn, setIsLoggedIn] = useAuth()

  const countryOptions = countries.map((country) => ({
    name: country.name.common,
    code: country.cca2.toLowerCase(), // ISO Alpha-2 code for flag-icons
    languages: Object.values(country.languages || {})
  }))

  const handleSubmit: SubmitHandler<any> = async (values) => {
    try {
      if (values.password !== values.confirmPassword) {
        setSignUpError('Passwords do not match')
        return
      }

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
          country: selectedCountry(),
          language: selectedLanguage()
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
      localStorage.setItem('onboarded', 'false')
      sendUserToBackend(user)
      setIsLoggedIn(true)
      navigate('/onboarding')
      console.info('Navigating to Onboarding')
    } catch (error) {
      console.error('Signup error:', error)
      setSignUpError('Sign-up failed. Please try again.')
    }
  }

  return (
    <Motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, easing: "ease-out" }}
  >
    {/* Swiss Typography: Left-aligned, asymmetric layout, extreme whitespace */}
    <div class="flex justify-start items-start h-full flex-col p-swiss-10 space-y-swiss-8 max-w-2xl">
      <h2 class="text-2xl font-extrabold tracking-tight uppercase mb-swiss-4">CREATE AN ACCOUNT</h2>
      <p class="text-muted-foreground text-lg font-normal w-full mb-swiss-6">
        GAIN INSIGHTS INTO HOW YOU SPEND YOUR TIME TODAY.
      </p>
      {signUpError && <p class="text-destructive font-semibold uppercase">{signUpError()}</p>}
      <Form onSubmit={handleSubmit}>
        <Grid class="gap-swiss-4">
          <Field name="firstName">
            {(_, props) => (
              <TextField class="gap-swiss-1">
                <TextFieldLabel class="sr-only">First Name</TextFieldLabel>
                <TextFieldInput {...props} type="text" placeholder="FIRST NAME" class="uppercase" />
              </TextField>
            )}
          </Field>
          <Field name="lastName">
            {(_, props) => (
              <TextField class="gap-swiss-1">
                <TextFieldLabel class="sr-only">Last Name</TextFieldLabel>
                <TextFieldInput {...props} type="text" placeholder="LAST NAME" class="uppercase" />
              </TextField>
            )}
          </Field>
          <Field name="email">
            {(_, props) => (
              <TextField class="gap-swiss-1">
                <TextFieldLabel class="sr-only">Email</TextFieldLabel>
                <TextFieldInput {...props} type="email" placeholder="ME@EMAIL.COM" class="uppercase" />
              </TextField>
            )}
          </Field>

          {/* Password Field with Toggle */}
          <Field name="password">
            {(_, props) => (
              <TextField class="gap-swiss-1 relative">
                <TextFieldLabel class="sr-only">Password</TextFieldLabel>
                <TextFieldInput
                  {...props}
                  type={showPassword() ? 'text' : 'password'}
                  placeholder="ENTER YOUR PASSWORD"
                  class="uppercase"
                />
                <span
                  class="absolute right-3 top-3 cursor-pointer"
                  onClick={() => setShowPassword(!showPassword())}
                >
                  {showPassword() ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </span>
              </TextField>
            )}
          </Field>

          {/* Confirm Password Field with Toggle */}
          <Field name="confirmPassword">
            {(_, props) => (
              <TextField class="gap-swiss-1 relative">
                <TextFieldLabel class="sr-only">Confirm Password</TextFieldLabel>
                <TextFieldInput
                  {...props}
                  type={showConfirmPassword() ? 'text' : 'password'}
                  placeholder="CONFIRM YOUR PASSWORD"
                  class="uppercase"
                />
                <span
                  class="absolute right-3 top-3 cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword())}
                >
                  {showConfirmPassword() ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </span>
              </TextField>
            )}
          </Field>

          <Field name="country">
            {(_, _props) => (
              <div>
                <div class="flex items-center">
                  <select
                    id="country"
                    class="mt-1 block w-full p-3 border-2 border-foreground bg-inherit uppercase font-semibold"
                    value={selectedCountry()}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                  >
                    <option value="" disabled>
                      SELECT COUNTRY
                    </option>
                    <For each={countryOptions}>
                      {(country) => <option value={country.code}>{country.name.toUpperCase()}</option>}
                    </For>
                  </select>
                  {selectedCountry() && (
                    <span
                      class={`fi fi-${selectedCountry()} ml-swiss-4`}
                      style={{ 'font-size': '24px' }}
                      aria-label={`Flag of ${selectedCountry()}`}
                    />
                  )}
                </div>
              </div>
            )}
          </Field>

          <Field name="language">
            {(_, _props) => (
              <div>
                <select
                  id="language"
                  class="mt-1 block w-full p-3 border-2 border-foreground bg-inherit uppercase font-semibold"
                  value={selectedLanguage()}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  <option value="" disabled>
                    SELECT LANGUAGE
                  </option>
                  {
                    <For
                      each={
                        countryOptions.find((country) => country.code === selectedCountry())
                          ?.languages
                      }
                    >
                      {(language) => <option value={language}>{language.toUpperCase()}</option>}
                    </For>
                  }
                </select>
              </div>
            )}
          </Field>

          <Button type="submit" disabled={authForm.submitting} size="lg">
            {authForm.submitting && <IconLoader class="mr-2 size-4 animate-spin" />}
            SIGN UP
          </Button>
        </Grid>
      </Form>
      <p class="text-muted-foreground text-sm font-normal">
        ALREADY HAVE AN ACCOUNT?{' '}
        <a href="/login" class="text-foreground font-bold underline uppercase">
          LOGIN
        </a>
      </p>
    </div>
    </Motion.div>
  )
}

export default Signup
