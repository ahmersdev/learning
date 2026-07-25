import { Test, TestingModule } from '@nestjs/testing';
import type { Response, Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockResponse = () => {
    const res = {} as Response;
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockSafeUser = {
    id: 'user-123',
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    role: 'user' as const,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    const dto: RegisterDto = {
      fullName: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('sets the refreshToken cookie and returns user + accessToken', async () => {
      authService.register.mockResolvedValue({
        user: mockSafeUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();

      const result = await controller.signup(dto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(result).toEqual({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: mockSafeUser,
          accessToken: 'access-token',
        },
      });
    });
  });

  describe('signin', () => {
    const dto: LoginDto = {
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('sets the refreshToken cookie and returns user + accessToken', async () => {
      authService.login.mockResolvedValue({
        user: mockSafeUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();

      const result = await controller.signin(dto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Login successful',
        data: {
          user: mockSafeUser,
          accessToken: 'access-token',
        },
      });
    });
  });

  describe('refresh', () => {
    it('reads the refreshToken cookie and returns a new accessToken', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
      });
      const req = {
        cookies: { refreshToken: 'old-refresh-token' },
      } as unknown as Request;

      const result = await controller.refresh(req);

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toEqual({
        status: 'success',
        data: { accessToken: 'new-access-token' },
      });
    });

    it('passes undefined to the service when no cookie is present', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
      });
      const req = { cookies: {} } as unknown as Request;

      await controller.refresh(req);

      expect(authService.refresh).toHaveBeenCalledWith(undefined);
    });
  });

  describe('signout', () => {
    it('clears the refreshToken cookie and returns a success message', () => {
      const res = mockResponse();

      const result = controller.signout(res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Logged out successfully',
      });
    });
  });
});
