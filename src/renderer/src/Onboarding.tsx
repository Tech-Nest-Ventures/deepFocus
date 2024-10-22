import { createSignal } from 'solid-js'
import UnproductiveApps from './UnproductiveApps'
import UnproductiveWebsites from './UnproductiveWebsites'
import DeepWorkSlider from './DeepWorkSlider'
import { Button } from './components/ui/button'
import { useNavigate } from '@solidjs/router'
import User from './types'

const Onboarding = () => {
  const [step, setStep] = createSignal(1)
  const [fadeIn, setFadeIn] = createSignal(true) // Control fade-in/out
  const navigate = useNavigate()

  const user = localStorage.getItem('user')
    ? (JSON.parse(localStorage.getItem('user') as string) as User)
    : undefined

  // Handle transitions between steps
  const handleNext = () => {
    setFadeIn(false) // Start fade-out effect

    // Wait for the fade-out animation to complete before switching steps
    setTimeout(() => {
      if (step() === 3) {
        navigate('/analytics')
      } else {
        setStep(step() + 1)
        setFadeIn(true) // Fade-in for the next step
      }
    }, 1500) // Match the fade-out transition time
  }

  return (
    <div class="relative h-screen flex flex-col justify-center items-center">
      <div
        class={`text-center transition-opacity duration-1500 ease-in-out ${fadeIn() ? 'opacity-100' : 'opacity-0'}`}
      >
        {step() === 1 && (
          <>
            <h1 class="mb-10 text-2xl font-light">
              We're glad to have you here, {user?.firstName}!
            </h1>
            <p class="mb-10 text-xl font-extralight">
              Deep Focus is a productivity tool that helps you stay focused and productive by
              tracking your time spent on your computer.
            </p>
          </>
        )}
        {step() === 2 && (
          <p class="mb-10 text-xl font-extralight">
            DeepFocus helps you achieve your goals by minimizing distractions and maximizing
            productive time.
          </p>
        )}
        {step() === 3 && (
          <p class="mb-10 text-xl font-extralight">
            Let’s walk you through how to get the most out of DeepFocus.
          </p>
        )}
      </div>

      {step() === 1 && <UnproductiveWebsites />}
      {step() === 2 && <UnproductiveApps />}
      {step() === 3 && <DeepWorkSlider />}

      <Button class="mt-4" onClick={handleNext}>
        {step() === 3 ? 'Finish' : 'Next'}
      </Button>
    </div>
  )
}

export default Onboarding
