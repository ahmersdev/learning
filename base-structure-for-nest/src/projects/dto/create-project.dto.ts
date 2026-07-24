import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Redesign' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @ApiProperty({ example: 'Q3 marketing site refresh', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'description cannot be empty' })
  description?: string;
}
