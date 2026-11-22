import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { ExpertQuestionsModule } from './expert-questions/expert-questions.module';
import { ProblemReportsModule } from './problem-reports/problem-reports.module';
import { ScenarioModule } from './scenarios/scenario.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [AuthModule, AdminModule, ExpertQuestionsModule, ScenarioModule, ProblemReportsModule, NotificationsModule],
  controllers: [HealthController],
})
export class AppModule {}
