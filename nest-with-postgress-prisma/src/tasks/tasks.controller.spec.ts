import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';

describe('TasksController', () => {
  let controller: TasksController;
  let service: jest.Mocked<TasksService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
    role: 'admin',
  };

  const mockProject = {
    id: 'project-456',
    workspaceId: 'workspace-123',
    name: 'Website Redesign',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTask = {
    id: 'task-1',
    projectId: 'project-456',
    title: 'Design homepage mockup',
    description: null,
    status: 'backlog' as const,
    priority: 'medium' as const,
    dueDate: null,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectId = 'project-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            assertCanAccessProject: jest.fn(),
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

    controller = module.get<TasksController>(TasksController);
    service = module.get(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('checks project access, then creates the task', async () => {
      const dto: CreateTaskDto = { title: 'Design homepage mockup' };

      service.assertCanAccessProject.mockResolvedValue(mockProject);
      service.create.mockResolvedValue(mockTask);

      const result = await controller.create(projectId, mockUser, dto);

      expect(service.assertCanAccessProject).toHaveBeenCalledWith(
        projectId,
        mockUser.id,
      );
      expect(service.create).toHaveBeenCalledWith(projectId, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Task created successfully',
        data: { task: mockTask },
      });
    });
  });

  describe('findAll', () => {
    it('checks project access, then returns tasks and pagination', async () => {
      const query: TaskQueryDto = { sortOrder: 'asc', page: 1, limit: 20 };
      const serviceResult = {
        tasks: [mockTask],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      service.assertCanAccessProject.mockResolvedValue(mockProject);
      service.findAll.mockResolvedValue(serviceResult);

      const result = await controller.findAll(projectId, mockUser, query);

      expect(service.assertCanAccessProject).toHaveBeenCalledWith(
        projectId,
        mockUser.id,
      );
      expect(service.findAll).toHaveBeenCalledWith(projectId, query);
      expect(result).toEqual({
        status: 'success',
        data: {
          tasks: serviceResult.tasks,
          pagination: serviceResult.pagination,
        },
      });
    });
  });

  describe('findOne', () => {
    it('checks project access, then returns the task', async () => {
      service.assertCanAccessProject.mockResolvedValue(mockProject);
      service.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne(projectId, 't-1', mockUser);

      expect(service.assertCanAccessProject).toHaveBeenCalledWith(
        projectId,
        mockUser.id,
      );
      expect(service.findOne).toHaveBeenCalledWith(projectId, 't-1');
      expect(result).toEqual({ status: 'success', data: { task: mockTask } });
    });
  });

  describe('update', () => {
    it('checks project access, then updates the task', async () => {
      const dto: UpdateTaskDto = { status: 'done' };
      const updatedTask = { ...mockTask, status: 'done' as const };

      service.assertCanAccessProject.mockResolvedValue(mockProject);
      service.update.mockResolvedValue(updatedTask);

      const result = await controller.update(projectId, 't-1', mockUser, dto);

      expect(service.assertCanAccessProject).toHaveBeenCalledWith(
        projectId,
        mockUser.id,
      );
      expect(service.update).toHaveBeenCalledWith(projectId, 't-1', dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Task updated successfully',
        data: { task: updatedTask },
      });
    });
  });

  describe('remove', () => {
    it('checks project access, then removes the task', async () => {
      service.assertCanAccessProject.mockResolvedValue(mockProject);
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(projectId, 't-1', mockUser);

      expect(service.assertCanAccessProject).toHaveBeenCalledWith(
        projectId,
        mockUser.id,
      );
      expect(service.remove).toHaveBeenCalledWith(projectId, 't-1');
      expect(result).toEqual({
        status: 'success',
        message: 'Task deleted successfully',
      });
    });
  });
});
