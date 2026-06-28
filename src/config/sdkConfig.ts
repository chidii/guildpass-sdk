// GuildPass SDK: Import external module dependencies.
import { FetchLike, HttpHooks, RetryConfig } from '../http/http.types';
import { GuildPassError } from '../errors/GuildPassError';
import { GuildPassErrorCode } from '../errors/errorCodes';
import { CacheAdapter } from '../cache/cache.types';
import { ChainConfig } from '../contracts/contract.types';

// GuildPass SDK: Exported component definition.
export type GuildPassClientConfig = {
  apiUrl: string;
  chainId?: number;
  rpcUrl?: string;
  contractAddress?: string;
  /** Per-chain RPC URL and contract address overrides, keyed by chain ID. */
  chains?: Record<number, ChainConfig>;
  apiKey?: string;
  timeoutMs?: number;
  /** Global retry policy applied to all requests. Defaults to no retries. */
  retry?: RetryConfig;
  hooks?: HttpHooks;
  /**
   * Optional fetch-compatible transport for tests, tracing, proxies,
   * custom runtimes, or environments without globalThis.fetch.
   */
  fetch?: FetchLike;
  /**
   * When true, service responses are checked against runtime shape guards
   * before being returned, throwing a GuildPassError with code
   * INVALID_RESPONSE if the API response is malformed. Defaults to false
   * to preserve existing behaviour.
   */
  validateResponses?: boolean;
  /**
   * A cache adapter used to memoize read responses.
   *
   * Provide `new InMemoryCacheAdapter()` for a built-in solution, or supply
   * any object that satisfies the {@link CacheAdapter} interface (e.g. a
   * Redis adapter) for distributed caching.
   *
   * @example
   * ```typescript
   * import { GuildPassClient, InMemoryCacheAdapter } from '@guildpass/sdk';
   *
   * const client = new GuildPassClient({
   *   apiUrl: 'https://api.guildpass.xyz',
   *   cache: new InMemoryCacheAdapter(),
   *   cacheTtl: 60_000,
   * });
   * ```
   */
  cache?: CacheAdapter;
  /**
   * Default TTL in **milliseconds** applied to every cached entry when
   * a per-call TTL is not specified. Defaults to `0` (no expiry).
   */
  cacheTtl?: number;
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

  // INSERT RETRY VALIDATION 
  if (config.retry) {
    const r = config.retry;

    if (typeof r.maxRetries !== 'number' || r.maxRetries < 0 || !Number.isFinite(r.maxRetries)) {
      throw new GuildPassError(
        'retry.maxRetries must be a non-negative finite number',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }

    if (typeof r.baseDelayMs !== 'number' || r.baseDelayMs < 0 || !Number.isFinite(r.baseDelayMs)) {
      throw new GuildPassError(
        'retry.baseDelayMs must be a non-negative finite number',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }

    if (typeof r.maxDelayMs !== 'number' || r.maxDelayMs < 0 || !Number.isFinite(r.maxDelayMs)) {
      throw new GuildPassError(
        'retry.maxDelayMs must be a non-negative finite number',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }

    if (r.baseDelayMs !== undefined && r.maxDelayMs !== undefined && r.maxDelayMs < r.baseDelayMs) {
      throw new GuildPassError(
        'retry.maxDelayMs cannot be less than baseDelayMs',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }

    if (
      !Array.isArray(r.retryableStatuses) ||
      r.retryableStatuses.some((s) => typeof s !== 'number' || !Number.isFinite(s))
    ) {
      throw new GuildPassError(
        'retryableStatuses must be an array of valid HTTP status numbers',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }
  }
  // END RETRY VALIDATION 

  const transport = config.fetch ?? globalThis.fetch;
  if (typeof transport !== 'function') {
    throw new GuildPassError(
      'A fetch-compatible transport is required. Provide config.fetch or use a runtime with globalThis.fetch.',
      GuildPassErrorCode.INVALID_CONFIG,
    );
  }
}
/**
 * Resolves the chain configuration for a given chain ID.
 * Per-chain entries in `config.chains` take precedence over the top-level
 * `rpcUrl` / `contractAddress` fallbacks.
 * Throws `INVALID_CONFIG` only when a `chains` map is provided but does not
 * contain an entry for the requested chain.
 */
export function resolveChainConfig(config: GuildPassClientConfig, chainId: number): ChainConfig {
  if (config.chains) {
    if (Object.prototype.hasOwnProperty.call(config.chains, chainId)) {
      return config.chains[chainId];
    }
    throw new GuildPassError(
      `No configuration found for chain ID ${chainId}`,
      GuildPassErrorCode.INVALID_CONFIG,
    );
  }
  return { rpcUrl: config.rpcUrl, contractAddress: config.contractAddress };
}
