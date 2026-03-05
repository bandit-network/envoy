import { db, orgMembers } from "@envoy/db";
import { eq, and } from "drizzle-orm";

export interface OrgAccess {
  member: boolean;
  role: "owner" | "admin" | "member" | "viewer" | null;
  canManage: boolean; // owner or admin
  canWrite: boolean; // owner, admin, or member
}

/**
 * Check a user's access level within an organization.
 * Returns role-based permissions for the user.
 */
export async function getOrgAccess(
  userId: string,
  orgId: string
): Promise<OrgAccess> {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });

  if (!membership) {
    return { member: false, role: null, canManage: false, canWrite: false };
  }

  const role = membership.role as "owner" | "admin" | "member" | "viewer";
  const canManage = role === "owner" || role === "admin";
  const canWrite = canManage || role === "member";

  return { member: true, role, canManage, canWrite };
}
