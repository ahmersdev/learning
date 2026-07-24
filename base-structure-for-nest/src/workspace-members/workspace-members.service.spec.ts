import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceMembersService } from './workspace-members.service';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

describe('WorkspaceMembersService', () => {
  let service: WorkspaceMembersService;
  const workspaceId = 'workspace-123';
  const targetUserId = 'user-456';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspaceMembersService],
    }).compile();

    service = module.get<WorkspaceMembersService>(WorkspaceMembersService);
  });

  describe('getRequesterRole', () => {
    it('returns "admin" as a stub value', async () => {
      const result = await service.getRequesterRole(workspaceId, 'user-123');

      expect(result).toBe('admin');
    });
  });

  describe('create', () => {
    const dto: CreateWorkspaceMemberDto = {
      email: 'member@example.com',
      role: 'member',
    };

    it('throws ForbiddenException when requester is not an admin', async () => {
      await expect(service.create('member', workspaceId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a member when requester is an admin', async () => {
      const result = await service.create('admin', workspaceId, dto);

      expect(result).toEqual({
        id: expect.any(String),
        workspaceId,
        email: dto.email,
        role: dto.role,
      });
    });
  });

  describe('findAll', () => {
    it('returns an array of members for the given workspaceId', async () => {
      const result = await service.findAll(workspaceId);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(
        expect.objectContaining({ workspaceId, role: expect.any(String) }),
      );
    });
  });

  describe('update', () => {
    const dto: UpdateWorkspaceMemberDto = { role: 'admin' };

    it('throws ForbiddenException when requester is not an admin', async () => {
      await expect(
        service.update('member', workspaceId, targetUserId, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates the member role when requester is an admin', async () => {
      const result = await service.update(
        'admin',
        workspaceId,
        targetUserId,
        dto,
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: targetUserId,
          workspaceId,
          role: 'admin',
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when requester is not an admin', async () => {
      await expect(
        service.remove('member', workspaceId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('resolves without throwing when requester is an admin', async () => {
      await expect(
        service.remove('admin', workspaceId, targetUserId),
      ).resolves.toBeUndefined();
    });
  });
});
