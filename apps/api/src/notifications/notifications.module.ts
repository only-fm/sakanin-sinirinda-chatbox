import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [RolesGuard],
})
export class NotificationsModule {}
