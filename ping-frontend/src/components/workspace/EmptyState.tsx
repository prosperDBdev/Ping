interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-ping-cream-dark dark:bg-ping-night-card flex items-center justify-center mb-4 text-ping-text-light dark:text-ping-night-text-light">
        {icon}
      </div>
      <p className="text-ping-dark dark:text-ping-night-text font-bold text-sm mb-1">{title}</p>
      <p className="text-ping-text-light dark:text-ping-night-text-light text-xs max-w-xs leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
