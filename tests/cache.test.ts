import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GuildPassClient } from '../src/client/GuildPassClient';
import { InMemoryCacheAdapter, CacheAdapter } from '../src/cache/cache.types';

const BASE_CONFIG = { apiUrl: 'https://api.guildpass.xyz' };

// ---------------------------------------------------------------------------
// InMemoryCacheAdapter unit tests
// ---------------------------------------------------------------------------
describe('InMemoryCacheAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a cold key', async () => {
    const adapter = new InMemoryCacheAdapter();
    expect(await adapter.get('missing')).toBeNull();
  });

  it('stores and retrieves a typed value', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('k', { score: 42 });
    expect(await adapter.get<{ score: number }>('k')).toEqual({ score: 42 });
  });

  it('returns null after TTL expires', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('k', 'hello', 1_000);

    vi.advanceTimersByTime(999);
    expect(await adapter.get('k')).toBe('hello');

    vi.advanceTimersByTime(1);
    // Advance one more ms so Date.now() >= expiresAt
    vi.advanceTimersByTime(1);
    expect(await adapter.get('k')).toBeNull();
  });

  it('keeps an entry alive when no TTL is set', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('k', 'forever');
    vi.advanceTimersByTime(1_000_000);
    expect(await adapter.get('k')).toBe('forever');
  });

  it('deletes a single entry', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('k', 1);
    await adapter.delete('k');
    expect(await adapter.get('k')).toBeNull();
  });

  it('clears all entries', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('a', 1);
    await adapter.set('b', 2);
    await adapter.clear();
    expect(await adapter.get('a')).toBeNull();
    expect(await adapter.get('b')).toBeNull();
  });

  it('ignores delete of a non-existent key', async () => {
    const adapter = new InMemoryCacheAdapter();
    await expect(adapter.delete('ghost')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GuildPassClient cache integration
// ---------------------------------------------------------------------------
describe('GuildPassClient – cache integration', () => {
  const mockGuild = {
    id: 'prime-guild',
    name: 'Prime Guild',
    ownerAddress: '0xowner',
    chainId: 1,
  };
  const mockAccess = { hasAccess: true, reason: null };

  function buildMockAdapter(): CacheAdapter & { _store: Map<string, unknown> } {
    const store = new Map<string, { value: unknown; expiresAt: number | null }>();
    return {
      _store: store as unknown as Map<string, unknown>,
      async get<T>(key: string): Promise<T | null> {
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
          store.delete(key);
          return null;
        }
        return entry.value as T;
      },
      async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        store.set(key, { value, expiresAt: ttl !== undefined ? Date.now() + ttl : null });
      },
      async delete(key: string): Promise<void> {
        store.delete(key);
      },
      async clear(): Promise<void> {
        store.clear();
      },
    };
  }

  it('does not cache when no adapter is provided', () => {
    const client = new GuildPassClient(BASE_CONFIG);
    // No error; services are the raw instances.
    expect(client.guilds).toBeDefined();
  });

  it('uses the adapter on a cache miss and populates the cache', async () => {
    const adapter = buildMockAdapter();
    const getSpy = vi.spyOn(adapter, 'get');
    const setSpy = vi.spyOn(adapter, 'set');

    const client = new GuildPassClient({ ...BASE_CONFIG, cache: adapter });

    // Stub the underlying HTTP call.
    vi.spyOn(client['http'] as any, 'get').mockResolvedValue(mockGuild);

    const result = await client.guilds.getGuild({ guildId: 'prime-guild' });

    expect(result).toEqual(mockGuild);
    expect(getSpy).toHaveBeenCalledWith('guilds:getGuild:prime-guild');
    expect(setSpy).toHaveBeenCalledWith('guilds:getGuild:prime-guild', mockGuild, undefined);
  });

  it('returns the cached value on a cache hit without hitting the network', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('guilds:getGuild:prime-guild', mockGuild);

    const client = new GuildPassClient({ ...BASE_CONFIG, cache: adapter });
    const httpSpy = vi.spyOn(client['http'] as any, 'get');

    const result = await client.guilds.getGuild({ guildId: 'prime-guild' });

    expect(result).toEqual(mockGuild);
    expect(httpSpy).not.toHaveBeenCalled();
  });

  it('re-fetches from the network after TTL expiry', async () => {
    vi.useFakeTimers();

    const adapter = new InMemoryCacheAdapter();
    const client = new GuildPassClient({ ...BASE_CONFIG, cache: adapter, cacheTtl: 1_000 });

    const httpGet = vi
      .spyOn(client['http'] as any, 'get')
      .mockResolvedValue(mockGuild);

    await client.guilds.getGuild({ guildId: 'prime-guild' });
    expect(httpGet).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_001);

    await client.guilds.getGuild({ guildId: 'prime-guild' });
    expect(httpGet).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('caches access checks with the correct composite key', async () => {
    const adapter = buildMockAdapter();
    const setSpy = vi.spyOn(adapter, 'set');

    const client = new GuildPassClient({ ...BASE_CONFIG, cache: adapter });
    vi.spyOn(client['http'] as any, 'get').mockResolvedValue(mockAccess);

    await client.access.checkAccess({
      walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      guildId: 'g1',
      resourceId: 'res1',
    });

    expect(setSpy).toHaveBeenCalledWith(
      'access:checkAccess:g1:res1:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      mockAccess,
      undefined,
    );
  });

  it('invalidateGuildCache removes all guild-scoped keys', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('guilds:getGuild:prime-guild', mockGuild);
    await adapter.set('roles:getRoles:prime-guild', []);

    const client = new GuildPassClient({ ...BASE_CONFIG, cache: adapter });
    await client.invalidateGuildCache('prime-guild');

    expect(await adapter.get('guilds:getGuild:prime-guild')).toBeNull();
    expect(await adapter.get('roles:getRoles:prime-guild')).toBeNull();
  });

  it('invalidateGuildCache is a no-op when no adapter is configured', async () => {
    const client = new GuildPassClient(BASE_CONFIG);
    await expect(client.invalidateGuildCache('any')).resolves.toBeUndefined();
  });

  it('clearCache clears the entire adapter store', async () => {
    const adapter = new InMemoryCacheAdapter();
    await adapter.set('a', 1);
    await adapter.set('b', 2);

    const client = new GuildPassClient({ ...BASE_CONFIG, cache: adapter });
    await client.clearCache();

    expect(await adapter.get('a')).toBeNull();
    expect(await adapter.get('b')).toBeNull();
  });

  it('accepts a custom CacheAdapter (e.g. Redis stub)', async () => {
    let internalStore: Record<string, unknown> = {};

    const redisStub: CacheAdapter = {
      async get<T>(key: string): Promise<T | null> {
        return (internalStore[key] ?? null) as T | null;
      },
      async set<T>(key: string, value: T): Promise<void> {
        internalStore[key] = value;
      },
      async delete(key: string): Promise<void> {
        delete internalStore[key];
      },
      async clear(): Promise<void> {
        internalStore = {};
      },
    };

    const client = new GuildPassClient({ ...BASE_CONFIG, cache: redisStub });
    vi.spyOn(client['http'] as any, 'get').mockResolvedValue(mockGuild);

    await client.guilds.getGuild({ guildId: 'prime-guild' });
    expect(internalStore['guilds:getGuild:prime-guild']).toEqual(mockGuild);

    // Second call: stub returns same; HTTP should still not be hit a second time.
    const httpSpy = vi.spyOn(client['http'] as any, 'get');
    await client.guilds.getGuild({ guildId: 'prime-guild' });
    expect(httpSpy).not.toHaveBeenCalled();
  });
});
