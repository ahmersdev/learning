import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'name is required' })
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'description cannot be empty' })
  description?: string;
}
