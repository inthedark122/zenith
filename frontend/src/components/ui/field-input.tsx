import * as React from 'react'

import { cn } from '@/lib/utils'

import { Input } from './input'

interface FieldInputProps extends React.ComponentPropsWithoutRef<'input'> {
  trailingIcon?: React.ReactNode
  onTrailingIconClick?: () => void
  error?: string
}

const FieldInput = React.forwardRef<HTMLInputElement, FieldInputProps>(
  ({ trailingIcon, onTrailingIconClick, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <Input ref={ref} className={cn(trailingIcon && 'pr-14', className)} {...props} />
          {trailingIcon && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onTrailingIconClick}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {trailingIcon}
            </button>
          )}
        </div>
        {error && <p className="text-destructive text-xs px-1">{error}</p>}
      </div>
    )
  },
)
FieldInput.displayName = 'FieldInput'

export { FieldInput }
