import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Comment } from '../generated/prisma/client';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessTask(taskId: string, userId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: task.project.workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Task not found');
    }
  }

  async assertIsCommentAuthor(
    commentId: string,
    userId: string,
  ): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only modify your own comments');
    }
  }

  private readonly commentSelect = {
    id: true,
    taskId: true,
    content: true,
    createdAt: true,
    updatedAt: true,
    author: {
      select: { id: true, fullName: true, username: true },
    },
  } as const;

  async create(taskId: string, authorId: string, dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: { taskId, authorId, content: dto.content },
      select: this.commentSelect,
    });
  }

  async findAll(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      select: this.commentSelect,
    });
  }

  async update(
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const existing = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
    });
  }

  async remove(taskId: string, commentId: string): Promise<void> {
    const existing = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
