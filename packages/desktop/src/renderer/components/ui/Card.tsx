import { cn } from '../../utils/cn';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-cafe-800 border border-cafe-700 rounded-xl shadow-lg p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}
