import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let service: jest.Mocked<ProjectsService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
  };
  const workspaceId = 'workspace-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: {
            assertIsWorkspaceMember: jest.fn(),
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
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
    service = module.get(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('checks membership, then creates the project', async () => {
      const dto: CreateProjectDto = { name: 'Website Redesign' };
      const project = {
        id: 'p-1',
        workspaceId,
        name: dto.name,
        description: null,
      };

      service.assertIsWorkspaceMember.mockResolvedValue(undefined);
      service.create.mockResolvedValue(project);

      const result = await controller.create(workspaceId, mockUser, dto);

      expect(service.assertIsWorkspaceMember).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.create).toHaveBeenCalledWith(workspaceId, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Project created successfully',
        data: { project },
      });
    });
  });

  describe('findAll', () => {
    it('checks membership, then lists projects', async () => {
      const projects = [
        { id: 'p-1', workspaceId, name: 'Stub', description: null },
      ];

      service.assertIsWorkspaceMember.mockResolvedValue(undefined);
      service.findAll.mockResolvedValue(projects);

      const result = await controller.findAll(workspaceId, mockUser);

      expect(service.assertIsWorkspaceMember).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.findAll).toHaveBeenCalledWith(workspaceId);
      expect(result).toEqual({ status: 'success', data: { projects } });
    });
  });

  describe('findOne', () => {
    it('checks membership, then returns the project', async () => {
      const project = {
        id: 'p-1',
        workspaceId,
        name: 'Stub',
        description: null,
      };

      service.assertIsWorkspaceMember.mockResolvedValue(undefined);
      service.findOne.mockResolvedValue(project);

      const result = await controller.findOne(workspaceId, 'p-1', mockUser);

      expect(service.assertIsWorkspaceMember).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.findOne).toHaveBeenCalledWith(workspaceId, 'p-1');
      expect(result).toEqual({ status: 'success', data: { project } });
    });
  });

  describe('update', () => {
    it('checks membership, then updates the project', async () => {
      const dto: UpdateProjectDto = { name: 'Renamed' };
      const project = {
        id: 'p-1',
        workspaceId,
        name: 'Renamed',
        description: null,
      };

      service.assertIsWorkspaceMember.mockResolvedValue(undefined);
      service.update.mockResolvedValue(project);

      const result = await controller.update(workspaceId, 'p-1', mockUser, dto);

      expect(service.assertIsWorkspaceMember).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.update).toHaveBeenCalledWith(workspaceId, 'p-1', dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Project updated successfully',
        data: { project },
      });
    });
  });

  describe('remove', () => {
    it('checks membership, then removes the project', async () => {
      service.assertIsWorkspaceMember.mockResolvedValue(undefined);
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(workspaceId, 'p-1', mockUser);

      expect(service.assertIsWorkspaceMember).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.remove).toHaveBeenCalledWith(workspaceId, 'p-1');
      expect(result).toEqual({
        status: 'success',
        message: 'Project deleted successfully',
      });
    });
  });
});
