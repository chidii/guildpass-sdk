import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuildPassClient } from '../src/client/GuildPassClient';

describe('Service Modules', () => {
  let client: GuildPassClient;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new GuildPassClient({
      apiUrl: 'https://api.test.com',
      fetch: mockFetch,
    });
  });

  describe('AccessService', () => {
    it('should call checkAccess endpoint', async () => {
      const mockResult = { hasAccess: true, matchedRoles: ['admin'] };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResult),
        headers: new Headers(),
      });

      const result = await client.access.checkAccess({
        walletAddress: '0x1234567890123456789012345678901234567890',
        guildId: 'guild_1',
        resourceId: 'res_1',
      });

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/access/check'),
        expect.any(Object),
      );
    });
  });

  describe('MembershipService', () => {
    it('should call membership endpoint', async () => {
      const mockMembership = { isActive: true, roles: ['member'] };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMembership),
        headers: new Headers(),
      });

      const result = await client.membership.getMembership({
        walletAddress: '0x1234567890123456789012345678901234567890',
        guildId: 'guild_1',
      });

      expect(result).toEqual(mockMembership);
    });
  });

  describe('RolesService', () => {
    it('should fetch roles for a guild', async () => {
      const mockRoles = [{ id: '1', name: 'Role 1' }];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRoles),
        headers: new Headers(),
      });

      const result = await client.roles.getRoles({ guildId: 'guild_1' });
      expect(result).toEqual(mockRoles);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild_1/roles'),
        expect.any(Object),
      );
    });

    it('should URL-encode guild IDs in role endpoint paths', async () => {
      const mockRoles = [{ id: '1', name: 'Role 1' }];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRoles),
        headers: new Headers(),
      });

      const result = await client.roles.getRoles({ guildId: 'guild/1' });
      expect(result).toEqual(mockRoles);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild%2F1/roles'),
        expect.any(Object),
      );
    });

    it('should URL-encode wallet addresses and guild IDs in user roles endpoint paths', async () => {
      const mockRoles = [{ id: '1', name: 'Role 1' }];
      const validAddress = '0x' + '1'.repeat(40);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRoles),
        headers: new Headers(),
      });

      const result = await client.roles.getUserRoles({ guildId: 'guild/1', walletAddress: validAddress });
      expect(result).toEqual(mockRoles);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/guilds/guild%2F1/members/${validAddress}/roles`),
        expect.any(Object),
      );
    });
  });

  describe('GuildsService', () => {
    it('should fetch guild info', async () => {
      const mockGuild = { id: 'guild_1', name: 'Test Guild' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGuild),
        headers: new Headers(),
      });

      const result = await client.guilds.getGuild({ guildId: 'guild_1' });
      expect(result).toEqual(mockGuild);
    });

    it('should URL-encode guild IDs in guild endpoint paths', async () => {
      const mockGuild = { id: 'guild/1', name: 'Encoded Guild' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGuild),
        headers: new Headers(),
      });

      const result = await client.guilds.getGuild({ guildId: 'guild/1' });
      expect(result).toEqual(mockGuild);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild%2F1'),
        expect.any(Object),
      );
    });
  });
});
