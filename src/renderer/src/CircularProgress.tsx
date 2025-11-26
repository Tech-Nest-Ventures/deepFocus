import { createEffect } from 'solid-js'

const CircularProgress = (props: { progress: number }) => {
  createEffect(() => {
    console.log('Progress value inside CircularProgress createEffect:', props.progress)
  })

  // Ensure that progress never exceeds 100% (clamp to 1)
  const clampedProgress = () => Math.min(props.progress, 1)
  const percentage = () => Math.min(Math.round(props.progress * 100), 100)

  return (
    <div class="w-full" style={{ 'margin-bottom': '32px' }}>
      {/* Swiss Typography: Clear metric display - Monospaced for precision */}
      <div class="flex items-baseline" style={{ 'gap': '24px', 'margin-bottom': '32px' }}>
        <span class="swiss-metric" style={{ 'font-size': '2.5rem', 'font-weight': 900, 'color': 'hsl(var(--foreground))' }}>{percentage()}</span>
        <span class="swiss-label" style={{ 'font-size': '0.875rem' }}>PERCENT</span>
      </div>
      
      {/* Swiss Typography: Minimal progress bar - Clean, high contrast */}
      <div class="w-full" style={{ 'border': '2px solid hsl(var(--foreground))', height: '8px', 'margin-bottom': '16px' }}>
        <div
          class="h-full transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress() * 100}%`, 'background-color': 'hsl(var(--foreground))' }}
        />
      </div>
      
      {/* Swiss Typography: Secondary metric - Progress indicator */}
      <div class="flex items-baseline" style={{ 'gap': '8px' }}>
        <span class="swiss-label">PROGRESS</span>
      </div>
    </div>
  )
}

export default CircularProgress
