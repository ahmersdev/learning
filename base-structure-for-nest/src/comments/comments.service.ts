import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

@Injectable()
export class CommentsService {
  // TODO: once DB is wired up:
  // - assertCanAccessTask should look up the task, trace it back to its
  //   project -> workspace, and confirm the requesting user is a member
  //   of that workspace (throw NotFoundException "Task not found" if either
  //   the task doesn't exist or the user isn't a member)
  // - assertIsCommentAuthor should look up the real comment and compare
  //   its authorId to the requesting user (throw NotFoundException "Comment
  //   not found" if it doesn't exist, ForbiddenException if it exists but
  //   belongs to someone else)
  // - all methods should perform real queries/writes scoped to taskId

  async assertCanAccessTask(taskId: string, userId: string): Promise<void> {
    void taskId;
    void userId;
    // TODO: check task exists + user is a member of its workspace
    return;
  }

  async assertIsCommentAuthor(
    commentId: string,
    userId: string,
  ): Promise<void> {
    void commentId;
    void userId;
    // TODO: look up real comment.authorId and compare to userId
    // For now stub every requester as the author so the flow can be tested
    return;
  }

  async create(
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    return {
      id: randomUUID(),
      taskId,
      authorId,
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
  }

  async findAll(taskId: string): Promise<Comment[]> {
    // TODO: return all comments where taskId matches
    return [
      {
        id: randomUUID(),
        taskId,
        authorId: 'stub-author-id',
        content: 'Stub comment',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async update(
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    // TODO: find comment by id -> if not found OR not on this task,
    // throw new NotFoundException("Comment not found")
    // apply updates, save

    return {
      id: commentId,
      taskId,
      authorId: 'stub-author-id',
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
  }

  async remove(taskId: string, commentId: string): Promise<void> {
    // TODO: find comment by id -> if not found OR not on this task,
    // throw new NotFoundException("Comment not found")
    // delete from DB
    void taskId;
    void commentId;
    return;
  }
}
