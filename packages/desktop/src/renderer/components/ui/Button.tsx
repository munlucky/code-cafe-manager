import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
};

// Base styles for the button
const baseStyles = 'rounded-lg transition-all duration-200 font-medium inline-flex items-center justify-center';

// Size-specific styles
const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
};

// Variant-specific styles
const variantStyles = {
  primary: 'bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/20',
  secondary: 'bg-cafe-800 hover:bg-cafe-700 text-cafe-100',
  outline: 'bg-transparent border border-cafe-700 hover:bg-cafe-800 text-cafe-300',
  ghost: 'bg-transparent hover:bg-cafe-800 text-cafe-300',
  destructive: 'bg-red-800 hover:bg-red-700 text-white shadow-lg shadow-red-900/20',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
