import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProblemReportsService } from './problem-reports.service';

@Controller('problem-reports')
@UseGuards(AuthGuard, RolesGuard)
export class ProblemReportsController {
  constructor(private readonly reports: ProblemReportsService) {}

  @Post()
  @Roles('student', 'teacher')
  create(
    @Body() body: unknown,
    @Req() request: AuthRequest,
  ) {
    return this.reports.create(body, request.user);
  }

  @Get()
  @Roles('admin')
  list(
    @Query('status') status?: string,
    @Query('reporterId') reporterId?: string,
  ) {
    return this.reports.list(status, reporterId);
  }

  @Patch(':id/resolve')
  @Roles('admin')
  resolve(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.reports.resolve(id, request.user);
  }
}
