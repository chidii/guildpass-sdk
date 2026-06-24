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
});
```
