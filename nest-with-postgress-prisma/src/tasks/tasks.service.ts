import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Project, Task } from '../generated/prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessProject(
    projectId: string,
    userId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: project.workspaceId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async assertAssigneeIsWorkspaceMember(
    workspaceId: string,
    assigneeId: string,
  ): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
    });

    if (!membership) {
      throw new BadRequestException(
        'assigneeId must be a member of this workspace',
      );
    }
  }

  private async getProjectOrThrow(projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(projectId: string, dto: CreateTaskDto): Promise<Task> {
    // Re-fetched here (not passed from the controller's earlier
    // assertCanAccessProject call) since we need workspaceId for the
    // assignee check and the controller discards that return value.
    const project = await this.getProjectOrThrow(projectId);

    if (dto.assigneeId) {
      await this.assertAssigneeIsWorkspaceMember(
        project.workspaceId,
        dto.assigneeId,
      );
    }

    return this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description ?? null,
        status: dto.status ?? 'backlog',
        priority: dto.priority ?? 'medium',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId ?? null,
      },
    });
  }

  async findAll(projectId: string, query: TaskQueryDto) {
    const { status, priority, assigneeId, sortBy, sortOrder, page, limit } =
      query;

    const where: Prisma.TaskWhereInput = {
      projectId,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assigneeId }),
    };

    const orderBy: Prisma.TaskOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(projectId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const hasAtLeastOneField = Object.values(dto).some((v) => v !== undefined);
    if (!hasAtLeastOneField) {
      throw new BadRequestException('At least one field must be provided');
    }

    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (dto.assigneeId) {
      const project = await this.getProjectOrThrow(projectId);
      await this.assertAssigneeIsWorkspaceMember(
        project.workspaceId,
        dto.assigneeId,
      );
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.assigneeId !== undefined && {
          assigneeId: dto.assigneeId ?? null,
        }),
      },
    });
  }

  async remove(projectId: string, taskId: string): Promise<void> {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.delete({ where: { id: taskId } });
  }
}
