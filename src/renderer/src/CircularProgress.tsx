import { createEffect } from 'solid-js'
const CircularProgress = (props) => {
  const radius = 45
  const circumference = 2 * Math.PI * radius

  console.log('Progress value inside CircularProgress:', props.progress)
  createEffect(() => {
    console.log('Progress value inside CircularProgress createEffect:', props.progress)
  })

  return (
    <div class="circular-progress">
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
          stroke-dashoffset={(1 - props.progress) * circumference}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div class="text-center mt-2">
        <p>Progress: {props.progress ? Math.round(props.progress * 100) : 0}%</p>
      </div>
    </div>
  )
}

export default CircularProgress
