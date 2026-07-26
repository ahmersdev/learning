import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TASK_PRIORITIES, TASK_STATUSES } from '../task-enums';
import type { TaskPriority, TaskStatus } from '../task-enums';

export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'title is required' })
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1, { message: 'description cannot be empty' })
  description?: string;

  @ApiProperty({ enum: TASK_STATUSES, required: false })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiProperty({ enum: TASK_PRIORITIES, required: false })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({}, { message: 'dueDate must be a valid ISO date' })
  dueDate?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'assigneeId cannot be empty' })
  assigneeId?: string | null;
}
