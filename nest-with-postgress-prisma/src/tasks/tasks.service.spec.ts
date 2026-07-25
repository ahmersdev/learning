import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';

describe('TasksService', () => {
  let service: TasksService;
  const projectId = 'project-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('assertCanAccessProject', () => {
    it('resolves without throwing (stub behavior)', async () => {
      await expect(
        service.assertCanAccessProject(projectId, 'user-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates a task with defaults when only title is provided', async () => {
      const dto: CreateTaskDto = { title: 'Design homepage mockup' };

      const result = await service.create(projectId, dto);

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          projectId,
          title: 'Design homepage mockup',
          description: null,
          status: 'backlog',
          priority: 'medium',
          dueDate: null,
          assigneeId: null,
        }),
      );
    });

    it('creates a task using provided status, priority, dueDate, and assigneeId', async () => {
      const dto: CreateTaskDto = {
        title: 'Design homepage mockup',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-08-01T00:00:00.000Z',
        assigneeId: 'user-456',
      };

      const result = await service.create(projectId, dto);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'in_progress',
          priority: 'high',
          dueDate: '2026-08-01T00:00:00.000Z',
          assigneeId: 'user-456',
        }),
      );
    });
  });

  describe('findAll', () => {
    const baseQuery: TaskQueryDto = {
      sortOrder: 'asc',
      page: 1,
      limit: 20,
    };

    it('returns tasks and pagination metadata', async () => {
      const result = await service.findAll(projectId, baseQuery);

      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('reflects the requested status filter in the stub task', async () => {
      const result = await service.findAll(projectId, {
        ...baseQuery,
        status: 'done',
      });

      expect(result.tasks[0]?.status).toBe('done');
    });

    it('reflects the requested page and limit in pagination metadata', async () => {
      const result = await service.findAll(projectId, {
        ...baseQuery,
        page: 3,
        limit: 50,
      });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(50);
    });
  });

  describe('findOne', () => {
    it('returns a task matching the given taskId and projectId', async () => {
      const result = await service.findOne(projectId, 'task-456');

      expect(result).toEqual(
        expect.objectContaining({ id: 'task-456', projectId }),
      );
    });
  });

  describe('update', () => {
    it('throws BadRequestException when no fields are provided', async () => {
      const dto: UpdateTaskDto = {};

      await expect(service.update(projectId, 'task-456', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates title when only title is provided', async () => {
      const dto: UpdateTaskDto = { title: 'Updated title' };

      const result = await service.update(projectId, 'task-456', dto);

      expect(result.title).toBe('Updated title');
    });

    it('updates status when only status is provided', async () => {
      const dto: UpdateTaskDto = { status: 'done' };

      const result = await service.update(projectId, 'task-456', dto);

      expect(result.status).toBe('done');
    });
  });

  describe('remove', () => {
    it('resolves without throwing', async () => {
      await expect(
        service.remove(projectId, 'task-456'),
      ).resolves.toBeUndefined();
    });
  });
});
