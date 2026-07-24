import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WorkspaceMembersService } from './workspace-members.service';
import { WorkspaceMembersController } from './workspace-members.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [WorkspaceMembersController],
  providers: [WorkspaceMembersService, JwtAuthGuard],
})
export class WorkspaceMembersModule {}
