import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
};

// Base styles for the button
const baseStyles = 'rounded transition-colors font-medium inline-flex items-center justify-center';

// Size-specific styles
const sizeStyles = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
};

// Variant-specific styles
const variantStyles = {
  primary: 'bg-coffee hover:bg-coffee/90 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  outline: 'bg-transparent border border-gray-600 hover:bg-gray-800 text-white',
  ghost: 'bg-transparent hover:bg-gray-800 text-white',
  destructive: 'bg-red-800 hover:bg-red-700 text-white',
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
