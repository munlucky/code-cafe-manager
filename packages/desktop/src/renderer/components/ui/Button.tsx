import { cn } from '../../utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

// Base styles for the button
const baseStyles = 'rounded transition-colors font-medium';

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
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
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
