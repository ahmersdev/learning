import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { Project, WorkspaceMember } from '../generated/prisma/client';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    workspaceMember: { findUnique: jest.Mock };
    project: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const workspaceId = 'workspace-123';
  const userId = 'user-123';

  const mockProject: Project = {
    id: 'project-456',
    workspaceId,
    name: 'Website Redesign',
    description: 'Q3 refresh',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMembership: WorkspaceMember = {
    id: 'membership-1',
    workspaceId,
    userId,
    role: 'member',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      workspaceMember: { findUnique: jest.fn() },
      project: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assertIsWorkspaceMember', () => {
    it('resolves without throwing when the user is a member', async () => {
      prisma.workspaceMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        service.assertIsWorkspaceMember(workspaceId, userId),
      ).resolves.toBeUndefined();
      expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
    });

    it('throws NotFoundException when the user is not a member', async () => {
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assertIsWorkspaceMember(workspaceId, 'not-a-member'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a project with the given workspaceId, name, and description', async () => {
      const dto: CreateProjectDto = {
        name: 'Website Redesign',
        description: 'Q3 refresh',
      };
      prisma.project.create.mockResolvedValue(mockProject);

      const result = await service.create(workspaceId, dto);

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { workspaceId, name: dto.name, description: dto.description },
      });
      expect(result).toEqual(mockProject);
    });

    it('defaults description to null when not provided', async () => {
      const dto: CreateProjectDto = { name: 'Website Redesign' };
      prisma.project.create.mockResolvedValue({
        ...mockProject,
        description: null,
      });

      await service.create(workspaceId, dto);

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { workspaceId, name: dto.name, description: null },
      });
    });
  });

  describe('findAll', () => {
    it('returns projects scoped to the given workspaceId', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);

      const result = await service.findAll(workspaceId);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
      });
      expect(result).toEqual([mockProject]);
    });
  });

  describe('findOne', () => {
    it('returns the project when it exists in this workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject);

      const result = await service.findOne(workspaceId, mockProject.id);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: mockProject.id, workspaceId },
      });
      expect(result).toEqual(mockProject);
    });

    it('throws NotFoundException when the project does not exist or belongs to a different workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(workspaceId, 'someone-elses-project'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws BadRequestException when neither name nor description is provided', async () => {
      await expect(
        service.update(workspaceId, mockProject.id, {}),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.project.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project does not exist in this workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      const dto: UpdateProjectDto = { name: 'Renamed' };

      await expect(
        service.update(workspaceId, mockProject.id, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('updates only the fields provided', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.project.update.mockResolvedValue({
        ...mockProject,
        name: 'Renamed Project',
      });
      const dto: UpdateProjectDto = { name: 'Renamed Project' };

      const result = await service.update(workspaceId, mockProject.id, dto);

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        data: { name: 'Renamed Project' },
      });
      expect(result.name).toBe('Renamed Project');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the project does not exist in this workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.remove(workspaceId, mockProject.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });

    it('deletes the project when it exists in this workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.project.delete.mockResolvedValue(mockProject);

      await service.remove(workspaceId, mockProject.id);

      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: mockProject.id },
      });
    });
  });
});
