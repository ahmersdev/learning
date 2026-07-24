import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const decoded = this.jwtService.verify<{ userId: string; email: string }>(
        token,
        { secret: this.configService.get<string>('JWT_ACCESS_SECRET') },
      );

      (request as Request & { user: AuthenticatedUser }).user = {
        id: decoded.userId,
        email: decoded.email,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
  }
}
