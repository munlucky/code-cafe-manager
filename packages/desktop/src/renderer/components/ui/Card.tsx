import { cn } from '../../utils/cn';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-card border border-border rounded-lg p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}
