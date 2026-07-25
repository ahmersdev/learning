import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task in a project' })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    await this.tasksService.assertCanAccessProject(projectId, user.id);
    const task = await this.tasksService.create(projectId, dto);

    return {
      status: 'success',
      message: 'Task created successfully',
      data: { task },
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List tasks in a project, with filtering/sorting/pagination',
  })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({
    status: 200,
    description: 'List of tasks retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TaskQueryDto,
  ) {
    await this.tasksService.assertCanAccessProject(projectId, user.id);
    const result = await this.tasksService.findAll(projectId, query);

    return {
      status: 'success',
      data: { tasks: result.tasks, pagination: result.pagination },
    };
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get a single task by ID' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.tasksService.assertCanAccessProject(projectId, user.id);
    const task = await this.tasksService.findOne(projectId, taskId);

    return { status: 'success', data: { task } };
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTaskDto,
  ) {
    await this.tasksService.assertCanAccessProject(projectId, user.id);
    const task = await this.tasksService.update(projectId, taskId, dto);

    return {
      status: 'success',
      message: 'Task updated successfully',
      data: { task },
    };
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.tasksService.assertCanAccessProject(projectId, user.id);
    await this.tasksService.remove(projectId, taskId);

    return { status: 'success', message: 'Task deleted successfully' };
  }
}
