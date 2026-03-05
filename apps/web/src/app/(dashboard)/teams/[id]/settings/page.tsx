"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, Button, Input, Skeleton } from "@envoy/ui";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  email: string | null;
  createdAt: string;
}

interface OrgDetailResponse {
  organization: Organization;
  members: Member[];
  memberCount: number;
  userRole: string;
}

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const orgId = params.id as string;

  const [data, setData] = useState<OrgDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrg = useCallback(async () => {
    try {
      const result = await apiGet<OrgDetailResponse>(
        `/api/v1/organizations/${orgId}`,
        authFetch
      );
      setData(result);
      setName(result.organization.name);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load team"
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, authFetch]);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      await apiPatch(
        `/api/v1/organizations/${orgId}`,
        { name: name.trim() },
        authFetch
      );
      toast.success("Team updated");
      await loadOrg();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update team"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLeaveTeam() {
    if (!data) return;
    const currentMember = data.members.find(
      (m) => m.role === data.userRole
    );
    if (!currentMember) return;

    try {
      await apiDelete(
        `/api/v1/organizations/${orgId}/members/${currentMember.id}`,
        authFetch
      );
      toast.success("Left team");
      router.push("/teams");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to leave team"
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
        <Button variant="ghost" onClick={() => router.push("/teams")}>
          ← Back to teams
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { organization: org, userRole } = data;
  const canManage = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href={`/teams/${orgId}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">
            Team Settings
          </h1>
          <p className="text-[13px] text-muted">{org.name}</p>
        </div>
      </div>

      <div className="max-w-[640px] space-y-6">
        {/* General Settings */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">
              General
            </h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-[13px] font-medium text-foreground"
                >
                  Team Name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={255}
                  disabled={!canManage}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Slug
                </label>
                <div className="flex items-center rounded-lg border border-border bg-elevated px-3 py-2">
                  <span className="font-mono text-[13px] text-muted">
                    /{org.slug}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  Slugs cannot be changed after creation
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Created
                </label>
                <p className="text-[13px] text-foreground">
                  {formatDate(org.createdAt)}
                </p>
              </div>

              {canManage && (
                <div className="border-t border-border pt-4">
                  <Button
                    type="submit"
                    loading={saving}
                    disabled={name.trim() === org.name}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Team Info */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-[13px] font-medium uppercase tracking-wider text-muted">
              Team Info
            </h3>
            <div className="mt-4 space-y-0 divide-y divide-border">
              <div className="flex items-center justify-between py-3 first:pt-0">
                <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                  Team ID
                </span>
                <code className="font-mono text-[12px] text-foreground">
                  {org.id}
                </code>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                  Your Role
                </span>
                <span className="text-[13px] capitalize text-foreground">
                  {userRole}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[12px] font-medium uppercase tracking-wider text-muted">
                  Members
                </span>
                <span className="text-[13px] text-foreground">
                  {data.memberCount}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-danger/20">
          <CardContent className="p-6">
            <h3 className="text-[13px] font-medium uppercase tracking-wider text-danger">
              Danger Zone
            </h3>
            <div className="mt-4 space-y-4">
              {!isOwner && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      Leave Team
                    </p>
                    <p className="text-[12px] text-muted">
                      You will lose access to team agents and resources
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLeaveTeam}
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                  >
                    Leave
                  </Button>
                </div>
              )}
              {isOwner && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      Delete Team
                    </p>
                    <p className="text-[12px] text-muted">
                      Permanently delete this team and remove all members
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
