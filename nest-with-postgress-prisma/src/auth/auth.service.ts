import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, type User } from '../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

interface JwtPayload {
  userId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private generateAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY'),
    } as JwtSignOptions);
  }

  private generateRefreshToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY'),
    } as JwtSignOptions);
  }

  private verifyRefreshToken(token: string) {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private toSafeUser(user: User) {
    const { password, ...safeUser } = user;
    return safeUser;
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

    const accessToken = await this.generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = await this.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.toSafeUser(user),
      accessToken,
      refreshToken,
    };
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

    const accessToken = await this.generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = await this.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.toSafeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const decoded = this.verifyRefreshToken(token);

    const newAccessToken = await this.generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
    });

    return { accessToken: newAccessToken };
  }
}
