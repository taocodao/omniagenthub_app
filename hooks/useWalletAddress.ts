// hooks/useWalletAddress.ts
/**
 * MIGRATED: This file now re-exports from usePrivyAuth for backwards compatibility
 * All Auth0 logic has been migrated to Privy
 */

export { useActiveAccount, useWalletAddress, usePrivyUserId } from './usePrivyAuth';
export { useActiveAccount as default } from './usePrivyAuth';
