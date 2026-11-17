import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database.service';

interface ProblemReportRow {
  id: string;
  reporter_id: string;
  reporter_username: string;
  reporter_role: string;
  screen: string;
  description: string;
  context: Record<string, unknown>;
  status: string;
  resolved_by_username: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

@Injectable()
export class ProblemReportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async create(input: unknown, actor: AuthenticatedUser) {
    const body = readBody(input);
    const description = readDescription(body.description);
    const screen = readScreen(body.screen);
    const context = sanitizeContext(body.context);

    const result = await this.database.pool.query<ProblemReportRow>(
      `INSERT INTO problem_reports (id, reporter_id, reporter_role, screen, description, context)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), actor.id, actor.role, screen, description, JSON.stringify(context)],
    );
    await this.audit.record({
      actor,
      action: 'problem_report.created',
      entityType: 'problem_report',
      entityId: result.rows[0].id,
      details: { screen },
    });
    return toReport(result.rows[0]);
  }

  async list(statusInput?: string, reporterIdInput?: string) {
    let status: string | null = null;
    if (statusInput !== undefined && statusInput !== '') {
      if (statusInput !== 'open' && statusInput !== 'resolved') {
        throw new UnprocessableEntityException('Durum filtresi geçersiz.');
      }
      status = statusInput;
    }
    let reporterId: string | null = null;
    if (reporterIdInput !== undefined && reporterIdInput !== '') {
      reporterId = validateId(reporterIdInput, 'Bildiren kullanıcı kimliği geçersiz.');
    }
    const result = await this.database.pool.query<ProblemReportRow>(
      `${this.selectReports()}
       WHERE ($1::text IS NULL OR p.status = $1)
         AND ($2::uuid IS NULL OR p.reporter_id = $2)
       ORDER BY p.created_at DESC`,
      [status, reporterId],
    );
    return result.rows.map((row) => toReport(row));
  }

  async resolve(idInput: unknown, actor: AuthenticatedUser) {
    const id = validateId(idInput, 'Bildirim kimliği geçersiz.');
    const result = await this.database.pool.query<ProblemReportRow>(
      `UPDATE problem_reports
       SET status = 'resolved', resolved_by = $2, resolved_at = NOW()
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [id, actor.id],
    );
    if (result.rowCount === 0) {
      const current = await this.database.pool.query(
        'SELECT id, status FROM problem_reports WHERE id = $1',
        [id],
      );
      if (current.rowCount === 0) throw new NotFoundException('Sorun bildirimi bulunamadı.');
      throw new ConflictException('Bu bildirim zaten çözüldü olarak işaretlenmiş.');
    }
    const row = result.rows[0];
    await this.audit.record({
      actor,
      action: 'problem_report.resolved',
      entityType: 'problem_report',
      entityId: id,
      details: { screen: row.screen },
    });
    return toReport(row);
  }

  private selectReports(): string {
    return `SELECT p.id, p.reporter_id, reporter.username AS reporter_username,
                   p.reporter_role, p.screen, p.description, p.context, p.status,
                   resolver.username AS resolved_by_username, p.created_at, p.resolved_at
            FROM problem_reports p
            JOIN users reporter ON reporter.id = p.reporter_id
            LEFT JOIN users resolver ON resolver.id = p.resolved_by`;
  }
}

function toReport(row: ProblemReportRow) {
  return {
    id: row.id,
    reporterUsername: row.reporter_username,
    reporterRole: row.reporter_role,
    screen: row.screen,
    description: row.description,
    context: row.context,
    status: row.status,
    resolvedByUsername: row.resolved_by_username,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

function readBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UnprocessableEntityException('İstek gövdesi geçersiz.');
  }
  return value as Record<string, unknown>;
}

function readDescription(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 2000) {
    throw new UnprocessableEntityException('Sorun açıklaması 3-2000 karakter olmalı.');
  }
  return value.trim();
}

function readScreen(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 120) {
    throw new UnprocessableEntityException('Ekran bilgisi geçersiz.');
  }
  return value.trim();
}

function sanitizeContext(value: unknown): Record<string, string | number | boolean> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new UnprocessableEntityException('Bağlam bilgisi geçersiz.');
  }
  const input = value as Record<string, unknown>;
  const output: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(input).slice(0, 12)) {
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(key)) continue;
    if (typeof raw === 'string') output[key] = raw.slice(0, 300);
    else if (typeof raw === 'number' && Number.isFinite(raw)) output[key] = raw;
    else if (typeof raw === 'boolean') output[key] = raw;
  }
  return output;
}

function validateId(value: unknown, message: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new UnprocessableEntityException(message);
  }
  return value;
}
