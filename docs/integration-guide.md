# Integration Guide

How to use GuildPass SDK in different scenarios.

## 1. Token-Gated Website (Next.js)

In a Next.js application, you can check access on the server-side inside `getServerSideProps` or Middleware.

```typescript
// middleware.ts
import { GuildPassClient } from '@guildpass/sdk';

const client = new GuildPassClient({ apiUrl: process.env.GUILDPASS_API });

export async function middleware(req) {
  const wallet = req.cookies.get('wallet_address');

  const { hasAccess } = await client.access.checkAccess({
    walletAddress: wallet,
    guildId: 'premium-guild',
    resourceId: req.nextUrl.pathname,
  });

  if (!hasAccess) {
    return NextResponse.redirect('/join');
  }
}
```

## 2. Discord Bot Integration

Use the SDK inside your Discord bot command handlers to verify roles or membership before granting access to channels.

```typescript
// commands/verify.ts
import { GuildPassClient } from '@guildpass/sdk';

export async function execute(interaction) {
  const wallet = getWalletFromDb(interaction.user.id);

  const isMember = await client.membership.isMember({
    walletAddress: wallet,
    guildId: 'my-discord-guild',
  });

  if (isMember) {
    await interaction.member.roles.add(GUILD_ROLE_ID);
  }
}
```

## 3. Admin Tools

Fetch guild configurations to build custom management dashboards.

```typescript
const config = await client.guilds.getGuildConfig({ guildId: 'my-guild' });
// Use config.theme, config.socialLinks etc to render the UI
```

## 4. Custom Transport (Proxies, Logging, etc.)

The SDK allows you to provide a custom `fetch` implementation. This is useful for:
- Supporting legacy Node.js versions (using `node-fetch` or `undici`)
- Adding custom logging or tracing
- Routing requests through a proxy
- Testing with custom stubs

```typescript
import { GuildPassClient } from '@guildpass/sdk';
import myCustomFetch from './my-fetch-wrapper';

const client = new GuildPassClient({
  apiUrl: 'https://api.guildpass.xyz',
  fetch: myCustomFetch, // Injected transport
## 4. Batch Access Checking

If you need to verify access for multiple resources or multiple users at once, use the batch access helper to manage concurrency and gracefully handle partial failures.

```typescript
import { GuildPassClient } from '@guildpass/sdk';

const client = new GuildPassClient({ apiUrl: process.env.GUILDPASS_API });

const items = [
  { walletAddress: '0x123...', guildId: 'guild-a', resourceId: 'res-1' },
  { walletAddress: '0x456...', guildId: 'guild-a', resourceId: 'res-2' },
];

const results = await client.access.checkAccessBatch(items, { concurrency: 2 });

results.forEach((result) => {
  if (result.status === 'fulfilled') {
    console.log(`Access for ${result.input.walletAddress}: ${result.value.hasAccess}`);
  } else {
    console.error(`Failed to check access for ${result.input.walletAddress}`, result.error);
  }
});
```

## 5. Custom Fetch Transport

Use the `fetch` config option when you need a runtime-specific transport,
request tracing, proxy routing, or tests that should not stub `globalThis.fetch`.
The function must be fetch-compatible and return a `Response`.

```typescript
import { GuildPassClient } from '@guildpass/sdk';

const tracedFetch: typeof fetch = async (input, init) => {
  const startedAt = Date.now();
  const response = await fetch(input, init);

  console.log('guildpass request', {
    input,
    status: response.status,
    durationMs: Date.now() - startedAt,
  });

  return response;
};

const client = new GuildPassClient({
  apiUrl: process.env.GUILDPASS_API,
  fetch: tracedFetch,
});
```

## 6. Batch Contract Read Calls

When you need to check membership token balances or guild owners for many
wallets or guilds at once, use the SDK's batch helpers to reduce RPC
overhead. Each batch sends a single JSON-RPC request containing multiple
`eth_call` sub-requests.

### Batch Token Balances

```typescript
const results = await client.contracts.getMembershipTokenBalancesBatch({
  walletAddresses: [
    '0x1234567890123456789012345678901234567890',
    '0xAbcdefabcdefabcdefabcdefabcdefabcdefabcd',
    '0x1111111111111111111111111111111111111111',
  ],
});

results.forEach((item, index) => {
  if (item.status === 'success') {
    console.log(`Wallet ${index} balance: ${item.result}`);
  } else {
    console.error(`Wallet ${index} failed: ${item.error}`);
  }
});
```

### Batch Guild Owners

```typescript
const results = await client.contracts.getGuildOwnersBatch({
  guildIds: ['guild_1', 'guild_2', '42'],
});

results.forEach((item, index) => {
  if (item.status === 'success') {
    console.log(`Guild ${index} owner: ${item.result}`);
  } else {
    console.error(`Guild ${index} failed: ${item.error}`);
  }
});
```

### Provider Compatibility

JSON-RPC batch requests work with most modern RPC providers (Infura,
Alchemy, QuickNode, public nodes, etc.). Some providers may impose limits
on the number of calls per batch — if you encounter errors with large
batches, split your input into smaller chunks (e.g., 50–100 items per
batch).

The SDK does **not** batch mutating operations. Only read-only `eth_call`
requests are sent through these helpers. For write operations, use the
individual contract methods or the REST API.

### Partial Failure Handling

Batch calls never fail entirely because of a single problematic item.
Each sub-request is individually resolved in the response:

- **Success**: `{ status: 'success', result: '<decoded-value>' }`
- **RPC error**: `{ status: 'error', error: '<rpc-error-message>' }`
- **Missing response**: `{ status: 'error', error: 'No response for batch item N' }`
- **Malformed result**: `{ status: 'error', error: 'Failed to decode ...' }`

This makes batch calls suitable for production use where you want to
gracefully handle individual failures without losing all results.
