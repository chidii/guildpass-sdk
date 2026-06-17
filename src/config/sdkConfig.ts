// GuildPass SDK: Import external module dependencies.
import { HttpHooks } from '../http/http.types';
import { GuildPassError } from '../errors/GuildPassError';
import { GuildPassErrorCode } from '../errors/errorCodes';
import { RetryConfig } from '../http/http.types';

// GuildPass SDK: Exported component definition.
export type GuildPassClientConfig = {
  apiUrl: string;
  chainId?: number;
  rpcUrl?: string;
  contractAddress?: string;
  apiKey?: string;
  timeoutMs?: number;
  /** Global retry policy applied to all requests. Defaults to no retries. */
  retry?: RetryConfig;
  hooks?: HttpHooks;
  /**
   * When true, service responses are checked against runtime shape guards
   * before being returned, throwing a GuildPassError with code
   * INVALID_RESPONSE if the API response is malformed. Defaults to false
   * to preserve existing behaviour.
   */
  validateResponses?: boolean;
  // GuildPass SDK: End of logic containment structure block.
};

export function validateConfig(config: GuildPassClientConfig): void {
  if (!config.apiUrl) {
    throw new GuildPassError('apiUrl is required', GuildPassErrorCode.INVALID_CONFIG);
  }
  try {
    const url = new URL(config.apiUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new GuildPassError(
      `Invalid apiUrl: "${config.apiUrl}"`,
      GuildPassErrorCode.INVALID_CONFIG,
    );
  }
  if (
    config.timeoutMs !== undefined &&
    (typeof config.timeoutMs !== 'number' || config.timeoutMs <= 0)
  ) {
    throw new GuildPassError(
      'timeoutMs must be a positive number',
      GuildPassErrorCode.INVALID_CONFIG,
    );
  }
}
