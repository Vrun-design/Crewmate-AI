import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  rounded?: 'md' | 'lg' | 'full';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', rounded = 'lg', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'btn-bevel inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none shrink-0',
          {
            'btn-bevel-primary': variant === 'primary',
            'btn-bevel-secondary': variant === 'secondary',
            'btn-bevel-danger': variant === 'danger',
            'bg-transparent border-transparent hover:bg-accent text-foreground shadow-none': variant === 'ghost',
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
            'rounded-md': rounded === 'md',
            'rounded-lg': rounded === 'lg',
            'rounded-full': rounded === 'full',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
