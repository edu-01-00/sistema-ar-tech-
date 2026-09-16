export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-14 px-4">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  );
}
