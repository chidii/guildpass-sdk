// GuildPass SDK: Pull in package or module bindings.
import { describe, it, expect, vi, beforeEach } from 'vitest';
// GuildPass SDK: Import external module dependencies.
import { HttpClient } from '../src/http/httpClient';
// GuildPass SDK: Pull in package or module bindings.
import { GuildPassErrorCode } from '../src/errors/errorCodes';

// GuildPass SDK: Test suite container block.
describe('HttpClient', () => {
  // GuildPass SDK: Variable binding initialization.
  const baseUrl = 'https://api.test.com';
  // GuildPass SDK: Local block-scoped constant reference.
  let client: HttpClient;
  let mockFetch: any;

  // GuildPass SDK: Execution block boundary initialization.
  beforeEach(() => {
    mockFetch = vi.fn();
    client = new HttpClient(baseUrl, undefined, 10000, undefined, mockFetch);
    // GuildPass SDK: End of logic containment structure block.
  });

  // GuildPass SDK: Validate unit assertion test case.
  it('should use custom fetch implementation if provided', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'custom' }),
      headers: new Headers(),
    });

    const clientWithCustomFetch = new HttpClient(baseUrl, undefined, 10000, undefined, customFetch);
    const result = await clientWithCustomFetch.get('/custom-path');

    expect(result).toEqual({ data: 'custom' });
    expect(customFetch).toHaveBeenCalledWith(
      expect.stringContaining('/custom-path'),
      expect.any(Object),
    );
  });

  it('should throw MISSING_FETCH error if no fetch implementation is available', () => {
    const originalFetch = globalThis.fetch;
    // @ts-ignore
    delete globalThis.fetch;

    try {
      expect(() => new HttpClient(baseUrl)).toThrow();
      try {
        new HttpClient(baseUrl);
      } catch (error: any) {
        expect(error.code).toBe(GuildPassErrorCode.MISSING_FETCH);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should make GET request with correct URL and headers', async () => {
    // GuildPass SDK: Define internal reference identifier.
    const mockResponse = { data: 'test' };
    // GuildPass SDK: Execution block boundary initialization.
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
      headers: new Headers(),
      // GuildPass SDK: End of logic containment structure block.
    });

    // GuildPass SDK: Variable binding initialization.
    const result = await client.get('/test-path', { params: { foo: 'bar' } });

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-path?foo=bar'),
      // GuildPass SDK: Execution block boundary initialization.
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('should include API key in headers if provided', async () => {
    const clientWithKey = new HttpClient(baseUrl, 'secret-key', 10000, undefined, mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      headers: new Headers(),
    });

    await clientWithKey.get('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'secret-key',
        }),
      }),
    );
  });

  it('should throw GuildPassError on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not Found' }),
    });

    try {
      await client.get('/not-found');
    } catch (error: any) {
      expect(error.code).toBe(GuildPassErrorCode.NOT_FOUND);
      expect(error.status).toBe(404);
    }
  });

  it('should throw TIMEOUT error on abort', async () => {
    mockFetch.mockImplementation(() => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    try {
      await client.get('/timeout');
    } catch (error: any) {
      expect(error.code).toBe(GuildPassErrorCode.TIMEOUT);
    }
  });

  it('should throw REQUEST_CANCELLED when external signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    try {
      await client.get('/cancelled', { signal: controller.signal });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.code).toBe(GuildPassErrorCode.REQUEST_CANCELLED);
      expect(error.message).toContain('cancelled by caller');
    }
  });

  it('should throw REQUEST_CANCELLED when external signal is aborted during request', async () => {
    const controller = new AbortController();

    mockFetch.mockImplementation(() => {
      controller.abort();
      const error = new Error('AbortError');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    try {
      await client.get('/cancelled', { signal: controller.signal });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.code).toBe(GuildPassErrorCode.REQUEST_CANCELLED);
    }
  });
});

describe('HttpClient Hooks', () => {
  const baseUrl = 'https://api.test.com';
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('should call onRequest and onResponse successfully', async () => {
    const onRequest = vi.fn();
    const onResponse = vi.fn();
    const client = new HttpClient(baseUrl, undefined, 10000, { onRequest, onResponse }, mockFetch);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
      headers: new Headers(),
    });

    await client.get('/hook-test');

    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/hook-test' }),
    );
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/hook-test',
        status: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it('should call onRequest before the network request is made', async () => {
    const onRequest = vi.fn().mockImplementation(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
    const client = new HttpClient(baseUrl, undefined, 10000, { onRequest }, mockFetch);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
      headers: new Headers(),
    });

    await client.get('/ordering-test');

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not expose sensitive request details in hook payloads', async () => {
    const onRequest = vi.fn();
    const client = new HttpClient(baseUrl, 'secret-key', 10000, { onRequest }, mockFetch);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      headers: new Headers(),
    });

    await client.post('/safe-test', { secret: 'value' });

    const payload = onRequest.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ method: 'POST', path: '/safe-test' }));
    expect(payload).not.toHaveProperty('apiKey');
    expect(payload).not.toHaveProperty('body');
  });

  it('should call onError when request fails and normalise error', async () => {
    const onError = vi.fn();
    const client = new HttpClient(baseUrl, undefined, 10000, { onError }, mockFetch);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    });

    try {
      await client.get('/fail-test');
    } catch (e) {}

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/fail-test',
        durationMs: expect.any(Number),
        error: expect.objectContaining({
          status: 403,
        }),
      }),
    );
  });

  it('should not mask request result if hook throws', async () => {
    const onRequest = vi.fn().mockRejectedValue(new Error('Hook failed'));
    const onResponse = vi.fn().mockImplementation(() => {
      throw new Error('Hook failed sync');
    });
    const client = new HttpClient(baseUrl, undefined, 10000, { onRequest, onResponse }, mockFetch);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
      headers: new Headers(),
    });

    const result = await client.get('/survive-hook');
    expect(result).toEqual({ success: true });
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
