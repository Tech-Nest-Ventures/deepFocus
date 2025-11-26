import { createSignal, JSX } from 'solid-js'
import { cn } from '../../lib/utils'

interface ToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  class?: string
  'aria-label'?: string
}

const Toggle = (props: ToggleProps) => {
  const handleClick = () => {
    if (!props.disabled) {
      props.onCheckedChange(!props.checked)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props['aria-label'] || 'Toggle'}
      disabled={props.disabled}
      onClick={handleClick}
      class={cn(
        'relative inline-flex items-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed',
        props.class
      )}
      style={{
        'width': '60px',
        'height': '36px',
        'border-radius': '0', // Swiss Typography: No rounded corners
        'border': '2px solid hsl(var(--foreground))',
        'padding': '3px',
        'cursor': props.disabled ? 'not-allowed' : 'pointer',
        'background-color': props.checked ? 'hsl(var(--foreground))' : 'hsl(var(--muted))',
        'box-sizing': 'border-box'
      }}
    >
      {/* Toggle thumb - Apple-inspired design */}
      <span
        class="inline-block transition-all duration-300 ease-in-out"
        style={{
          'width': '26px',
          'height': '26px',
          'background-color': props.checked ? 'hsl(var(--background))' : 'hsl(var(--foreground))',
          'border': '2px solid hsl(var(--foreground))',
          'display': 'block',
          'box-sizing': 'border-box',
          'transform': props.checked ? 'translateX(24px)' : 'translateX(0px)',
          'box-shadow': props.checked ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}
      />
    </button>
  )
}

export { Toggle }
export type { ToggleProps }

