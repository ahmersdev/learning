import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import type { WorkspaceRole } from './workspace-members-role';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
}

@Injectable()
export class WorkspaceMembersService {
  // TODO: once DB is wired up:
  // - getRequesterRole should look up the requesting user's actual role
  //   in this workspace (throw NotFoundException if they aren't a member at all)
  // - all other methods should perform real membership queries/writes,
  //   scoped to workspaceId
  // - IMPORTANT: WorkspacesService.create() must insert the owner into
  //   workspace_members with role 'admin' at creation time, in the same
  //   transaction as the workspace insert — otherwise the owner has no
  //   membership row and getRequesterRole will incorrectly treat them as
  //   a non-member once real lookups replace this stub

  async getRequesterRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole> {
    void workspaceId;
    void userId;
    // TODO: look up real role; for now stub every requester as admin
    // so the rest of the flow can be exercised/tested
    return 'admin';
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
  ): Promise<WorkspaceMember> {
    this.assertIsAdmin(requesterRole);

    // TODO: check if a user with this email exists and isn't already a member
    // -> throw new ConflictException("User is already a member")

    return {
      id: randomUUID(),
      workspaceId,
      email: dto.email,
      role: dto.role,
    };
  }

  async findAll(workspaceId: string): Promise<WorkspaceMember[]> {
    // TODO: return all members where workspaceId matches
    return [
      {
        id: randomUUID(),
        workspaceId,
        email: 'stub-member@example.com',
        role: 'member',
      },
    ];
  }

  async update(
    requesterRole: WorkspaceRole,
    workspaceId: string,
    targetUserId: string,
    dto: UpdateWorkspaceMemberDto,
  ): Promise<WorkspaceMember> {
    this.assertIsAdmin(requesterRole);

    // TODO: find member by workspaceId + targetUserId -> if not found,
    // throw new NotFoundException("Member not found")

    return {
      id: targetUserId,
      workspaceId,
      email: 'stub-member@example.com',
      role: dto.role,
    };
  }

  async remove(
    requesterRole: WorkspaceRole,
    workspaceId: string,
    targetUserId: string,
  ): Promise<void> {
    this.assertIsAdmin(requesterRole);

    // TODO: find member by workspaceId + targetUserId -> if not found,
    // throw new NotFoundException("Member not found")
    // delete from DB
    void workspaceId;
    void targetUserId;
    return;
  }
}
