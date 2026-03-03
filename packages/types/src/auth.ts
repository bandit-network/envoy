/** Shape of the authenticated user context attached to API requests */
export interface AuthUser {
  /** Envoy internal user ID (UUID) */
  userId: string;
  /** Privy-issued user ID (did:privy:...) */
  privyUserId: string;
  /** Email if available from Privy */
  email: string | null;
}
