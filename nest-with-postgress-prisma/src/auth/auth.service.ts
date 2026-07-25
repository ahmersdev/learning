import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
  fullName: string;
}

interface RefreshTokenPayload {
  userId: string;
  email: string;
  tokenId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private generateAccessToken(payload: AccessTokenPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY'),
    } as JwtSignOptions);
  }

  private generateRefreshToken(payload: RefreshTokenPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY'),
    } as JwtSignOptions);
  }

  private verifyRefreshToken(token: string) {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private parseExpiryToMs(expiry: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(expiry);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }
    const value = Number(match[1]);
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[match[2]];
  }

  private toSafeUser(user: User) {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Creates a session row and signs both tokens off the same tokenId,
   * so a refresh token is only ever valid while its session row exists.
   */
  private async issueTokens(
    user: Pick<User, 'id' | 'email' | 'username' | 'fullName'>,
  ) {
    const tokenId = randomUUID();
    const refreshExpiry = this.configService.get<string>(
      'JWT_REFRESH_EXPIRY',
      '7d',
    );
    const expiresAt = new Date(
      Date.now() + this.parseExpiryToMs(refreshExpiry),
    );

    await this.prisma.session.create({
      data: { tokenId, userId: user.id, expiresAt },
    });

    const accessToken = await this.generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
    });
    const refreshToken = await this.generateRefreshToken({
      userId: user.id,
      email: user.email,
      tokenId,
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const { fullName, username, email, password } = dto;

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or username already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { fullName, username, email, password: hashedPassword },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A user with this email or username already exists',
        );
      }
      throw error;
    }

    user = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { accessToken, refreshToken } = await this.issueTokens(user);

    return { user: this.toSafeUser(user), accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const { username, email, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { accessToken, refreshToken } = await this.issueTokens(updatedUser);

    return { user: this.toSafeUser(updatedUser), accessToken, refreshToken };
  }

  async refresh(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const decoded = this.verifyRefreshToken(token);

    const session = await this.prisma.session.findUnique({
      where: { tokenId: decoded.tokenId },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    await this.prisma.session.delete({ where: { id: session.id } });

    return this.issueTokens(user);
  }

  async signout(token: string | undefined) {
    if (!token) {
      return;
    }

    try {
      const decoded = this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.prisma.session.deleteMany({
        where: { tokenId: decoded.tokenId },
      });
    } catch {
      // Invalid/expired token — nothing to revoke, nothing to do.
    }
  }
}
