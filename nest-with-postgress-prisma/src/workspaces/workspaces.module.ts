import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, JwtAuthGuard],
})
export class WorkspacesModule {}
