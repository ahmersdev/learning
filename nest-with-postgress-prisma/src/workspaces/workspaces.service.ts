import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
}

@Injectable()
export class WorkspacesService {
  // TODO: once DB is wired up, replace all of this with real queries scoped
  // to ownerId, including ownership checks (404, not 403, if not owned —
  // avoids leaking existence of other users' workspaces)

  async create(ownerId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    return {
      id: randomUUID(),
      ownerId,
      name: dto.name,
      description: dto.description ?? null,
    };
  }

  async findAll(ownerId: string): Promise<Workspace[]> {
    // TODO: return all workspaces where ownerId matches
    return [
      {
        id: randomUUID(),
        ownerId,
        name: 'Stub Workspace',
        description: null,
      },
    ];
  }

  async findOne(ownerId: string, workspaceId: string): Promise<Workspace> {
    // TODO: find workspace by id -> if not found OR not owned by ownerId,
    // throw new NotFoundException("Workspace not found")

    return {
      id: workspaceId,
      ownerId,
      name: 'Stub Workspace',
      description: null,
    };
  }

  async update(
    ownerId: string,
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'At least one field (name or description) must be provided',
      );
    }

    // TODO: find workspace by id -> if not found OR not owned by ownerId,
    // throw new NotFoundException("Workspace not found")
    // MERGE dto fields onto the existing row (don't just default missing
    // fields to null/stub values — that will wipe real data once DB is wired up)

    return {
      id: workspaceId,
      ownerId,
      name: dto.name ?? 'Stub Workspace',
      description: dto.description ?? null,
    };
  }

  async remove(ownerId: string, workspaceId: string): Promise<void> {
    // TODO: find workspace by id -> if not found OR not owned by ownerId,
    // throw new NotFoundException("Workspace not found")
    // delete from DB
    void ownerId;
    void workspaceId;
    return;
  }
}
