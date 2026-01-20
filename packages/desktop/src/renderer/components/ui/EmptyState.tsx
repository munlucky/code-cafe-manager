import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string; // Made optional for backward compatibility
  description?: string;
  action?: React.ReactNode;
  message?: string; // Legacy prop for backward compatibility
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  message,
  children,
}: EmptyStateProps): JSX.Element { // Added explicit return type
  // Fallback: use message as title if title is not provided
  const displayTitle = title || message || 'Empty';

  let displayDescription: string | undefined;
  if (title) {
    displayDescription = description || message;
  } else {
    displayDescription = description;
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <Icon className="w-12 h-12 text-cafe-400 opacity-30 mb-4" />
      )}
      <h3 className="text-lg font-semibold text-cafe-300 mb-2">{displayTitle}</h3>
      {displayDescription && (
        <p className="text-cafe-500 mb-4">{displayDescription}</p>
      )}
      {action || children}
    </div>
  );
}
