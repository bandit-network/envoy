import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-center px-8", className)}>
      {icon && <div className="mb-4 text-muted/60">{icon}</div>}
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-[320px] text-[13px] leading-[20px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
