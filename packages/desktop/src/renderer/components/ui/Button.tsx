import { cn } from '../../utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded transition-colors font-medium',
        size === 'sm' && 'px-3 py-1 text-sm',
        size === 'md' && 'px-4 py-2',
        size === 'lg' && 'px-6 py-3 text-lg',
        variant === 'primary' &&
          'bg-coffee hover:bg-coffee/90 text-white',
        variant === 'secondary' &&
          'bg-gray-700 hover:bg-gray-600 text-white',
        variant === 'outline' &&
          'bg-transparent border border-gray-600 hover:bg-gray-800 text-white',
        variant === 'ghost' &&
          'bg-transparent hover:bg-gray-800 text-white',
        className
      )}
      {...props}
    />
  );
}
