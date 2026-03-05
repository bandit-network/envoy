import { Hono } from "hono";
import { db, organizations, orgMembers, users } from "@envoy/db";
import { eq, and, count, desc } from "drizzle-orm";
import type { AuthEnv } from "../middleware/auth";
import { getOrgAccess } from "../lib/org-access";
import { logAudit } from "../services/audit";
import { z } from "zod";

export const organizationsRouter = new Hono<AuthEnv>();

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

const updateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

/**
 * POST / — Create a new organization. Creator becomes the owner.
 */
organizationsRouter.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createOrgSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const { name, slug } = parsed.data;

  let org;
  try {
    const [inserted] = await db
      .insert(organizations)
      .values({ name, slug })
      .returning();
    org = inserted;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return c.json(
        { success: false, error: { code: "CONFLICT", message: "Slug is already taken" } },
        409
      );
    }
    throw err;
  }

  if (!org) {
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create organization" } },
      500
    );
  }

  // Add creator as owner
  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: user.userId,
    role: "owner",
  });

  return c.json({ success: true, data: org }, 201);
});

/**
 * GET / — List organizations the user belongs to.
 */
organizationsRouter.get("/", async (c) => {
  const user = c.get("user");

  const memberships = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: orgMembers.role,
      createdAt: organizations.createdAt,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.userId))
    .orderBy(desc(organizations.createdAt));

  return c.json({ success: true, data: { organizations: memberships } });
});

/**
 * GET /:id — Get organization detail with members.
 */
organizationsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const orgId = c.req.param("id");

  const access = await getOrgAccess(user.userId, orgId);
  if (!access.member) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Organization not found" } },
      404
    );
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Organization not found" } },
      404
    );
  }

  // Get members
  const members = await db
    .select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      role: orgMembers.role,
      email: users.email,
      createdAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(orgMembers.createdAt);

  // Get member count
  const [memberCount] = await db
    .select({ total: count() })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, orgId));

  return c.json({
    success: true,
    data: {
      organization: org,
      members,
      memberCount: memberCount?.total ?? 0,
      userRole: access.role,
    },
  });
});

/**
 * PATCH /:id — Update organization (owner/admin only).
 */
organizationsRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const orgId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateOrgSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const access = await getOrgAccess(user.userId, orgId);
  if (!access.canManage) {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only owners and admins can update the organization" } },
      403
    );
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;

  if (Object.keys(updateData).length === 0) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "No fields to update" } },
      400
    );
  }

  const [updated] = await db
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, orgId))
    .returning();

  return c.json({ success: true, data: updated });
});

/**
 * POST /:id/members — Add a member (owner/admin only).
 */
organizationsRouter.post("/:id/members", async (c) => {
  const user = c.get("user");
  const orgId = c.req.param("id");
  const body = await c.req.json();
  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const access = await getOrgAccess(user.userId, orgId);
  if (!access.canManage) {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only owners and admins can add members" } },
      403
    );
  }

  // Find user by email
  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });

  if (!targetUser) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "User not found. They must sign up first." } },
      404
    );
  }

  // Check if already a member
  const existing = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUser.id)),
  });

  if (existing) {
    return c.json(
      { success: false, error: { code: "CONFLICT", message: "User is already a member" } },
      409
    );
  }

  const [member] = await db
    .insert(orgMembers)
    .values({
      orgId,
      userId: targetUser.id,
      role: parsed.data.role,
    })
    .returning();

  logAudit({
    action: "org_member_added",
    userId: user.userId,
    metadata: { orgId, targetUserId: targetUser.id, role: parsed.data.role },
  });

  return c.json({
    success: true,
    data: { ...member, email: targetUser.email },
  }, 201);
});

/**
 * PATCH /:id/members/:memberId — Change member role (owner only).
 */
organizationsRouter.patch("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const orgId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const body = await c.req.json();
  const parsed = updateMemberSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.message } },
      400
    );
  }

  const access = await getOrgAccess(user.userId, orgId);
  if (access.role !== "owner") {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only owners can change member roles" } },
      403
    );
  }

  // Verify the member exists and belongs to this org
  const member = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)),
  });

  if (!member) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Member not found" } },
      404
    );
  }

  const [updated] = await db
    .update(orgMembers)
    .set({ role: parsed.data.role })
    .where(eq(orgMembers.id, memberId))
    .returning();

  logAudit({
    action: "org_member_role_changed",
    userId: user.userId,
    metadata: { orgId, memberId, newRole: parsed.data.role },
  });

  return c.json({ success: true, data: updated });
});

/**
 * DELETE /:id/members/:memberId — Remove member (owner/admin, can't remove last owner).
 */
organizationsRouter.delete("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const orgId = c.req.param("id");
  const memberId = c.req.param("memberId");

  const access = await getOrgAccess(user.userId, orgId);
  if (!access.canManage) {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only owners and admins can remove members" } },
      403
    );
  }

  // Find the member
  const member = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)),
  });

  if (!member) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Member not found" } },
      404
    );
  }

  // Prevent removing the last owner
  if (member.role === "owner") {
    const [ownerCount] = await db
      .select({ total: count() })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));

    if ((ownerCount?.total ?? 0) <= 1) {
      return c.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Cannot remove the last owner" } },
        400
      );
    }
  }

  // Admins can't remove owners
  if (access.role === "admin" && member.role === "owner") {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "Admins cannot remove owners" } },
      403
    );
  }

  await db.delete(orgMembers).where(eq(orgMembers.id, memberId));

  logAudit({
    action: "org_member_removed",
    userId: user.userId,
    metadata: { orgId, memberId, removedUserId: member.userId },
  });

  return c.json({ success: true });
});
