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
      if (step() === 6) {
        navigate('/')
      } else {
        setStep(step() + 1)
        setFadeIn(true) // Fade-in for the next step
      }
    }, 1500) // Match the fade-out transition time
  }

  return (
    <div class="relative h-screen flex flex-col justify-center items-center">
      <div
        class={`text-center transition-opacity max-w-[70%] duration-1500 ease-in-out ${fadeIn() ? 'opacity-100' : 'opacity-0'}`}
      >
        {step() === 1 && (
          <>
            <h1 class="mb-10 text-xl font-light">
              We're glad to have you here, {user?.firstName}!
            </h1>
            <p class="mb-10 text-l font-extralight">
              Deep Focus is a productivity tool that helps you stay focused and productive by
              tracking your time spent on your computer.
            </p>
            <img src={"resources/DOG_MEME.avif"} alt="DeepFocus Logo" class="w-45" />
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

      {/* Conditional rendering for each component on steps 4, 5, and 6 */}
      {step() === 4 && (
        <>
          <p class="mb-10 text-xl font-extralight max-w-[70%]">
            1. Let's add websites you'd consider to be unproductive.
          </p>
          <p class="mb-10 text-medium font-extralight max-w-[70%]">
            We've found social media sites (facebook, twitter, etc.) to be the most unproductive.
          </p>
          <UnproductiveWebsites />
        </>
      )}
      {step() === 5 && (
        <>
          <p class="mb-10 text-xl font-extralight max-w-[70%]">
            2. Let's add apps you'd consider to be unproductive.
          </p>

          <UnproductiveApps />
        </>
      )}
      {step() === 6 && (
        <>
          <p class="mb-10 text-xl font-extralight max-w-[70%]">
            Set your target deep work time for the day.
          </p>
          <p class="mb-5 text-medium font-extralight max-w-[70%]">
            On a good day, how many hours of deep work do you consider to be a productive day?
            </p>
          <DeepWorkSlider />
        </>
      )}

      <Button class="mt-4" onClick={handleNext}>
        {step() === 6 ? 'Finish' : 'Next'}
      </Button>
    </div>
  )
}

export default Onboarding
