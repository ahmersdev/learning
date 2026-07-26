import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all users with full details (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin access required',
  })
  async getAllUsers() {
    const users = await this.usersService.findAllUsers();
    return { status: 'success', data: { users } };
  }

  @Get('me')
  @ApiOperation({ summary: "Get the currently authenticated user's profile" })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  async getUser(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.usersService.getUser(user.id);

    return { status: 'success', data: { user: profile } };
  }

  @Patch('me')
  @ApiOperation({
    summary:
      "Update the currently authenticated user's fullName and/or username",
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  async patchUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    const updatedUser = await this.usersService.updateUser(user.id, dto);

    return {
      status: 'success',
      message: 'Profile updated successfully',
      data: { user: updatedUser },
    };
  }
}
