import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(1, { message: 'fullName is required' })
  fullName?: string;

  @ApiProperty({ example: 'janedoe', required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsString()
  @MinLength(3, { message: 'username must be at least 3 characters' })
  username?: string;
}
