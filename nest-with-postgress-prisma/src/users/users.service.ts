import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { toSafeUser } from '../common/utils/safe-user.util';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map(toSafeUser);
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toSafeUser(user);
  }

  async updateUser(userId: string, updates: UpdateUserDto) {
    if (updates.fullName === undefined && updates.username === undefined) {
      throw new BadRequestException(
        'At least one field (fullName or username) must be provided',
      );
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updates,
      });

      return toSafeUser(updatedUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
        if (error.code === 'P2002') {
          throw new ConflictException('Username is already taken');
        }
      }
      throw error;
    }
  }
}
