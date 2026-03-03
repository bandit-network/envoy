import { cn } from "../lib/cn";

const variants = {
  default: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-yellow-500/15 text-yellow-500",
  danger: "bg-danger/15 text-danger",
  muted: "bg-muted/15 text-muted",
} as const;

export interface BadgeProps {
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = "default", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
