import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiProperty({ example: 'Renamed Workspace', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'name is required' })
  name?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;
}
