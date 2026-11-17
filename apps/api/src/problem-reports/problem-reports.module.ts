import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { ProblemReportsController } from './problem-reports.controller';
import { ProblemReportsService } from './problem-reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ProblemReportsController],
  providers: [RolesGuard, ProblemReportsService],
})
export class ProblemReportsModule {}
