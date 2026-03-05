import Link from "next/link";
import type { Metadata } from "next";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface PublicAgent {
  id: string;
  name: string;
  username: string;
  description: string | null;
  avatarUrl: string | null;
  status: string;
  walletAddress: string | null;
  registryAssetId: string | null;
  scopes: string[];
  createdAt: string;
}

interface AgentListResponse {
  agents: PublicAgent[];
  total: number;
  limit: number;
  offset: number;
}

async function getPublicAgents(
  search?: string,
  scope?: string,
  offset = 0
): Promise<AgentListResponse> {
  try {
    const params = new URLSearchParams();
    params.set("limit", "24");
    params.set("offset", String(offset));
    if (search) params.set("search", search);
    if (scope) params.set("scope", scope);

    const res = await fetch(
      `${API_BASE_URL}/api/v1/agents/public?${params.toString()}`,
      { next: { revalidate: 30 } }
    );

    if (!res.ok) {
      return { agents: [], total: 0, limit: 24, offset: 0 };
    }

    const json = (await res.json()) as {
      success: boolean;
      data: AgentListResponse;
    };

    return json.success ? json.data : { agents: [], total: 0, limit: 24, offset: 0 };
  } catch {
    return { agents: [], total: 0, limit: 24, offset: 0 };
  }
}

function getAvatarUrl(agentId: string, avatarUrl: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${agentId}`;
}

export const metadata: Metadata = {
  title: "Discover Agents | Envoy",
  description: "Browse AI agents registered on the Envoy identity network.",
};

export default async function AgentDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; scope?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search;
  const scope = params.scope;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * 24;

  const data = await getPublicAgents(search, scope, offset);
  const totalPages = Math.ceil(data.total / 24);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[15px] font-bold tracking-tight text-foreground"
            >
              ENVOY
            </Link>
            <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              Discover
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-[13px] text-muted transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-elevated"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-[28px] font-bold text-foreground sm:text-[32px]">
              Discover Agents
            </h1>
            <p className="mt-2 text-[14px] text-muted">
              Browse AI agents registered on the Envoy identity network.
            </p>
          </div>

          {/* Search */}
          <form className="mt-8 flex justify-center" action="/discover" method="GET">
            <div className="flex w-full max-w-md items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search agents..."
                  className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              {scope && <input type="hidden" name="scope" value={scope} />}
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-accent/90"
              >
                Search
              </button>
            </div>
          </form>

          {/* Scope filter chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["api_access", "data_read", "data_write", "transactions"].map(
              (s) => (
                <Link
                  key={s}
                  href={`/discover?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    ...(scope === s ? {} : { scope: s }),
                  }).toString()}`}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    scope === s
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:border-muted hover:text-foreground"
                  }`}
                >
                  {s}
                </Link>
              )
            )}
            {scope && (
              <Link
                href={`/discover${search ? `?search=${encodeURIComponent(search)}` : ""}`}
                className="rounded-full border border-border px-3 py-1 text-[12px] font-medium text-muted transition-colors hover:text-foreground"
              >
                Clear filter
              </Link>
            )}
          </div>

          {/* Results */}
          {data.agents.length === 0 ? (
            <div className="mt-16 text-center">
              <svg
                className="mx-auto h-12 w-12 text-muted/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              <p className="mt-4 text-[14px] text-muted">
                {search || scope
                  ? "No agents match your search."
                  : "No public agents found yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.agents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/discover/${agent.username}`}
                    className="group rounded-xl border border-border bg-surface p-5 transition-all hover:border-muted/60 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(agent.id, agent.avatarUrl)}
                        alt={agent.name}
                        className="h-10 w-10 rounded-full border border-border bg-background"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[14px] font-semibold text-foreground group-hover:text-accent">
                          {agent.name}
                        </h3>
                        <p className="text-[12px] text-muted">@{agent.username}</p>
                      </div>
                    </div>

                    {agent.description && (
                      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted">
                        {agent.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {agent.walletAddress && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-registry/30 bg-registry/10 px-2 py-0.5 text-[11px] font-medium text-registry">
                          On-Chain
                        </span>
                      )}
                      {agent.registryAssetId && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-registry/30 bg-registry/10 px-2 py-0.5 text-[11px] font-medium text-registry">
                          8004
                        </span>
                      )}
                      {agent.scopes.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted"
                        >
                          {s}
                        </span>
                      ))}
                      {agent.scopes.length > 2 && (
                        <span className="text-[11px] text-muted">
                          +{agent.scopes.length - 2}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link
                      href={`/discover?${new URLSearchParams({
                        ...(search ? { search } : {}),
                        ...(scope ? { scope } : {}),
                        page: String(page - 1),
                      }).toString()}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                    >
                      ← Previous
                    </Link>
                  )}
                  <span className="text-[13px] text-muted">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`/discover?${new URLSearchParams({
                        ...(search ? { search } : {}),
                        ...(scope ? { scope } : {}),
                        page: String(page + 1),
                      }).toString()}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              )}

              <p className="mt-4 text-center text-[12px] text-muted">
                {data.total} agent{data.total !== 1 ? "s" : ""} found
              </p>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-[12px] text-muted">
            &copy; {new Date().getFullYear()} Envoy
          </span>
          <Link
            href="/"
            className="text-[12px] text-muted transition-colors hover:text-foreground"
          >
            useenvoy.dev
          </Link>
        </div>
      </footer>
    </div>
  );
}
