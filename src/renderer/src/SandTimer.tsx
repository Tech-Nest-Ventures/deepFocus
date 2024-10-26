import { onMount } from 'solid-js'
import { gsap } from 'gsap'
import logo from './assets/deepWork.svg'

const SandTimer = () => {
  let particleContainerRef

  // Function to create and drop particles
  const createParticles = () => {
    const numberOfParticles = 100 // Number of sand particles

    for (let i = 0; i < numberOfParticles; i++) {
      const particle = document.createElement('div')
      particle.classList.add('sand-particle')
      particleContainerRef.appendChild(particle)

      const delay = i * 0.3 // Delay for each particle to create the falling effect
      const duration = 5 + Math.random() * 5 // Randomize the speed of each particle

      gsap.fromTo(
        particle,
        {
          x: Math.random() * 50 - 25, // Random horizontal position within the top part
          y: 0,
          opacity: 1
        },
        {
          y: 150, // Fall to the bottom of the hourglass
          opacity: 0.9,
          duration,
          ease: 'power1.in',
          delay
        }
      )
    }
  }

  onMount(() => {
    createParticles()
  })

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center' }}>
      <div style={{ position: 'relative', width: '150px', height: '150px' }}>
        <img src={logo} alt="Deep Focus Logo" style={{ width: '100%', height: '100%' }} />

        {/* Particle container */}
        <div
          ref={(el) => (particleContainerRef = el)}
          style={{
            position: 'absolute',
            top: '0',
            left: '65%',
            transform: 'translateX(-50%)',
            width: '50%',
            height: '100%',
            overflow: 'hidden' // Ensure particles don't overflow
          }}
        />
      </div>

      <style>{`
        .sand-particle {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: rgba(255, 165, 0, 0.9);
          position: absolute;
        }
      `}</style>
    </div>
  )
}

export default SandTimer
