import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-border bg-input px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  onIconClick?: () => void
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, icon, onIconClick, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          className={cn(
            'flex h-14 w-full rounded-xl border border-border bg-[#111] px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            icon ? 'pr-12' : '',
            className,
          )}
          ref={ref}
          {...props}
        />
        {icon && (
          <button
            type="button"
            tabIndex={-1}
            onClick={onIconClick}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {icon}
          </button>
        )}
      </div>
    )
  },
)
InputField.displayName = 'InputField'

export { Input, InputField }
