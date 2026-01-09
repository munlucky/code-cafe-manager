import { cn } from '../../utils/cn';

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 bg-background border border-border rounded text-bone',
        'focus:outline-none focus:ring-2 focus:ring-coffee/50',
        'placeholder:text-gray-500',
        className
      )}
      {...props}
    />
  );
}
