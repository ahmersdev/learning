import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import {
  deriveUsernameFromEmail,
  randomUsernameSuffix,
  generateTemporaryPassword,
} from '../common/utils/user-provisioning.util';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import type { WorkspaceRole } from './workspace-members-role';

const SALT_ROUNDS = 10;
const MAX_USERNAME_ATTEMPTS = 5;

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

  private async createUserWithUniqueUsername(
    baseUsername: string,
    data: { fullName: string; email: string; password: string },
  ): Promise<User> {
    let username = baseUsername;

    for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.user.create({
          data: {
            ...data,
            username,
            role: 'user',
            mustChangePassword: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const target = (error.meta?.target as string[] | undefined) ?? [];
          if (target.includes('email')) {
            throw new ConflictException(
              'A user with this email was just created — please retry',
            );
          }
          username = `${baseUsername}${randomUsernameSuffix()}`;
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Could not generate a unique username, please try again',
    );
  }

  async create(
    requesterRole: WorkspaceRole,
    workspaceId: string,
    dto: CreateWorkspaceMemberDto,
  ) {
    this.assertIsAdmin(requesterRole);

    let targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    let credentials: { username: string; temporaryPassword: string } | null =
      null;

    if (!targetUser) {
      const temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
      const baseUsername = deriveUsernameFromEmail(dto.email);

      targetUser = await this.createUserWithUniqueUsername(baseUsername, {
        fullName: dto.fullName ?? baseUsername,
        email: dto.email,
        password: hashedPassword,
      });

      credentials = { username: targetUser.username, temporaryPassword };
    }

    try {
      const member = await this.prisma.workspaceMember.create({
        data: { workspaceId, userId: targetUser.id, role: dto.role },
      });

      return { member, credentials };
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
