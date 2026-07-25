import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        ownerId,
      },
    });
  }

  async findAll(ownerId: string) {
    return this.prisma.workspace.findMany({ where: { ownerId } });
  }

  async findOne(ownerId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async update(ownerId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'At least one field (name or description) must be provided',
      );
    }

    const existing = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId },
    });

    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(ownerId: string, workspaceId: string) {
    const existing = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId },
    });

    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }
}
