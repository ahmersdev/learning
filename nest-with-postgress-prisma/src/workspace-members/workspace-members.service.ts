import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import type { WorkspaceRole } from './workspace-members-role';

@Injectable()
export class WorkspaceMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async getRequesterRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    return membership.role;
  }

  private assertIsAdmin(role: WorkspaceRole) {
    if (role !== 'admin') {
      throw new ForbiddenException('Only workspace admins can manage members');
    }
  }

  async create(
    requesterRole: WorkspaceRole,
    workspaceId: string,
    dto: CreateWorkspaceMemberDto,
  ) {
    this.assertIsAdmin(requesterRole);

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException('No user found with this email');
    }

    try {
      return await this.prisma.workspaceMember.create({
        data: { workspaceId, userId: targetUser.id, role: dto.role },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member');
      }
      throw error;
    }
  }

  async findAll(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({ where: { workspaceId } });
  }

  async update(
    requesterRole: WorkspaceRole,
    workspaceId: string,
    targetUserId: string,
    dto: UpdateWorkspaceMemberDto,
  ) {
    this.assertIsAdmin(requesterRole);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === targetUserId) {
      throw new ForbiddenException(
        "The workspace owner's role cannot be changed",
      );
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    return this.prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { role: dto.role },
    });
  }

  async remove(
    requesterRole: WorkspaceRole,
    workspaceId: string,
    targetUserId: string,
  ) {
    this.assertIsAdmin(requesterRole);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === targetUserId) {
      throw new ForbiddenException(
        'The workspace owner cannot be removed from the workspace',
      );
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.workspaceMember.delete({ where: { id: membership.id } });
  }
}
