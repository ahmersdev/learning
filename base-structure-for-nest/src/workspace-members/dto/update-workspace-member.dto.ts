import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { WORKSPACE_ROLES } from '../workspace-members-role';
import type { WorkspaceRole } from '../workspace-members-role';

export class UpdateWorkspaceMemberDto {
  @ApiProperty({ enum: WORKSPACE_ROLES, example: 'admin' })
  @IsIn(WORKSPACE_ROLES, {
    message: `role must be one of: ${WORKSPACE_ROLES.join(', ')}`,
  })
  role!: WorkspaceRole;
}
