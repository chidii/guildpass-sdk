// GuildPass SDK: Pull in package or module bindings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// GuildPass SDK: Import external module dependencies.
import { GuildPassClient } from '../src/client/GuildPassClient';
// GuildPass SDK: Pull in package or module bindings.
import { GuildPassErrorCode } from '../src/errors/errorCodes';

const WALLET = '0x1234567890123456789012345678901234567890';
const CONTRACT = '0x0000000000000000000000000000000000000000';
const BASE_URL = 'https://api.test.com';
const RPC_URL = 'https://rpc.test.com';
const OWNER = '0x9999999999999999999999999999999999999999';

const mockFetch = (): ReturnType<typeof vi.fn> => fetch as unknown as ReturnType<typeof vi.fn>;

// GuildPass SDK: Test suite container block.
describe('ContractClient (Stubs)', () => {
  // GuildPass SDK: Local block-scoped constant reference.
  const client = new GuildPassClient({
    apiUrl: BASE_URL,
    rpcUrl: RPC_URL,
    contractAddress: CONTRACT,
    // GuildPass SDK: End of logic containment structure block.
  });
  const walletAddress = WALLET;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch guild owner through eth_call', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: `0x000000000000000000000000${OWNER.slice(2)}`,
        }),
    });

    const owner = await client.contracts.getGuildOwner({ guildId: 'guild_1' });

    expect(owner).toBe(OWNER);
    expect(fetch).toHaveBeenCalledWith(
      RPC_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = JSON.parse(mockFetch().mock.calls[0][1].body as string);
    expect(request.method).toBe('eth_call');
    expect(request.params[0].to).toBe(CONTRACT);
    expect(request.params[0].data).toBe(
      '0xab4511dc6775696c645f3100000000000000000000000000000000000000000000000000',
    );
  });

  it('should encode numeric guild IDs as bytes32', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: `0x000000000000000000000000${OWNER.slice(2)}` }),
    });

    await client.contracts.getGuildOwner({ guildId: '42' });

    const request = JSON.parse(mockFetch().mock.calls[0][1].body as string);
    expect(request.params[0].data).toBe(
      '0xab4511dc000000000000000000000000000000000000000000000000000000000000002a',
    );
  });

  it('should use per-chain config for guild owner lookup', async () => {
    const chainClient = new GuildPassClient({
      apiUrl: BASE_URL,
      chainId: 8453,
      chains: {
        1: {
          rpcUrl: 'https://eth.rpc',
          contractAddress: '0x1111111111111111111111111111111111111111',
        },
        8453: {
          rpcUrl: 'https://base.rpc',
          contractAddress: '0x2222222222222222222222222222222222222222',
        },
      },
    });
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: `0x000000000000000000000000${OWNER.slice(2)}` }),
    });

    await expect(
      chainClient.contracts.getGuildOwner({ guildId: 'guild_1', chainId: 8453 }),
    ).resolves.toBe(OWNER);

    const request = JSON.parse(mockFetch().mock.calls[0][1].body as string);
    expect(fetch).toHaveBeenCalledWith('https://base.rpc', expect.any(Object));
    expect(request.params[0].to).toBe('0x2222222222222222222222222222222222222222');
  });

  it('should support per-call contract override for guild owner lookup', async () => {
    const contractAddress = '0x1111111111111111111111111111111111111111';
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: `0x000000000000000000000000${OWNER.slice(2)}` }),
    });

    await client.contracts.getGuildOwner({ guildId: 'guild_1', contractAddress });

    const request = JSON.parse(mockFetch().mock.calls[0][1].body as string);
    expect(request.params[0].to).toBe(contractAddress);
  });

  it('should throw a clear config error when rpcUrl is missing for guild owner lookup', async () => {
    const clientWithoutRpc = new GuildPassClient({
      apiUrl: BASE_URL,
      contractAddress: CONTRACT,
    });

    await expect(clientWithoutRpc.contracts.getGuildOwner({ guildId: 'guild_1' }))
      .rejects.toMatchObject({
        code: GuildPassErrorCode.INVALID_CONFIG,
        message: 'rpcUrl is required for contract calls',
      });
  });

  it('should throw a clear config error when contractAddress is missing for guild owner lookup', async () => {
    const clientWithoutContract = new GuildPassClient({
      apiUrl: BASE_URL,
      rpcUrl: RPC_URL,
    });

    await expect(clientWithoutContract.contracts.getGuildOwner({ guildId: 'guild_1' }))
      .rejects.toMatchObject({
        code: GuildPassErrorCode.INVALID_CONFIG,
        message: 'contractAddress is required for guild owner lookup',
      });
  });

  it('should reject guild IDs that cannot fit bytes32 encoding', async () => {
    await expect(
      client.contracts.getGuildOwner({ guildId: 'x'.repeat(33) }),
    ).rejects.toMatchObject({
      code: GuildPassErrorCode.INVALID_INPUT,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should surface guild owner RPC errors', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: { code: -32000, message: 'execution reverted' } }),
    });

    await expect(client.contracts.getGuildOwner({ guildId: 'guild_1' }))
      .rejects.toMatchObject({
        code: GuildPassErrorCode.HTTP_ERROR,
        message: 'execution reverted',
      });
  });

  it('should reject malformed guild owner RPC responses', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: '0x1234' }),
    });

    await expect(client.contracts.getGuildOwner({ guildId: 'guild_1' }))
      .rejects.toMatchObject({
        code: GuildPassErrorCode.INVALID_RESPONSE,
      });
  });

  it('should fetch membership token balance through eth_call', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: '0x000000000000000000000000000000000000000000000000000000000000002a',
        }),
    });

    const balance = await client.contracts.getMembershipTokenBalance({ walletAddress });

    expect(balance).toBe('42');
    expect(fetch).toHaveBeenCalledWith(
      RPC_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: CONTRACT,
              data: '0x70a082310000000000000000000000001234567890123456789012345678901234567890',
            },
            'latest',
          ],
        }),
      }),
    );
  });

  it('should resolve chain-specific config for balance checks', async () => {
    const chainClient = new GuildPassClient({
      apiUrl: BASE_URL,
      chains: {
        1: {
          rpcUrl: 'https://eth.rpc',
          contractAddress: '0x1111111111111111111111111111111111111111',
        },
        8453: {
          rpcUrl: 'https://base.rpc',
          contractAddress: '0x2222222222222222222222222222222222222222',
        },
      },
    });
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          result: '0x0000000000000000000000000000000000000000000000000000000000000007',
        }),
    });

    await expect(
      chainClient.contracts.getMembershipTokenBalance({ walletAddress, chainId: 8453 }),
    ).resolves.toBe('7');

    const request = JSON.parse(mockFetch().mock.calls[0][1].body as string);
    expect(fetch).toHaveBeenCalledWith('https://base.rpc', expect.any(Object));
    expect(request.params[0].to).toBe('0x2222222222222222222222222222222222222222');
  });

  it('should support per-call contract addresses for balance checks', async () => {
    const contractAddress = '0x1111111111111111111111111111111111111111';
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          result: '0x0000000000000000000000000000000000000000000000000000000000000000',
        }),
    });

    await expect(
      client.contracts.getMembershipTokenBalance({ walletAddress, contractAddress }),
    ).resolves.toBe('0');

    const request = JSON.parse(mockFetch().mock.calls[0][1].body as string);
    expect(request.params[0].to).toBe(contractAddress);
  });

  it('should throw a clear config error when rpcUrl is missing for balance checks', async () => {
    const clientWithoutRpc = new GuildPassClient({
      apiUrl: BASE_URL,
      contractAddress: CONTRACT,
    });

    await expect(
      clientWithoutRpc.contracts.getMembershipTokenBalance({ walletAddress }),
    ).rejects.toMatchObject({
      code: GuildPassErrorCode.INVALID_CONFIG,
      message: 'rpcUrl is required for contract calls',
    });
  });

  it('should throw a clear config error when contractAddress is missing for balance checks', async () => {
    const clientWithoutContract = new GuildPassClient({
      apiUrl: BASE_URL,
      rpcUrl: RPC_URL,
    });

    await expect(
      clientWithoutContract.contracts.getMembershipTokenBalance({ walletAddress }),
    ).rejects.toMatchObject({
      code: GuildPassErrorCode.INVALID_CONFIG,
      message: 'contractAddress is required for token balance lookup',
    });
  });

  it('should validate wallet addresses before balance RPC calls', async () => {
    await expect(
      client.contracts.getMembershipTokenBalance({ walletAddress: 'not-an-address' }),
    ).rejects.toMatchObject({
      code: GuildPassErrorCode.INVALID_ADDRESS,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should surface balance RPC errors', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: { code: -32000, message: 'execution reverted' } }),
    });

    await expect(
      client.contracts.getMembershipTokenBalance({ walletAddress }),
    ).rejects.toMatchObject({
      code: GuildPassErrorCode.HTTP_ERROR,
      message: 'execution reverted',
    });
  });

  it('should reject malformed balance RPC responses', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: '0x1234' }),
    });

    await expect(
      client.contracts.getMembershipTokenBalance({ walletAddress }),
    ).rejects.toMatchObject({
      code: GuildPassErrorCode.INVALID_RESPONSE,
    });
  });

  // GuildPass SDK: Test suite container block.
  it('should throw NOT_IMPLEMENTED for validateRoleRequirement', async () => {
    await expect(
      client.contracts.validateRoleRequirement({
        walletAddress,
        requirement: { type: 'TOKEN', minAmount: '1' },
        // GuildPass SDK: End of logic containment structure block.
      }),
    ).rejects.toMatchObject({ code: GuildPassErrorCode.NOT_IMPLEMENTED });
    // GuildPass SDK: End of logic containment structure block.
  });
});

