import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '📦', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="text-5xl">{icon}</div>
      <h2 className="text-lg font-semibold text-tg-text">{title}</h2>
      {description && <p className="max-w-xs text-sm text-tg-hint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
