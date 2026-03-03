import { z } from "zod";

export const createPlatformSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().min(1).max(255),
  webhookUrl: z.string().url().optional(),
});

export type CreatePlatformInput = z.infer<typeof createPlatformSchema>;

export const updatePlatformSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().min(1).max(255).optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

export type UpdatePlatformInput = z.infer<typeof updatePlatformSchema>;

export const registerApiKeySchema = z.object({
  label: z.string().min(1).max(255).optional(),
  scopes: z.array(z.string()).optional(),
});

export type RegisterApiKeyInput = z.infer<typeof registerApiKeySchema>;
