import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const workspaceId = 'workspace-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('assertIsWorkspaceMember', () => {
    it('resolves without throwing (stub behavior)', async () => {
      await expect(
        service.assertIsWorkspaceMember(workspaceId, 'user-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates a project with the given workspaceId, name, and description', async () => {
      const dto: CreateProjectDto = {
        name: 'Website Redesign',
        description: 'Q3 refresh',
      };

      const result = await service.create(workspaceId, dto);

      expect(result).toEqual({
        id: expect.any(String),
        workspaceId,
        name: 'Website Redesign',
        description: 'Q3 refresh',
      });
    });

    it('defaults description to null when not provided', async () => {
      const dto: CreateProjectDto = { name: 'Website Redesign' };

      const result = await service.create(workspaceId, dto);

      expect(result.description).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns an array of projects for the given workspaceId', async () => {
      const result = await service.findAll(workspaceId);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(
        expect.objectContaining({ workspaceId, name: expect.any(String) }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a project matching the given projectId and workspaceId', async () => {
      const result = await service.findOne(workspaceId, 'project-456');

      expect(result).toEqual(
        expect.objectContaining({ id: 'project-456', workspaceId }),
      );
    });
  });

  describe('update', () => {
    it('throws BadRequestException when neither name nor description is provided', async () => {
      const dto: UpdateProjectDto = {};

      await expect(
        service.update(workspaceId, 'project-456', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates name when only name is provided', async () => {
      const dto: UpdateProjectDto = { name: 'Renamed Project' };

      const result = await service.update(workspaceId, 'project-456', dto);

      expect(result.name).toBe('Renamed Project');
    });

    it('updates description when only description is provided', async () => {
      const dto: UpdateProjectDto = { description: 'New description' };

      const result = await service.update(workspaceId, 'project-456', dto);

      expect(result.description).toBe('New description');
    });
  });

  describe('remove', () => {
    it('resolves without throwing', async () => {
      await expect(
        service.remove(workspaceId, 'project-456'),
      ).resolves.toBeUndefined();
    });
  });
});
