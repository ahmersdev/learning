import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import type {
  Project,
  Task,
  WorkspaceMember,
} from '../generated/prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: {
    project: { findUnique: jest.Mock };
    workspaceMember: { findUnique: jest.Mock };
    task: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const workspaceId = 'workspace-123';
  const projectId = 'project-456';
  const userId = 'user-789';
  const assigneeId = 'user-999';

  const mockProject: Project = {
    id: projectId,
    workspaceId,
    name: 'Website Redesign',
    description: null,
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

  const mockTask: Task = {
    id: 'task-1',
    projectId,
    title: 'Design homepage mockup',
    description: null,
    status: 'backlog',
    priority: 'medium',
    dueDate: null,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn() },
      workspaceMember: { findUnique: jest.fn() },
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assertCanAccessProject', () => {
    it('returns the project when it exists and the user is a workspace member', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.workspaceMember.findUnique.mockResolvedValue(mockMembership);

      const result = await service.assertCanAccessProject(projectId, userId);

      expect(result).toEqual(mockProject);
    });

    it('throws NotFoundException when the project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanAccessProject(projectId, userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user is not a member of the workspace', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanAccessProject(projectId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto: CreateTaskDto = { title: 'Design homepage mockup' };

    it('creates a task with defaults when optional fields are omitted', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.task.create.mockResolvedValue(mockTask);

      const result = await service.create(projectId, dto);

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          projectId,
          title: dto.title,
          description: null,
          status: 'backlog',
          priority: 'medium',
          dueDate: null,
          assigneeId: null,
        },
      });
      expect(result).toEqual(mockTask);
    });

    it('throws NotFoundException when the project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.create(projectId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when assigneeId is not a workspace member', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create(projectId, { ...dto, assigneeId }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('creates the task when assigneeId is a valid workspace member', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.workspaceMember.findUnique.mockResolvedValue({
        ...mockMembership,
        userId: assigneeId,
      });
      prisma.task.create.mockResolvedValue({ ...mockTask, assigneeId });

      await service.create(projectId, { ...dto, assigneeId });

      expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
      });
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assigneeId }),
        }),
      );
    });

    it('converts dueDate to a real Date before saving', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.task.create.mockResolvedValue(mockTask);

      await service.create(projectId, {
        ...dto,
        dueDate: '2026-08-01T00:00:00.000Z',
      });

      const savedData = prisma.task.create.mock.calls[0][0].data;
      expect(savedData.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    const baseQuery: TaskQueryDto = { sortOrder: 'asc', page: 1, limit: 20 };

    it('applies filters, pagination, and default sort by createdAt', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      const result = await service.findAll(projectId, baseQuery);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        tasks: [mockTask],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('filters by status, priority, and assigneeId when provided', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await service.findAll(projectId, {
        ...baseQuery,
        status: 'in_progress',
        priority: 'high',
        assigneeId,
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId,
            status: 'in_progress',
            priority: 'high',
            assigneeId,
          },
        }),
      );
    });

    it('sorts by the requested field when sortBy is provided', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await service.findAll(projectId, {
        ...baseQuery,
        sortBy: 'dueDate',
        sortOrder: 'desc',
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { dueDate: 'desc' } }),
      );
    });

    it('computes correct skip/take for page 2', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(45);

      const result = await service.findAll(projectId, {
        ...baseQuery,
        page: 2,
        limit: 20,
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.pagination.totalPages).toBe(3);
    });

    it('returns totalPages 1 when there are no matching tasks', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const result = await service.findAll(projectId, baseQuery);

      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns the task when it exists in this project', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      const result = await service.findOne(projectId, mockTask.id);

      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: mockTask.id, projectId },
      });
      expect(result).toEqual(mockTask);
    });

    it('throws NotFoundException when the task does not exist in this project', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.findOne(projectId, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws BadRequestException when no field is provided', async () => {
      await expect(service.update(projectId, mockTask.id, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the task does not exist in this project', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.update(projectId, mockTask.id, { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when assigneeId is not a workspace member', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.update(projectId, mockTask.id, { assigneeId }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('updates only the fields provided, without defaulting untouched fields', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.task.update.mockResolvedValue({
        ...mockTask,
        status: 'in_progress',
      });

      const result = await service.update(projectId, mockTask.id, {
        status: 'in_progress',
      });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: mockTask.id },
        data: { status: 'in_progress' },
      });
      expect(result.status).toBe('in_progress');
    });

    it('clears assigneeId when explicitly set to null', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...mockTask, assigneeId });
      prisma.task.update.mockResolvedValue({ ...mockTask, assigneeId: null });

      await service.update(projectId, mockTask.id, { assigneeId: null });

      expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: mockTask.id },
        data: { assigneeId: null },
      });
    });

    it('reassigns to a new valid workspace member', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.workspaceMember.findUnique.mockResolvedValue({
        ...mockMembership,
        userId: assigneeId,
      });
      prisma.task.update.mockResolvedValue({ ...mockTask, assigneeId });

      const result = await service.update(projectId, mockTask.id, {
        assigneeId,
      });

      expect(result.assigneeId).toBe(assigneeId);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the task does not exist in this project', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.remove(projectId, mockTask.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('deletes the task when it exists in this project', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.task.delete.mockResolvedValue(mockTask);

      await service.remove(projectId, mockTask.id);

      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: mockTask.id },
      });
    });
  });
});
