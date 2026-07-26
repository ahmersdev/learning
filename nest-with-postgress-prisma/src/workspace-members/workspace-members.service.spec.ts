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

jest.mock('bcrypt', () => ({ hash: jest.fn() }));
import * as bcrypt from 'bcrypt';

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
    user: { findUnique: jest.Mock; create: jest.Mock };
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

  const mockExistingUser: User = {
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
      user: { findUnique: jest.fn(), create: jest.fn() },
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
    it('throws ForbiddenException when requester is not an admin', async () => {
      const dto: CreateWorkspaceMemberDto = {
        email: 'member@example.com',
        role: 'member',
      };

      await expect(service.create('member', workspaceId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    describe('when the user already exists', () => {
      const dto: CreateWorkspaceMemberDto = {
        email: 'member@example.com',
        role: 'member',
      };

      it('adds them as a member without creating a new account or credentials', async () => {
        prisma.user.findUnique.mockResolvedValue(mockExistingUser);
        prisma.workspaceMember.create.mockResolvedValue(mockMembership);

        const result = await service.create('admin', workspaceId, dto);

        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
          data: { workspaceId, userId: mockExistingUser.id, role: dto.role },
        });
        expect(result.member).toEqual(mockMembership);
        expect(result.credentials).toBeNull();
      });

      it('throws ConflictException when the user is already a member (P2002)', async () => {
        prisma.user.findUnique.mockResolvedValue(mockExistingUser);
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
    });

    describe('when the user does not exist', () => {
      const dto: CreateWorkspaceMemberDto = {
        email: 'newperson@example.com',
        fullName: 'New Person',
        role: 'member',
      };

      const newUser: User = {
        ...mockExistingUser,
        id: 'new-user-id',
        email: dto.email,
        username: 'newperson',
        fullName: 'New Person',
        mustChangePassword: true,
      };

      it('creates a new user with role "user" and mustChangePassword true, and returns credentials', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-temp-password');
        prisma.user.create.mockResolvedValue(newUser);
        prisma.workspaceMember.create.mockResolvedValue({
          ...mockMembership,
          userId: newUser.id,
        });

        const result = await service.create('admin', workspaceId, dto);

        expect(prisma.user.create).toHaveBeenCalledWith({
          data: {
            fullName: dto.fullName,
            email: dto.email,
            password: 'hashed-temp-password',
            username: 'newperson',
            role: 'user',
            mustChangePassword: true,
          },
        });
        expect(result.credentials).toEqual({
          username: newUser.username,
          temporaryPassword: expect.any(String),
        });
        expect(result.credentials?.temporaryPassword).toMatch(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{12}$/,
        );
      });

      it('falls back to the derived username as fullName when fullName is not provided', async () => {
        const dtoNoName: CreateWorkspaceMemberDto = {
          email: 'noname@example.com',
          role: 'member',
        };
        prisma.user.findUnique.mockResolvedValue(null);
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-temp-password');
        prisma.user.create.mockResolvedValue({
          ...newUser,
          fullName: 'noname',
        });
        prisma.workspaceMember.create.mockResolvedValue(mockMembership);

        await service.create('admin', workspaceId, dtoNoName);

        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ fullName: 'noname' }),
          }),
        );
      });

      it('retries with a suffixed username when the derived username collides (P2002)', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-temp-password');
        prisma.user.create
          .mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on the fields: (`username`)',
              {
                code: 'P2002',
                clientVersion: '7.9.0',
                meta: { target: ['username'] },
              },
            ),
          )
          .mockResolvedValueOnce(newUser);
        prisma.workspaceMember.create.mockResolvedValue(mockMembership);

        await service.create('admin', workspaceId, dto);

        expect(prisma.user.create).toHaveBeenCalledTimes(2);
        const secondCallUsername =
          prisma.user.create.mock.calls[1][0].data.username;
        expect(secondCallUsername).not.toBe('newperson');
        expect(secondCallUsername.startsWith('newperson')).toBe(true);
      });

      it('throws ConflictException when the email collides during creation (P2002)', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-temp-password');
        prisma.user.create.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`email`)',
            {
              code: 'P2002',
              clientVersion: '7.9.0',
              meta: { target: ['email'] },
            },
          ),
        );

        await expect(service.create('admin', workspaceId, dto)).rejects.toThrow(
          ConflictException,
        );
      });
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
    });

    it('throws ForbiddenException when the target is the workspace owner', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      await expect(
        service.update('admin', workspaceId, ownerId, dto),
      ).rejects.toThrow(ForbiddenException);
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

      expect(result.role).toBe('admin');
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when requester is not an admin', async () => {
      await expect(
        service.remove('member', workspaceId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the target is the workspace owner', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      await expect(
        service.remove('admin', workspaceId, ownerId),
      ).rejects.toThrow(ForbiddenException);
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
