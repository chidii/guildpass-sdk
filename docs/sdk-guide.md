# SDK Guide

This guide covers advanced usage and patterns for the GuildPass SDK.

## Error Handling

The SDK uses a custom `GuildPassError` class. You should always wrap SDK calls in try-catch blocks.

```typescript
import { GuildPassClient, GuildPassErrorCode } from "@guildpass/sdk";

try {
  await client.access.checkAccess({...});
} catch (error) {
  if (error instanceof GuildPassError) {
    switch (error.code) {
      case GuildPassErrorCode.UNAUTHORISED:
        // Handle invalid API key
        break;
      case GuildPassErrorCode.NOT_FOUND:
        // Handle missing guild or resource
        break;
      case GuildPassErrorCode.TIMEOUT:
        // Handle network timeout
        break;
      case GuildPassErrorCode.INVALID_RESPONSE:
        // Handle a malformed API response (only thrown when validateResponses is enabled)
        break;
    }
  }
}
```

## Request Cancellation

You can cancel in-flight requests using an `AbortSignal`. This is useful for UI unmounting, manual cancellation, or server-side request propagation.

```typescript
const controller = new AbortController();

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000);

try {
  await client.access.checkAccess({
    address: '0x...',
    guildId: '...',
  }, { signal: controller.signal });
} catch (error) {
  if (error.code === GuildPassErrorCode.REQUEST_CANCELLED) {
    console.log('Request was cancelled by the user');
  }
}
```

## Environment Support

### Node.js

The SDK works in Node.js 18+. If you are on an older version, you may need to polyfill `fetch`.

### Browser

The SDK is tree-shakeable and optimized for modern browsers. It does not include any Node-only dependencies.

## Address Normalization and Checksums

The SDK automatically normalizes addresses to lowercase for consistency and accepts both lowercase and mixed-case addresses by default.
You can also use the exported utilities to format or strictly validate EIP-55 checksum addresses:

```typescript
import {
  normaliseAddress,
  toChecksumAddress,
  isChecksumAddress,
  validateAddress,
} from '@guildpass/sdk';

// Convert to lowercase
const clean = normaliseAddress('0xabc...');

// Convert to EIP-55 Checksum
const checksummed = toChecksumAddress('0xabc...');

// Check if an address has a valid checksum
const isValid = isChecksumAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); // true

// Strict validation mode (throws if checksum is invalid)
validateAddress('0xd8da...', { strict: true });
```

## Multi-Chain Configuration

To support multiple GuildPass deployments across different networks, pass a `chains` map keyed by chain ID. Each entry can specify an `rpcUrl` and `contractAddress` for that chain.

```typescript
const client = new GuildPassClient({
  apiUrl: 'https://api.guildpass.xyz',
  chainId: 8453, // default chain
  chains: {
    1: {
      rpcUrl: 'https://eth-mainnet.example.com',
      contractAddress: '0xYourEthContract',
    },
    8453: {
      rpcUrl: 'https://base-mainnet.example.com',
      contractAddress: '0xYourBaseContract',
    },
    137: {
      rpcUrl: 'https://polygon-mainnet.example.com',
      contractAddress: '0xYourPolygonContract',
    },
  },
});

// Resolve config for a specific chain
const baseConfig = client.contracts.getChainConfig(8453);
// { rpcUrl: 'https://base-mainnet.example.com', contractAddress: '0xYourBaseContract' }

// Calling without an argument uses the client's default chainId
const defaultConfig = client.contracts.getChainConfig();
```

When a `chains` map is provided, requesting an unlisted chain ID throws a `GuildPassError` with code `INVALID_CONFIG`:

```typescript
// throws: No configuration found for chain ID 42161
client.contracts.getChainConfig(42161);
```

The existing single-chain config (`rpcUrl` + `contractAddress` at the top level) remains fully backwards-compatible and is used as a fallback when no `chains` map is set.

## On-chain Guild Ownership

`client.contracts.getGuildOwner` queries the resolved chain contract through JSON-RPC:

```typescript
const ownerAddress = await client.contracts.getGuildOwner({
  guildId: 'guild_1',
});
```

You can override the target chain or contract per call:

