import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '📦', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-4xl bg-white/5 text-4xl ring-1 ring-white/10">
        {icon}
      </div>
      <h2 className="text-lg font-bold text-tg-text">{title}</h2>
      {description && <p className="max-w-xs text-sm text-tg-hint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
