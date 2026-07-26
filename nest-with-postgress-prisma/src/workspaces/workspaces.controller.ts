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
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseUuidParamPipe } from '../common/pipes/parse-uuid-param.pipe';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace (admin only)' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin access required',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const workspace = await this.workspacesService.create(user.id, dto);

    return {
      status: 'success',
      message: 'Workspace created successfully',
      data: { workspace },
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'List all workspaces owned by the currently authenticated user (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of workspaces retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin access required',
  })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const workspaces = await this.workspacesService.findAll(user.id);

    return { status: 'success', data: { workspaces } };
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: 'Get a single workspace by ID (admin only)' })
  @ApiParam({
    name: 'workspaceId',
    description: 'ID of the workspace to retrieve',
  })
  @ApiResponse({ status: 200, description: 'Workspace retrieved successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin access required',
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUuidParamPipe) workspaceId: string,
  ) {
    const workspace = await this.workspacesService.findOne(
      user.id,
      workspaceId,
    );

    return { status: 'success', data: { workspace } };
  }

  @Patch(':workspaceId')
  @ApiOperation({
    summary: "Update a workspace's name and/or description (admin only)",
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'ID of the workspace to update',
  })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin access required',
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUuidParamPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.workspacesService.update(
      user.id,
      workspaceId,
      dto,
    );

    return {
      status: 'success',
      message: 'Workspace updated successfully',
      data: { workspace },
    };
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workspace (admin only)' })
  @ApiParam({
    name: 'workspaceId',
    description: 'ID of the workspace to delete',
  })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin access required',
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', ParseUuidParamPipe) workspaceId: string,
  ) {
    await this.workspacesService.remove(user.id, workspaceId);

    return { status: 'success', message: 'Workspace deleted successfully' };
  }
}
