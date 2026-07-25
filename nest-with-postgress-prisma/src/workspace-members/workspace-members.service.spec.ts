import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceMembersService } from './workspace-members.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import type {
  User,
  Workspace,
  WorkspaceMember,
} from '../generated/prisma/client';

describe('WorkspaceMembersService', () => {
  let service: WorkspaceMembersService;
  let prisma: {
    workspaceMember: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    workspace: { findUnique: jest.Mock };
  };

  const workspaceId = 'workspace-123';
  const ownerId = 'owner-999';
  const targetUserId = 'user-456';

  const mockWorkspace: Workspace = {
    id: workspaceId,
    name: 'Marketing Team',
    description: null,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTargetUser: User = {
    id: targetUserId,
    fullName: 'Target User',
    username: 'targetuser',
    email: 'member@example.com',
    password: 'hashed',
    role: 'user',
    mustChangePassword: false,
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMembership: WorkspaceMember = {
    id: 'membership-1',
    workspaceId,
    userId: targetUserId,
    role: 'member',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      workspaceMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      workspace: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceMembersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkspaceMembersService>(WorkspaceMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRequesterRole', () => {
    it('returns the role from the membership row', async () => {
      prisma.workspaceMember.findUnique.mockResolvedValue(mockMembership);

      const result = await service.getRequesterRole(workspaceId, targetUserId);

      expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      });
      expect(result).toBe('member');
    });

    it('throws NotFoundException when the user has no membership in this workspace', async () => {
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getRequesterRole(workspaceId, 'not-a-member'),
      ).rejects.toThrow(NotFoundException);
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
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no user exists with the given email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create('admin', workspaceId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user is already a member (P2002)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockTargetUser);
      prisma.workspaceMember.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`workspaceId`,`userId`)',
          { code: 'P2002', clientVersion: '7.9.0' },
        ),
      );

      await expect(service.create('admin', workspaceId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates the member when requester is an admin and the user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockTargetUser);
      prisma.workspaceMember.create.mockResolvedValue(mockMembership);

      const result = await service.create('admin', workspaceId, dto);

      expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
        data: { workspaceId, userId: mockTargetUser.id, role: dto.role },
      });
      expect(result).toEqual(mockMembership);
    });
  });

  describe('findAll', () => {
    it('returns members scoped to the given workspaceId', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([mockMembership]);

      const result = await service.findAll(workspaceId);

      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
      });
      expect(result).toEqual([mockMembership]);
    });
  });

  describe('update', () => {
    const dto: UpdateWorkspaceMemberDto = { role: 'admin' };

    it('throws ForbiddenException when requester is not an admin', async () => {
      await expect(
        service.update('member', workspaceId, targetUserId, dto),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the target is the workspace owner', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      await expect(
        service.update('admin', workspaceId, ownerId, dto),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target has no membership', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.update('admin', workspaceId, targetUserId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the role when requester is an admin and target is a real member', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspaceMember.findUnique.mockResolvedValue(mockMembership);
      prisma.workspaceMember.update.mockResolvedValue({
        ...mockMembership,
        role: 'admin',
      });

      const result = await service.update(
        'admin',
        workspaceId,
        targetUserId,
        dto,
      );

      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: mockMembership.id },
        data: { role: 'admin' },
      });
      expect(result.role).toBe('admin');
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when requester is not an admin', async () => {
      await expect(
        service.remove('member', workspaceId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the target is the workspace owner', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      await expect(
        service.remove('admin', workspaceId, ownerId),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target has no membership', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('admin', workspaceId, targetUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the membership when requester is an admin and target is a real member', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspaceMember.findUnique.mockResolvedValue(mockMembership);
      prisma.workspaceMember.delete.mockResolvedValue(mockMembership);

      await service.remove('admin', workspaceId, targetUserId);

      expect(prisma.workspaceMember.delete).toHaveBeenCalledWith({
        where: { id: mockMembership.id },
      });
    });
  });
});
