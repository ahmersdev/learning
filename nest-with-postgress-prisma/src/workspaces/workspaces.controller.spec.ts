import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let workspacesService: jest.Mocked<WorkspacesService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
    role: 'admin',
  };

  const mockWorkspace = {
    id: 'w-1',
    ownerId: mockUser.id,
    name: 'Marketing Team',
    description: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    workspacesService = module.get(WorkspacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('calls service.create with userId and dto, returns wrapped response', async () => {
      const dto: CreateWorkspaceDto = { name: 'Marketing Team' };
      const workspace = { ...mockWorkspace, name: dto.name };
      workspacesService.create.mockResolvedValue(workspace);

      const result = await controller.create(mockUser, dto);

      expect(workspacesService.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Workspace created successfully',
        data: { workspace },
      });
    });
  });

  describe('findAll', () => {
    it('calls service.findAll with userId, returns wrapped response', async () => {
      const workspaces = [mockWorkspace];
      workspacesService.findAll.mockResolvedValue(workspaces);

      const result = await controller.findAll(mockUser);

      expect(workspacesService.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ status: 'success', data: { workspaces } });
    });
  });

  describe('findOne', () => {
    it('calls service.findOne with userId and workspaceId, returns wrapped response', async () => {
      const workspace = mockWorkspace;
      workspacesService.findOne.mockResolvedValue(workspace);

      const result = await controller.findOne(mockUser, 'w-1');

      expect(workspacesService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        'w-1',
      );
      expect(result).toEqual({ status: 'success', data: { workspace } });
    });
  });

  describe('update', () => {
    it('calls service.update with userId, workspaceId, and dto, returns wrapped response', async () => {
      const dto: UpdateWorkspaceDto = { name: 'Renamed' };
      const workspace = { ...mockWorkspace, name: 'Renamed' };
      workspacesService.update.mockResolvedValue(workspace);

      const result = await controller.update(mockUser, 'w-1', dto);

      expect(workspacesService.update).toHaveBeenCalledWith(
        mockUser.id,
        'w-1',
        dto,
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Workspace updated successfully',
        data: { workspace },
      });
    });
  });

  describe('remove', () => {
    it('calls service.remove with userId and workspaceId, returns success message', async () => {
      workspacesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockUser, 'w-1');

      expect(workspacesService.remove).toHaveBeenCalledWith(mockUser.id, 'w-1');
      expect(result).toEqual({
        status: 'success',
        message: 'Workspace deleted successfully',
      });
    });
  });
});
