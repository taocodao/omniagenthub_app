/**
 * X402 Fetch Hook
 * 
 * This hook provides X402 payment-enabled fetch functionality.
 * 
 * HISTORY:
 * - Original: Used @x402/evm and @x402/fetch libraries
 * - After 4+ hours debugging "invalid BigInt syntax" errors, switched to manual implementation
 * - Manual implementation works directly with Privy embedded wallet
 */

// Re-export the manual implementation that works
export { useX402FetchManual as useX402Fetch } from './useX402FetchManual';

// Keep original import for reference (commented out due to bugs)
// import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
// import { registerExactEvmScheme } from '@x402/evm/exact/client';
