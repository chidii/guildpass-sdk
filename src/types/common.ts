import type { RetryConfig } from '../http/http.types';

// GuildPass SDK: Exposed interface structure.
export type Address = string;

export type RequestOptions = {
  /** Override the client-level timeout for this service call, in milliseconds. */
  timeoutMs?: number;
  /** Override retry behavior for this service call. */
  retry?: RetryConfig;
};

// GuildPass SDK: Core operational type definition.
export type AccessRequirement = {
  type: 'TOKEN' | 'NFT' | 'ROLE' | 'WHITELIST';
  address?: Address;
  id?: string;
  minAmount?: string;
  // GuildPass SDK: End of logic containment structure block.
};
