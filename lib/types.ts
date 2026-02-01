// File: lib/types.ts
export interface RateLimitError extends Error {
  retryAfter?: number;
}
