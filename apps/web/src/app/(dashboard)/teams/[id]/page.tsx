"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, Button, Skeleton } from "@envoy/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
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

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const orgId = params.id as string;

  const [data, setData] = useState<OrgDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member"
  );
  const [inviting, setInviting] = useState(false);

  const loadOrg = useCallback(async () => {
    try {
      const result = await apiGet<OrgDetailResponse>(
        `/api/v1/organizations/${orgId}`,
        authFetch
      );
      setData(result);
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await apiPost(
        `/api/v1/organizations/${orgId}/members`,
        { email: inviteEmail, role: inviteRole },
        authFetch
      );
      toast.success("Member invited");
      setShowInvite(false);
      setInviteEmail("");
      await loadOrg();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to invite member"
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await apiDelete(
        `/api/v1/organizations/${orgId}/members/${memberId}`,
        authFetch
      );
      toast.success("Member removed");
      await loadOrg();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to remove member"
      );
    }
  }

  async function handleChangeRole(
    memberId: string,
    newRole: string
  ) {
    try {
      await apiPatch(
        `/api/v1/organizations/${orgId}/members/${memberId}`,
        { role: newRole },
        authFetch
      );
      toast.success("Role updated");
      await loadOrg();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update role"
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
        <PageHeader title="Team" />
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

  const { organization: org, members, userRole } = data;
  const canManage = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/teams"
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
              {org.name}
            </h1>
            <p className="text-[13px] text-muted">/{org.slug}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowInvite(!showInvite)}
            >
              Invite Member
            </Button>
            <Link
              href={`/teams/${orgId}/settings`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground"
              title="Team Settings"
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
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && canManage && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-[14px] font-semibold text-foreground">
              Invite a member
            </h3>
            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-muted">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-1 text-[11px] text-muted">
                  The user must have an Envoy account
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-muted">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(
                      e.target.value as "admin" | "member" | "viewer"
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={inviting}>
                  Send Invite
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowInvite(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-[14px] font-semibold text-foreground">
              Members ({members.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-muted">
                    {(member.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      {member.email ?? "Unknown"}
                    </p>
                    <p className="text-[11px] text-muted">
                      Joined {formatDate(member.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && member.role !== "owner" ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleChangeRole(member.id, e.target.value)
                      }
                      className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:border-accent focus:outline-none"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium capitalize text-muted">
                      {roleLabels[member.role] ?? member.role}
                    </span>
                  )}

                  {canManage && member.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="rounded-md p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Remove member"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Org Info */}
      <Card className="mt-4">
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">
                Created
              </dt>
              <dd className="mt-1 text-[13px] text-foreground">
                {formatDate(org.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">
                Your Role
              </dt>
              <dd className="mt-1 text-[13px] capitalize text-foreground">
                {roleLabels[userRole] ?? userRole}
              </dd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
