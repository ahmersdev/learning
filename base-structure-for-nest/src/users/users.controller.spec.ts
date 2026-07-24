import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getUser: jest.fn(),
            updateUser: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUser', () => {
    it('returns the current user profile wrapped in the standard response shape', async () => {
      usersService.getUser.mockResolvedValue({
        id: mockUser.id,
        fullName: 'Stub User',
        username: 'stubuser',
        email: mockUser.email,
      });

      const result = await controller.getUser(mockUser);

      expect(usersService.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        status: 'success',
        data: {
          user: {
            id: mockUser.id,
            fullName: 'Stub User',
            username: 'stubuser',
            email: mockUser.email,
          },
        },
      });
    });
  });

  describe('patchUser', () => {
    it('calls updateUser with the current user id and dto, and returns the standard response shape', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe' };
      usersService.updateUser.mockResolvedValue({
        id: mockUser.id,
        fullName: 'Jane Doe',
        username: 'stubuser',
      });

      const result = await controller.patchUser(mockUser, dto);

      expect(usersService.updateUser).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Profile updated successfully',
        data: {
          user: { id: mockUser.id, fullName: 'Jane Doe', username: 'stubuser' },
        },
      });
    });
  });
});
