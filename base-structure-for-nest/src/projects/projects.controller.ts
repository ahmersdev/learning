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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    await this.projectsService.assertIsWorkspaceMember(workspaceId, user.id);
    const project = await this.projectsService.create(workspaceId, dto);

    return {
      status: 'success',
      message: 'Project created successfully',
      data: { project },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all projects in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiResponse({
    status: 200,
    description: 'List of projects retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.projectsService.assertIsWorkspaceMember(workspaceId, user.id);
    const projects = await this.projectsService.findAll(workspaceId);

    return { status: 'success', data: { projects } };
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get a single project by ID' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({ status: 200, description: 'Project retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.projectsService.assertIsWorkspaceMember(workspaceId, user.id);
    const project = await this.projectsService.findOne(workspaceId, projectId);

    return { status: 'success', data: { project } };
  }

  @Patch(':projectId')
  @ApiOperation({ summary: "Update a project's name and/or description" })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectDto,
  ) {
    await this.projectsService.assertIsWorkspaceMember(workspaceId, user.id);
    const project = await this.projectsService.update(
      workspaceId,
      projectId,
      dto,
    );

    return {
      status: 'success',
      message: 'Project updated successfully',
      data: { project },
    };
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.projectsService.assertIsWorkspaceMember(workspaceId, user.id);
    await this.projectsService.remove(workspaceId, projectId);

    return { status: 'success', message: 'Project deleted successfully' };
  }
}
