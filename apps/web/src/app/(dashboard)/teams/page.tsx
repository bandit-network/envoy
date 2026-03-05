"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, Button, Skeleton } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Org {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

interface OrgListResponse {
  organizations: Org[];
}

export default function TeamsPage() {
  const authFetch = useAuthFetch();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const loadOrgs = useCallback(async () => {
    try {
      const data = await apiGet<OrgListResponse>(
        "/api/v1/organizations",
        authFetch
      );
      setOrgs(data.organizations);
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiPost("/api/v1/organizations", { name, slug }, authFetch);
      toast.success("Team created");
      setShowCreate(false);
      setName("");
      setSlug("");
      await loadOrgs();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create team";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  function handleNameChange(val: string) {
    setName(val);
    // Auto-generate slug from name
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Teams"
        description="Manage organizations and collaborate on agent identities"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            Create Team
          </Button>
        }
      />

      {/* Create Form */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">
              Create a new team
            </h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-muted">
                  Team Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Team"
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted">
                  Slug
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-team"
                  required
                  pattern="^[a-z0-9-]+$"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Lowercase alphanumeric with hyphens
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={creating}>
                  Create
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Teams List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center">
            <svg
              className="mx-auto h-10 w-10 text-muted/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
            <p className="mt-3 text-[14px] text-muted">
              No teams yet. Create one to collaborate on agent identities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <Link key={org.id} href={`/teams/${org.id}`}>
              <Card className="transition-colors hover:border-muted/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-[14px] font-bold text-accent">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground">
                        {org.name}
                      </h3>
                      <p className="text-[12px] text-muted">/{org.slug}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium capitalize text-muted">
                    {roleLabels[org.role] ?? org.role}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
