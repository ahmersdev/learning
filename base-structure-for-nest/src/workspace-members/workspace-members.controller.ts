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
import { WorkspaceMembersService } from './workspace-members.service';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

@ApiTags('Workspace Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/members')
export class WorkspaceMembersController {
  constructor(
    private readonly workspaceMembersService: WorkspaceMembersService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add a member to a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requester is not a workspace admin',
  })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceMemberDto,
  ) {
    const requesterRole = await this.workspaceMembersService.getRequesterRole(
      workspaceId,
      user.id,
    );
    const member = await this.workspaceMembersService.create(
      requesterRole,
      workspaceId,
      dto,
    );

    return {
      status: 'success',
      message: 'Member added successfully',
      data: { member },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all members of a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiResponse({
    status: 200,
    description: 'List of members retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Any member can view the list — just confirm they belong to the
    // workspace at all (getRequesterRole throws once DB is wired, if not a member)
    await this.workspaceMembersService.getRequesterRole(workspaceId, user.id);

    const members = await this.workspaceMembersService.findAll(workspaceId);

    return { status: 'success', data: { members } };
  }

  @Patch(':userId')
  @ApiOperation({ summary: "Update a member's role" })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'userId' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requester is not a workspace admin',
  })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    const requesterRole = await this.workspaceMembersService.getRequesterRole(
      workspaceId,
      user.id,
    );
    const member = await this.workspaceMembersService.update(
      requesterRole,
      workspaceId,
      userId,
      dto,
    );

    return {
      status: 'success',
      message: 'Member updated successfully',
      data: { member },
    };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'userId' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requester is not a workspace admin',
  })
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const requesterRole = await this.workspaceMembersService.getRequesterRole(
      workspaceId,
      user.id,
    );
    await this.workspaceMembersService.remove(
      requesterRole,
      workspaceId,
      userId,
    );

    return { status: 'success', message: 'Member removed successfully' };
  }
}
