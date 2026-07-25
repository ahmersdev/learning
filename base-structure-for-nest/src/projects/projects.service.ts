import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
}

@Injectable()
export class ProjectsService {
  // TODO: once DB is wired up:
  // - assertIsWorkspaceMember should verify the user actually belongs to this
  //   workspace (throw NotFoundException "Workspace not found" if not — avoids
  //   leaking existence of workspaces the user isn't part of)
  // - all methods should perform real queries/writes scoped to workspaceId

  async assertIsWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    void workspaceId;
    void userId;
    // TODO: check membership; for now stub every requester as a valid member
    return;
  }

  async create(workspaceId: string, dto: CreateProjectDto): Promise<Project> {
    return {
      id: randomUUID(),
      workspaceId,
      name: dto.name,
      description: dto.description ?? null,
    };
  }

  async findAll(workspaceId: string): Promise<Project[]> {
    // TODO: return all projects where workspaceId matches
    return [
      {
        id: randomUUID(),
        workspaceId,
        name: 'Stub Project',
        description: null,
      },
    ];
  }

  async findOne(workspaceId: string, projectId: string): Promise<Project> {
    // TODO: find project by id -> if not found OR not in this workspace,
    // throw new NotFoundException("Project not found")

    return {
      id: projectId,
      workspaceId,
      name: 'Stub Project',
      description: null,
    };
  }

  async update(
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'At least one field (name or description) must be provided',
      );
    }

    // TODO: find project by id -> if not found OR not in this workspace,
    // throw new NotFoundException("Project not found")
    // MERGE dto fields onto the existing row (don't default missing fields
    // to null/stub values — that will wipe real data once DB is wired up)

    return {
      id: projectId,
      workspaceId,
      name: dto.name ?? 'Stub Project',
      description: dto.description ?? null,
    };
  }

  async remove(workspaceId: string, projectId: string): Promise<void> {
    // TODO: find project by id -> if not found OR not in this workspace,
    // throw new NotFoundException("Project not found")
    // delete from DB
    void workspaceId;
    void projectId;
    return;
  }
}
