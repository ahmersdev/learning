import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Marketing Team' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @ApiProperty({ example: 'Workspace for the marketing team', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;
}
