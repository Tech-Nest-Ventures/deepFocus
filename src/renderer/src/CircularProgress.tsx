import { createEffect } from 'solid-js'

const CircularProgress = (props) => {
  const radius = 45
  const circumference = 2 * Math.PI * radius

  createEffect(() => {
    console.log('Progress value inside CircularProgress createEffect:', props.progress)
  })

  // Ensure that progress never exceeds 100%
  const clampedProgress = Math.min(props.progress, 1)

  return (
    <div class="circular-progress flex items-center">
      {/* Circular Progress SVG */}
      <svg height="100" width="100">
        <circle stroke="grey" fill="transparent" r={radius} cx="50" cy="50" stroke-width="10" />
        <circle
          stroke="white"
          fill="transparent"
          r={radius}
          cx="50"
          cy="50"
          stroke-width="10"
          stroke-dasharray={String(circumference)}
          stroke-dashoffset={(1 - clampedProgress) * circumference}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>

      <div class="ml-4">
        <p>Progress: {props.progress ? Math.min(Math.round(props.progress * 100), 100) : 0}%</p>
      </div>
    </div>
  )
}

export default CircularProgress
