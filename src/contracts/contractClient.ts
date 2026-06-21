// GuildPass SDK: Pull in package or module bindings.
import { GuildPassError } from '../errors/GuildPassError';
// GuildPass SDK: Import external module dependencies.
import { GuildPassErrorCode } from '../errors/errorCodes';
// GuildPass SDK: Pull in package or module bindings.
import { validateAddress, validateGuildId } from '../utils/validation';
// GuildPass SDK: Import external module dependencies.
import { GuildOwnerParams, RoleRequirementParams, TokenBalanceParams } from './contract.types';
// GuildPass SDK: Pull in package or module bindings.
import { validateRoleRequirementStub } from './contractHelpers';
import { GuildPassClientConfig, resolveChainConfig } from '../config/sdkConfig';

const GET_GUILD_OWNER_SELECTOR = '0xab4511dc';
const HEX_32_BYTES_LENGTH = 64;

type JsonRpcSuccess = {
  result?: unknown;
};

type JsonRpcError = {
  error?: {
    code?: number;
    message?: string;
  };
};

const encodeGuildId = (guildId: string): string => {
  const trimmed = guildId.trim();

  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed.slice(2).toLowerCase();
  }

  if (/^\d+$/.test(trimmed)) {
    const encoded = BigInt(trimmed).toString(16);
    if (encoded.length > HEX_32_BYTES_LENGTH) {
      throw new GuildPassError(
        'guildId is too large for bytes32 encoding',
        GuildPassErrorCode.INVALID_INPUT,
      );
    }
    return encoded.padStart(HEX_32_BYTES_LENGTH, '0');
  }

  const bytes = new TextEncoder().encode(trimmed);
  if (bytes.length > 32) {
    throw new GuildPassError(
      'guildId must fit within 32 UTF-8 bytes',
      GuildPassErrorCode.INVALID_INPUT,
    );
  }

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(HEX_32_BYTES_LENGTH, '0');
};

const decodeAddressResult = (result: unknown): string => {
  if (typeof result !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
    throw new GuildPassError(
      'Invalid getGuildOwner RPC response',
      GuildPassErrorCode.INVALID_RESPONSE,
    );
  }

  const address = `0x${result.slice(-40)}`;
  validateAddress(address);
  return address;
};

// GuildPass SDK: Exported function execution unit.
export class ContractClient {
  // GuildPass SDK: Class member structure property or constructor.
  private readonly config: GuildPassClientConfig;

  // GuildPass SDK: Class member structure property or constructor.
  constructor(config: GuildPassClientConfig) {
    this.config = config;
    // GuildPass SDK: End of logic containment structure block.
  }

  /**
   * Resolves the RPC URL and contract address for the given chain ID (or the
   * client's default chainId when omitted).
   */
  public getChainConfig(chainId?: number) {
    const id = chainId ?? this.config.chainId;
    if (id === undefined) {
      return { rpcUrl: this.config.rpcUrl, contractAddress: this.config.contractAddress };
    }
    return resolveChainConfig(this.config, id);
  }

  /**
   * Fetches the membership token balance for a wallet.
   * Stub for future on-chain support.
   */
  // GuildPass SDK: Class member structure property or constructor.
  public async getMembershipTokenBalance(params: TokenBalanceParams): Promise<string> {
    // GuildPass SDK: Variable binding initialization.
    const { walletAddress, contractAddress = this.config.contractAddress } = params;

    validateAddress(walletAddress);
    // GuildPass SDK: Evaluate branch condition logic.
    if (contractAddress) validateAddress(contractAddress);

    // GuildPass SDK: Raise exceptional condition and throw error.
    throw new GuildPassError(
      'getMembershipTokenBalance is not yet implemented. Requires on-chain provider.',
      GuildPassErrorCode.NOT_IMPLEMENTED,
    );
    // GuildPass SDK: End of logic containment structure block.
  }

  /**
   * Fetches the owner of a guild from the contract.
   */
  // GuildPass SDK: Class member structure property or constructor.
  public async getGuildOwner(params: GuildOwnerParams): Promise<string> {
    const chainConfig = this.getChainConfig(params.chainId);
    const { guildId, contractAddress = chainConfig.contractAddress } = params;
    const rpcUrl = chainConfig.rpcUrl;

    validateGuildId(guildId);

    if (!rpcUrl) {
      throw new GuildPassError(
        'rpcUrl is required for contract calls',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }

    if (!contractAddress) {
      throw new GuildPassError(
        'contractAddress is required for guild owner lookup',
        GuildPassErrorCode.INVALID_CONFIG,
      );
    }

    validateAddress(contractAddress);
    const data = `${GET_GUILD_OWNER_SELECTOR}${encodeGuildId(guildId)}`;

    let response: Response;
    try {
      response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: contractAddress,
              data,
            },
            'latest',
          ],
        }),
      });
    } catch (error) {
      throw new GuildPassError(
        'Unable to reach configured RPC provider',
        GuildPassErrorCode.HTTP_ERROR,
        undefined,
        error,
      );
    }

    const payload = (await response.json().catch(() => undefined)) as
      | (JsonRpcSuccess & JsonRpcError)
      | undefined;

    if (!response.ok) {
      throw GuildPassError.fromHttpError(response.status, payload);
    }

    if (payload?.error) {
      throw new GuildPassError(
        payload.error.message ?? 'RPC provider returned an error',
        GuildPassErrorCode.HTTP_ERROR,
        undefined,
        payload.error,
      );
    }

    return decodeAddressResult(payload?.result);
    // GuildPass SDK: End of logic containment structure block.
  }

  /**
   * Validates a role requirement for a wallet address.
   * Stub for future on-chain support.
   */
  // GuildPass SDK: Class member structure property or constructor.
  public async validateRoleRequirement(params: RoleRequirementParams): Promise<boolean> {
    // GuildPass SDK: Local block-scoped constant reference.
    const { walletAddress, requirement } = params;
    // GuildPass SDK: Return evaluated output value.
    return validateRoleRequirementStub(walletAddress, requirement);
    // GuildPass SDK: End of logic containment structure block.
  }
  // GuildPass SDK: End of logic containment structure block.
}
