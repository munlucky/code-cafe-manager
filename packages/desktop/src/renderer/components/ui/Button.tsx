import { cn } from '../../utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded transition-colors font-medium',
        variant === 'primary' &&
          'bg-coffee hover:bg-coffee/90 text-white',
        variant === 'secondary' &&
          'bg-gray-700 hover:bg-gray-600 text-white',
        className
      )}
      {...props}
    />
  );
}
