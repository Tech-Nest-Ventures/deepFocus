import { createSignal } from 'solid-js'
import UnproductiveApps from './UnproductiveApps'
import UnproductiveWebsites from './UnproductiveWebsites'
import DeepWorkSlider from './DeepWorkSlider'
import { Button } from './components/ui/button'
import { useNavigate } from '@solidjs/router'

const Onboarding = () => {
  const [step, setStep] = createSignal(1)
  const navigate = useNavigate()

  const handleNext = () => {
    if (step() === 3) {
      navigate('/analytics')
    } else {
      setStep(step() + 1)
    }
  }

  return (
    <div>
      {step() === 1 && <UnproductiveWebsites />}
      {step() === 2 && <UnproductiveApps />}
      {step() === 3 && <DeepWorkSlider />}
      <Button class="mt-4" onClick={handleNext}>
        {step() === 3 ? 'Finish' : 'Next'} {/* Change button text to 'Finish' on the last step */}
      </Button>
    </div>
  )
}

export default Onboarding
