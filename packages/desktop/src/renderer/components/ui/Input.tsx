import { cn } from '../../utils/cn';

export type InputIntent = 'default' | 'warning' | 'info' | 'success' | 'error';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  intent?: InputIntent;
}

const INTENT_STYLES: Record<InputIntent, string> = {
  default: 'focus:ring-brand/50 focus:border-transparent',
  warning: 'focus:ring-yellow-500/20 focus:border-yellow-500',
  info: 'focus:ring-blue-500/20 focus:border-blue-500',
  success: 'focus:ring-green-500/20 focus:border-green-500',
  error: 'focus:ring-red-500/20 focus:border-red-500',
};

export function Input({
  className,
  intent = 'default',
  ...props
}: InputProps) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 bg-cafe-950 border border-cafe-700 rounded-lg text-cafe-200',
        'focus:outline-none focus:ring-2',
        INTENT_STYLES[intent],
        'placeholder:text-cafe-500',
        'transition-colors',
        className
      )}
      {...props}
    />
  );
}
