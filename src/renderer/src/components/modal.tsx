import { onMount, onCleanup } from 'solid-js'
import { IconX } from './ui/icons'

const Modal = (props: { title?: string; onClose: () => void; children?: any }) => {
  // Disable body scroll when modal is open
  let originalOverflow = ''
  
  onMount(() => {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  })
  
  // Cleanup: restore scroll when modal closes
  onCleanup(() => {
    document.body.style.overflow = originalOverflow
  })

  return (
    <div 
      class="fixed inset-0 z-50 flex items-center justify-center" 
      style={{ 
        'background-color': 'rgba(0, 0, 0, 0.85)',
        'backdrop-filter': 'blur(8px)',
        '-webkit-backdrop-filter': 'blur(8px)',
        'overflow-x': 'hidden',
        'overflow-y': 'hidden'
      }}
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          props.onClose()
        }
      }}
    >
      <div 
        class="bg-black border-2 border-foreground" 
        style={{ 
          'max-width': 'calc(100vw - 128px)',
          'max-height': '85vh',
          'width': '400px',
          'padding': '40px',
          'overflow-y': 'auto',
          'overflow-x': 'hidden',
          'box-sizing': 'border-box',
          'margin': '0',
          'position': 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex justify-between items-center" style={{ 'margin-bottom': '32px', 'flex-shrink': 0 }}>
          {props.title && <h2 class="swiss-heading" style={{ 'font-size': '1.25rem' }}>{props.title}</h2>}
          <button 
            class="text-foreground hover:opacity-70 transition-opacity duration-200" 
            onClick={props.onClose}
            style={{ 
              'padding': '8px', 
              'background': 'transparent', 
              'border': '2px solid hsl(var(--foreground))', 
              'cursor': 'pointer', 
              'flex-shrink': 0,
              'min-width': '36px',
              'min-height': '36px',
              'display': 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'margin-left': 'auto',
              'color': 'hsl(var(--foreground))'
            }}
            aria-label="Close"
          >
            <IconX style={{ 'width': '20px', 'height': '20px', 'stroke-width': '2.5' }} />
          </button>
        </div>
        <div style={{ 'overflow-y': 'auto', 'overflow-x': 'hidden' }}>{props.children}</div>
      </div>
    </div>
  )
}

export default Modal
