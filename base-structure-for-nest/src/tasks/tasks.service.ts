import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskPriority, TaskStatus } from './task-enums';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  createdAt: string;
}

@Injectable()
export class TasksService {
  // TODO: once DB is wired up:
  // - assertCanAccessProject should look up the project, find its parent
  //   workspaceId, and confirm the requesting user is a member of that
  //   workspace (throw NotFoundException "Project not found" if either the
  //   project doesn't exist or the user isn't a member — don't leak
  //   existence of projects the user can't access)
  // - all methods should perform real queries/writes scoped to projectId

  async assertCanAccessProject(
    projectId: string,
    userId: string,
  ): Promise<void> {
    void projectId;
    void userId;
    // TODO: check project exists + user is a member of its workspace
    return;
  }

  async create(projectId: string, dto: CreateTaskDto): Promise<Task> {
    return {
      id: randomUUID(),
      projectId,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? 'backlog',
      priority: dto.priority ?? 'medium',
      dueDate: dto.dueDate ?? null,
      assigneeId: dto.assigneeId ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async findAll(projectId: string, query: TaskQueryDto) {
    // TODO: build a real filtered/sorted/paginated DB query using
    // query.status, query.priority, query.assigneeId, query.sortBy,
    // query.sortOrder, query.page, query.limit

    const stubTask: Task = {
      id: randomUUID(),
      projectId,
      title: 'Stub Task',
      description: null,
      status: query.status ?? 'backlog',
      priority: query.priority ?? 'medium',
      dueDate: null,
      assigneeId: query.assigneeId ?? null,
      createdAt: new Date().toISOString(),
    };

    return {
      tasks: [stubTask],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 1,
        totalPages: 1,
      },
    };
  }

  async findOne(projectId: string, taskId: string): Promise<Task> {
    // TODO: find task by id -> if not found OR not in this project,
    // throw new NotFoundException("Task not found")

    return {
      id: taskId,
      projectId,
      title: 'Stub Task',
      description: null,
      status: 'backlog',
      priority: 'medium',
      dueDate: null,
      assigneeId: null,
      createdAt: new Date().toISOString(),
    };
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

    // TODO: find task by id -> if not found OR not in this project,
    // throw new NotFoundException("Task not found")
    // apply updates, save

    return {
      id: taskId,
      projectId,
      title: dto.title ?? 'Stub Task',
      description: dto.description ?? null,
      status: dto.status ?? 'backlog',
      priority: dto.priority ?? 'medium',
      dueDate: dto.dueDate ?? null,
      assigneeId: dto.assigneeId ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async remove(projectId: string, taskId: string): Promise<void> {
    // TODO: find task by id -> if not found OR not in this project,
    // throw new NotFoundException("Task not found")
    // delete from DB
    void projectId;
    void taskId;
    return;
  }
}
