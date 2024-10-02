import { createSignal, For } from 'solid-js'
import UnproductiveApps from './UnproductiveApps'
import UnproductiveWebsites from './UnproductiveWebsites'
import { Button } from './components/ui/button'
import { useNavigate } from '@solidjs/router'

const Onboarding = () => {
  const [step, setStep] = createSignal(1)
  const [unproductiveSites, setUnproductiveSites] = createSignal<string[]>([])
  const [unproductiveApps, setUnproductiveApps] = createSignal<string[]>([])
  const navigate = useNavigate()

  const handleNext = () => {
    if (step() === 2) {
      navigate('/analytics')
    } else {
      setStep(step() + 1)
    }
  }
  return (
    <div>
      {step() === 1 && (
        <UnproductiveWebsites
          unproductiveSites={unproductiveSites}
          setUnproductiveSites={setUnproductiveSites}
        />
      )}
      {step() === 2 && (
        <UnproductiveApps
          unproductiveApps={unproductiveApps}
          setUnproductiveApps={setUnproductiveApps}
        />
      )}
      <Button class="mt-4" onClick={handleNext}>
        {step() === 2 ? 'Finish' : 'Next'} {/* Change button text to 'Finish' on the last step */}
      </Button>{' '}
    </div>
  )
}
export default Onboarding