```typescript
const ownerAddress = await client.contracts.getGuildOwner({
  guildId: '42',
  chainId: 8453,
  contractAddress: '0x1111111111111111111111111111111111111111',
});
```

The SDK validates the RPC and contract configuration before making the call,
encodes the guild ID as `bytes32`, calls `getGuildOwner(bytes32)`, and validates
that the RPC response decodes to an Ethereum address.



The default timeout is 10 seconds. You can override this globally or for an individual service call:

```typescript
const client = new GuildPassClient({
  apiUrl: '...',
  timeoutMs: 5000, // 5 seconds
});

const access = await client.access.checkAccess(params, {
  timeoutMs: 1500, // override only this request
});

const guild = await client.guilds.getGuild(
  { guildId: 'prime-guild' },
  { timeoutMs: 2500 },
);
```

## Cancellation

Pass an `AbortSignal` via the `signal` option to cancel an in-flight request. The signal composes with the per-request timeout — whichever fires first wins.

```typescript
const controller = new AbortController();

// Cancel after 2 seconds (e.g. component unmount, route change)
setTimeout(() => controller.abort(), 2000);

try {
  const data = await client.guilds.getGuild(guildId, {
    signal: controller.signal,
  });
} catch (err) {
  if (err instanceof GuildPassError && err.code === GuildPassErrorCode.ABORTED) {
    // Request was cancelled by the caller
  } else if (err instanceof GuildPassError && err.code === GuildPassErrorCode.TIMEOUT) {
    // Request exceeded the configured timeout
  }
}
```

Passing an already-aborted signal throws `ABORTED` immediately without making a network request.

## Retry Policy

By default the SDK makes a single attempt and throws on failure. You can enable automatic retries with exponential backoff via the `retry` option.

### Global configuration
## Observability Hooks

The SDK supports optional request lifecycle hooks so you can integrate calls with logging, metrics, tracing, and debugging tools.

```typescript
const client = new GuildPassClient({
  apiUrl: 'https://api.guildpass.xyz',
  retry: {
    maxRetries: 3,        // number of retries after the initial attempt
    baseDelayMs: 200,     // starting backoff delay, doubles each attempt
    maxDelayMs: 5000,     // backoff ceiling
    retryableStatuses: [429, 500, 502, 503, 504], // default
  },
});
```

### Per-request override

Pass `retry` inside any request options to override the global policy for that call:

```typescript
const data = await client.access.checkAccess(params, {
  retry: { maxRetries: 1 },
});
```

### Defaults and safe usage

| Option | Default | Notes |
| :--- | :--- | :--- |
| `maxRetries` | `0` | Set to `0` to disable retries entirely. |
| `baseDelayMs` | `200` | Backoff starts here and doubles each attempt. |
| `maxDelayMs` | `5000` | Backoff will never exceed this value. |
| `retryableStatuses` | `[429, 500, 502, 503, 504]` | 4xx errors other than 429 are not retried. |
| `allowMutatingRetry` | `false` | POST/PUT/PATCH/DELETE are **not** retried unless this is `true`. |

The SDK respects the `Retry-After` response header on 429 responses, waiting the server-specified duration before retrying rather than using the computed backoff.

Non-idempotent methods (POST, PATCH) are never retried unless you explicitly set `allowMutatingRetry: true`. Only enable this when you are certain the operation is safe to repeat.
  hooks: {
    onRequest: ({ method, path }) => {
      console.log('request started', method, path);
    },
    onResponse: ({ method, path, status, durationMs }) => {
      console.log('request succeeded', method, path, status, durationMs);
    },
    onError: ({ method, path, error, durationMs }) => {
      console.error('request failed', method, path, error.message, durationMs);
    },
  },
});
```

Hook payloads expose safe request metadata only. Sensitive values like the API key, `Authorization` and `Cookie` headers, and full request body are not included in hook payloads. Headers are redacted consistently before reaching your callbacks, and hook failures are logged without changing the normal SDK response behavior.

⚠️ **Warning:** Be careful not to log sensitive application data. Although the SDK automatically redacts known sensitive headers (`authorization`, `x-api-key`, `cookie`, `set-cookie`), any proprietary query parameters or custom headers containing sensitive info should be handled securely.
