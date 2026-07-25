import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'content is required' })
  content!: string;
}
