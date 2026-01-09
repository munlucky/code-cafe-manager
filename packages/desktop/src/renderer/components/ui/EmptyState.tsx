export function EmptyState({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <p className="mb-4">{message}</p>
      {children}
    </div>
  );
}
