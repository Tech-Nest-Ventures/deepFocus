import type { JSX, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'

import * as ButtonPrimitive from '@kobalte/core/button'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  /* Swiss Typography: No rounded corners, clean borders, precise typography */
  'inline-flex items-center justify-center text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 uppercase tracking-wide letter-spacing-0.05em min-w-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-primary',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive',
        outline: 'border-2 border-foreground text-foreground hover:bg-foreground hover:text-background bg-transparent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-secondary',
        ghost: 'hover:bg-accent hover:text-accent-foreground border-2 border-transparent',
        link: 'text-primary underline-offset-4 hover:underline border-0'
      },
      size: {
        default: 'h-12 px-6 py-3', /* Swiss Typography: Generous padding */
        sm: 'h-10 px-4 py-2',
        lg: 'h-14 px-8 py-4',
        icon: 'size-12'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonProps<T extends ValidComponent = 'button'> = ButtonPrimitive.ButtonRootProps<T> &
  VariantProps<typeof buttonVariants> & { class?: string | undefined; children?: JSX.Element }

const Button = <T extends ValidComponent = 'button'>(
  props: PolymorphicProps<T, ButtonProps<T>>
) => {
  const [local, others] = splitProps(props as ButtonProps, ['variant', 'size', 'class'])
  return (
    <ButtonPrimitive.Root
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  )
}

export type { ButtonProps }
export { Button, buttonVariants }
