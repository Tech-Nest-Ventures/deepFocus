import { createEffect } from 'solid-js'

const CircularProgress = (props) => {
  createEffect(() => {
    console.log('Progress value inside CircularProgress createEffect:', props.progress)
  })

  // Ensure that progress never exceeds 100% (clamp to 1)
  const clampedProgress = () => Math.min(props.progress, 1)
  const percentage = () => Math.min(Math.round(props.progress * 100), 100)

  return (
    <div class="w-full space-y-swiss-3">
      {/* Swiss Typography: Minimal percentage and progress bar */}
      <div class="flex items-center gap-swiss-4">
        <span class="text-3xl font-extrabold font-mono tracking-tight">{percentage()}</span>
        <div class="flex-1 border-2 border-foreground" style={{ height: '6px' }}>
          <div
            class="bg-foreground h-full transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress() * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default CircularProgress
