import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

@Injectable()
export class UsersService {
  async getUser(userId: string): Promise<UserProfile> {
    // TODO: find user by id in DB -> if not found, throw new NotFoundException("User not found")

    return {
      id: userId,
      fullName: 'Stub User',
      username: 'stubuser',
      email: 'stub@example.com',
    };
  }

  async updateUser(userId: string, updates: UpdateUserDto) {
    if (updates.fullName === undefined && updates.username === undefined) {
      throw new BadRequestException(
        'At least one field (fullName or username) must be provided',
      );
    }

    // TODO: find user by id, apply updates, save to DB
    // if user not found -> throw new NotFoundException("User not found")

    return {
      id: userId,
      fullName: updates.fullName ?? 'Stub User',
      username: updates.username ?? 'stubuser',
    };
  }
}
