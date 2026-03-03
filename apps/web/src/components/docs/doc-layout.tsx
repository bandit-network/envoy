"use client";

import { cn } from "@envoy/ui";

interface EndpointCardProps {
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  auth?: "Bearer" | "API Key" | "None";
  description: string;
  children?: React.ReactNode;
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400",
  POST: "bg-blue-500/20 text-blue-400",
  PATCH: "bg-amber-500/20 text-amber-400",
  DELETE: "bg-red-500/20 text-red-400",
  PUT: "bg-purple-500/20 text-purple-400",
};

export function EndpointCard({
  method,
  path,
  auth = "Bearer",
  description,
  children,
}: EndpointCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
            methodColors[method]
          )}
        >
          {method}
        </span>
        <code className="font-mono text-sm text-foreground">{path}</code>
        {auth !== "None" && (
          <span className="ml-auto text-xs text-muted">{auth}</span>
        )}
      </div>
      <p className="text-sm text-muted">{description}</p>
      {children}
    </div>
  );
}

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ children, title }: CodeBlockProps) {
  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {title && (
        <div className="border-b border-border px-4 py-2 text-xs font-medium text-muted">
          {title}
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-xs text-foreground/90">{children}</code>
      </pre>
    </div>
  );
}

interface ProseProps {
  children: React.ReactNode;
}

export function Prose({ children }: ProseProps) {
  return (
    <div className="prose prose-invert max-w-none [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted [&_p]:mb-4 [&_ul]:text-sm [&_ul]:text-muted [&_ul]:space-y-1 [&_li]:text-muted [&_strong]:text-foreground">
      {children}
    </div>
  );
}

interface SectionProps {
  id?: string;
  title: string;
  children: React.ReactNode;
}

export function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </section>
  );
}
