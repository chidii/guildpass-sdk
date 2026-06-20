import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasInjectedWallet, connectWallet, getChainId, switchChain } from '../src/wallet/helpers';

describe('EIP-1193 Wallet Helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', undefined);
  });

  describe('hasInjectedWallet', () => {
    it('should return false if window is undefined', () => {
      expect(hasInjectedWallet()).toBe(false);
    });

    it('should return false if window exists but no ethereum object', () => {
      vi.stubGlobal('window', {});
      expect(hasInjectedWallet()).toBe(false);
    });

    it('should return true if window.ethereum is present', () => {
      vi.stubGlobal('window', { ethereum: {} });
      expect(hasInjectedWallet()).toBe(true);
    });
  });

  describe('connectWallet', () => {
    it('should invoke eth_requestAccounts and return accounts', async () => {
      const mockProvider = {
        request: vi.fn().mockResolvedValue(['0x1234567890123456789012345678901234567890']),
      };
      const result = await connectWallet(mockProvider);
      expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
      expect(result).toEqual(['0x1234567890123456789012345678901234567890']);
    });
  });

  describe('getChainId', () => {
    it('should invoke eth_chainId and return chain ID hex', async () => {
      const mockProvider = {
        request: vi.fn().mockResolvedValue('0x1'),
      };
      const result = await getChainId(mockProvider);
      expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_chainId' });
      expect(result).toBe('0x1');
    });
  });

  describe('switchChain', () => {
    it('should invoke wallet_switchEthereumChain with the correct params', async () => {
      const mockProvider = {
        request: vi.fn().mockResolvedValue(null),
      };
      await switchChain(mockProvider, '0x89'); // Polygon Mainnet hex
      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      });
    });
  });
});