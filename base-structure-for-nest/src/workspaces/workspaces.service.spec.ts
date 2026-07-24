import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  const ownerId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspacesService],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  describe('create', () => {
    it('creates a workspace with the given ownerId, name, and description', async () => {
      const dto: CreateWorkspaceDto = {
        name: 'Marketing Team',
        description: 'Workspace for marketing',
      };

      const result = await service.create(ownerId, dto);

      expect(result).toEqual({
        id: expect.any(String),
        ownerId,
        name: 'Marketing Team',
        description: 'Workspace for marketing',
      });
    });

    it('defaults description to null when not provided', async () => {
      const dto: CreateWorkspaceDto = { name: 'Marketing Team' };

      const result = await service.create(ownerId, dto);

      expect(result.description).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns an array of workspaces for the given ownerId', async () => {
      const result = await service.findAll(ownerId);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(
        expect.objectContaining({ ownerId, name: expect.any(String) }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a workspace matching the given workspaceId and ownerId', async () => {
      const result = await service.findOne(ownerId, 'workspace-456');

      expect(result).toEqual(
        expect.objectContaining({ id: 'workspace-456', ownerId }),
      );
    });
  });

  describe('update', () => {
    it('throws BadRequestException when neither name nor description is provided', async () => {
      const dto: UpdateWorkspaceDto = {};

      await expect(
        service.update(ownerId, 'workspace-456', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates name when only name is provided', async () => {
      const dto: UpdateWorkspaceDto = { name: 'Renamed Workspace' };

      const result = await service.update(ownerId, 'workspace-456', dto);

      expect(result.name).toBe('Renamed Workspace');
    });

    it('updates description when only description is provided', async () => {
      const dto: UpdateWorkspaceDto = { description: 'New description' };

      const result = await service.update(ownerId, 'workspace-456', dto);

      expect(result.description).toBe('New description');
    });
  });

  describe('remove', () => {
    it('resolves without throwing', async () => {
      await expect(
        service.remove(ownerId, 'workspace-456'),
      ).resolves.toBeUndefined();
    });
  });
});