describe('ContractClient chain resolution', () => {
  it('resolves single-chain config from top-level rpcUrl/contractAddress', () => {
    const client = new GuildPassClient({
      apiUrl: BASE_URL,
      chainId: 1,
      rpcUrl: 'https://rpc.mainnet.example',
      contractAddress: CONTRACT,
    });
    const cfg = client.contracts.getChainConfig();
    expect(cfg.rpcUrl).toBe('https://rpc.mainnet.example');
    expect(cfg.contractAddress).toBe(CONTRACT);
  });

  it('resolves per-chain config from chains map', () => {
    const client = new GuildPassClient({
      apiUrl: BASE_URL,
      chainId: 8453,
      chains: {
        1: { rpcUrl: 'https://rpc.mainnet.example', contractAddress: CONTRACT },
        8453: {
          rpcUrl: 'https://rpc.base.example',
          contractAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      },
    });
    const cfg = client.contracts.getChainConfig(8453);
    expect(cfg.rpcUrl).toBe('https://rpc.base.example');
    expect(cfg.contractAddress).toBe('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('multi-chain: resolves correct config for each chain ID', () => {
    const client = new GuildPassClient({
      apiUrl: BASE_URL,
      chains: {
        1: {
          rpcUrl: 'https://eth.rpc',
          contractAddress: '0x1111111111111111111111111111111111111111',
        },
        137: {
          rpcUrl: 'https://polygon.rpc',
          contractAddress: '0x2222222222222222222222222222222222222222',
        },
      },
    });
    expect(client.contracts.getChainConfig(1).rpcUrl).toBe('https://eth.rpc');
    expect(client.contracts.getChainConfig(137).rpcUrl).toBe('https://polygon.rpc');
  });

  it('throws INVALID_CONFIG for unsupported chain when chains map is set', () => {
    const client = new GuildPassClient({
      apiUrl: BASE_URL,
      chains: {
        1: { rpcUrl: 'https://eth.rpc' },
      },
    });
    expect(() => client.contracts.getChainConfig(999)).toThrow(
      expect.objectContaining({ code: GuildPassErrorCode.INVALID_CONFIG }),
    );
  });

  it('falls back to top-level rpcUrl/contractAddress when no chains map is set', () => {
    const client = new GuildPassClient({ apiUrl: BASE_URL, chainId: 1 });
    const cfg = client.contracts.getChainConfig(1);
    expect(cfg.rpcUrl).toBeUndefined();
    expect(cfg.contractAddress).toBeUndefined();
  });

  it('returns empty config when no chain-related config is set at all', () => {
    const client = new GuildPassClient({ apiUrl: BASE_URL });
    const cfg = client.contracts.getChainConfig();
    expect(cfg.rpcUrl).toBeUndefined();
    expect(cfg.contractAddress).toBeUndefined();
  });
});
