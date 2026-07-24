import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ProjectsController],
  providers: [ProjectsService, JwtAuthGuard],
})
export class ProjectsModule {}
