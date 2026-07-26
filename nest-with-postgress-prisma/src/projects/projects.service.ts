import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertIsWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
  }

  async create(workspaceId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.project.findMany({ where: { workspaceId } });
  }

  async findOne(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(workspaceId: string, projectId: string, dto: UpdateProjectDto) {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'At least one field (name or description) must be provided',
      );
    }

    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(workspaceId: string, projectId: string): Promise<void> {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.project.delete({ where: { id: projectId } });
  }
}
