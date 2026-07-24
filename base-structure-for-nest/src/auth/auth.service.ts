import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

interface JwtPayload {
  userId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
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

  async register(dto: RegisterDto) {
    const { fullName, username, email, password } = dto;

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // TODO: once DB is wired up:
    // 1. check if email/username already exists -> throw ConflictException("User already exists")
    // 2. save { fullName, username, email, hashedPassword } to DB
    // 3. use the real DB-generated user id below instead of this fake one

    const fakeUserId = randomUUID();

    const accessToken = await this.generateAccessToken({
      userId: fakeUserId,
      email,
    });
    const refreshToken = await this.generateRefreshToken({
      userId: fakeUserId,
      email,
    });

    return {
      user: { fullName, username, email },
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const { username, email } = dto;

    // TODO: once DB is wired up:
    // 1. find user by email or username
    // 2. if not found -> throw new UnauthorizedException("Invalid credentials")
    // 3. const isMatch = await bcrypt.compare(dto.password, user.hashedPassword)
    // 4. if (!isMatch) -> throw new UnauthorizedException("Invalid credentials")

    const fakeUserId = randomUUID();
    const resolvedEmail = email || 'stub@example.com';

    const accessToken = await this.generateAccessToken({
      userId: fakeUserId,
      email: resolvedEmail,
    });
    const refreshToken = await this.generateRefreshToken({
      userId: fakeUserId,
      email: resolvedEmail,
    });

    return {
      user: { username, email: resolvedEmail },
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
