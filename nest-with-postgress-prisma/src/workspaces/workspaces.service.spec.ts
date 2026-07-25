import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import type { Workspace } from '../generated/prisma/client';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prisma: {
    workspace: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const ownerId = 'user-123';

  const mockWorkspace: Workspace = {
    id: 'workspace-456',
    name: 'Marketing Team',
    description: 'Workspace for marketing',
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      workspace: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a workspace with the given ownerId, name, and description', async () => {
      const dto: CreateWorkspaceDto = {
        name: 'Marketing Team',
        description: 'Workspace for marketing',
      };
      prisma.workspace.create.mockResolvedValue(mockWorkspace);

      const result = await service.create(ownerId, dto);

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          description: dto.description,
          ownerId,
          members: { create: { userId: ownerId, role: 'admin' } },
        },
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('creates the owner as an admin member alongside the workspace', async () => {
      const dto: CreateWorkspaceDto = { name: 'Marketing Team' };
      prisma.workspace.create.mockResolvedValue(mockWorkspace);

      await service.create(ownerId, dto);

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          description: null,
          ownerId,
          members: { create: { userId: ownerId, role: 'admin' } },
        },
      });
    });

    it('defaults description to null when not provided', async () => {
      const dto: CreateWorkspaceDto = { name: 'Marketing Team' };
      prisma.workspace.create.mockResolvedValue({
        ...mockWorkspace,
        description: null,
      });

      await service.create(ownerId, dto);

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          description: null,
          ownerId,
          members: { create: { userId: ownerId, role: 'admin' } },
        },
      });
    });
  });

  describe('findAll', () => {
    it('returns workspaces scoped to the given ownerId', async () => {
      prisma.workspace.findMany.mockResolvedValue([mockWorkspace]);

      const result = await service.findAll(ownerId);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: { ownerId },
      });
      expect(result).toEqual([mockWorkspace]);
    });
  });

  describe('findOne', () => {
    it('returns the workspace when it exists and is owned by the caller', async () => {
      prisma.workspace.findFirst.mockResolvedValue(mockWorkspace);

      const result = await service.findOne(ownerId, mockWorkspace.id);

      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: { id: mockWorkspace.id, ownerId },
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('throws NotFoundException when the workspace does not exist or is owned by someone else', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(ownerId, 'someone-elses-workspace'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws BadRequestException when neither name nor description is provided', async () => {
      const dto: UpdateWorkspaceDto = {};

      await expect(
        service.update(ownerId, mockWorkspace.id, dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the workspace does not exist or is owned by someone else', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);
      const dto: UpdateWorkspaceDto = { name: 'Renamed' };

      await expect(
        service.update(ownerId, mockWorkspace.id, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.workspace.update).not.toHaveBeenCalled();
    });

    it('updates only the fields provided', async () => {
      prisma.workspace.findFirst.mockResolvedValue(mockWorkspace);
      prisma.workspace.update.mockResolvedValue({
        ...mockWorkspace,
        name: 'Renamed Workspace',
      });
      const dto: UpdateWorkspaceDto = { name: 'Renamed Workspace' };

      const result = await service.update(ownerId, mockWorkspace.id, dto);

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: mockWorkspace.id },
        data: { name: 'Renamed Workspace' },
      });
      expect(result.name).toBe('Renamed Workspace');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the workspace does not exist or is owned by someone else', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);

      await expect(service.remove(ownerId, mockWorkspace.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.workspace.delete).not.toHaveBeenCalled();
    });

    it('deletes the workspace when it exists and is owned by the caller', async () => {
      prisma.workspace.findFirst.mockResolvedValue(mockWorkspace);
      prisma.workspace.delete.mockResolvedValue(mockWorkspace);

      await service.remove(ownerId, mockWorkspace.id);

      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: mockWorkspace.id },
      });
    });
  });
});
