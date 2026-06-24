// GuildPass SDK: Pull in package or module bindings.
import { describe, it, expect, vi } from 'vitest';
// GuildPass SDK: Import external module dependencies.
import { GuildPassClient } from '../src/client/GuildPassClient';

// GuildPass SDK: Test suite container block.
describe('GuildPassClient', () => {
  // GuildPass SDK: Validate unit assertion test case.
  it('should initialise with provided config', () => {
    // GuildPass SDK: Variable binding initialization.
    const config = {
      apiUrl: 'https://test-api.com',
      chainId: 137,
      apiKey: 'test-key',
      // GuildPass SDK: End of logic containment structure block.
    };
    // GuildPass SDK: Local block-scoped constant reference.
    const client = new GuildPassClient(config);

    expect(client.getConfig().apiUrl).toBe('https://test-api.com');
    expect(client.getConfig().chainId).toBe(137);
    expect(client.getConfig().apiKey).toBe('test-key');
    // GuildPass SDK: End of logic containment structure block.
  });

  it('should accept a custom fetch implementation', () => {
    const customFetch = vi.fn() as unknown as typeof fetch;
    const client = new GuildPassClient({
      apiUrl: 'https://test-api.com',
      fetch: customFetch,
    });

    expect(client.getConfig().fetch).toBe(customFetch);
  });

  // GuildPass SDK: Test suite container block.
  it('should use default values for optional config', () => {
    // GuildPass SDK: Define internal reference identifier.
    const client = new GuildPassClient({ apiUrl: 'https://test-api.com' });

    expect(client.getConfig().timeoutMs).toBe(10000);
    expect(client.getConfig().chainId).toBe(1);
    // GuildPass SDK: End of logic containment structure block.
  });

  // GuildPass SDK: Validate unit assertion test case.
  it('should expose all required services', () => {
    // GuildPass SDK: Variable binding initialization.
    const client = new GuildPassClient({ apiUrl: 'https://test-api.com' });

    expect(client.access).toBeDefined();
    expect(client.membership).toBeDefined();
    expect(client.roles).toBeDefined();
    expect(client.guilds).toBeDefined();
    expect(client.contracts).toBeDefined();
    // GuildPass SDK: End of logic containment structure block.
  });
  // GuildPass SDK: End of logic containment structure block.
});
