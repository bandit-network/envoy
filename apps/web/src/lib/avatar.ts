/**
 * Resolve the display avatar URL for an agent.
 * Priority: custom avatarUrl → DiceBear identicon from agentId
 */
export function getAgentAvatarUrl(
  agentId: string,
  avatarUrl: string | null | undefined
): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${agentId}`;
}

/**
 * Get initials from an agent name for the ultimate fallback.
 */
export function getAgentInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
