import { cn } from '../../utils/cn';

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full px-3 py-2 bg-cafe-950 border border-cafe-700 rounded-lg text-cafe-200',
        'focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent',
        'placeholder:text-cafe-500',
        'transition-colors',
        'resize-none',
        className
      )}
      {...props}
    />
  );
}
