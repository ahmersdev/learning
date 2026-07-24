import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import { WORKSPACE_ROLES } from '../workspace-members-role';
import type { WorkspaceRole } from '../workspace-members-role';

export class CreateWorkspaceMemberDto {
  @ApiProperty({ example: 'member@example.com' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({ enum: WORKSPACE_ROLES, example: 'member' })
  @IsIn(WORKSPACE_ROLES, {
    message: `role must be one of: ${WORKSPACE_ROLES.join(', ')}`,
  })
  role!: WorkspaceRole;
}
