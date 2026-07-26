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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ParseUuidParamPipe } from '../common/pipes/parse-uuid-param.pipe';

@ApiTags('Comments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiParam({ name: 'taskId' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async create(
    @Param('taskId', ParseUuidParamPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    await this.commentsService.assertCanAccessTask(taskId, user.id);
    const comment = await this.commentsService.create(taskId, user.id, dto);

    return {
      status: 'success',
      message: 'Comment added successfully',
      data: { comment },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all comments on a task' })
  @ApiParam({ name: 'taskId' })
  @ApiResponse({
    status: 200,
    description: 'List of comments retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findAll(
    @Param('taskId', ParseUuidParamPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.commentsService.assertCanAccessTask(taskId, user.id);
    const comments = await this.commentsService.findAll(taskId);

    return { status: 'success', data: { comments } };
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Update your own comment on a task' })
  @ApiParam({ name: 'taskId' })
  @ApiParam({ name: 'commentId' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — you can only edit your own comments',
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('taskId', ParseUuidParamPipe) taskId: string,
    @Param('commentId', ParseUuidParamPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    await this.commentsService.assertCanAccessTask(taskId, user.id);
    await this.commentsService.assertIsCommentAuthor(commentId, user.id);

    const comment = await this.commentsService.update(taskId, commentId, dto);

    return {
      status: 'success',
      message: 'Comment updated successfully',
      data: { comment },
    };
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete your own comment on a task' })
  @ApiParam({ name: 'taskId' })
  @ApiParam({ name: 'commentId' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — you can only delete your own comments',
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async remove(
    @Param('taskId', ParseUuidParamPipe) taskId: string,
    @Param('commentId', ParseUuidParamPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.commentsService.assertCanAccessTask(taskId, user.id);
    await this.commentsService.assertIsCommentAuthor(commentId, user.id);

    await this.commentsService.remove(taskId, commentId);

    return { status: 'success', message: 'Comment deleted successfully' };
  }
}
