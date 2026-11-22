import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { AuthRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'teacher', 'student')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() request: AuthRequest,
    @Query('limit') limitInput?: string,
    @Query('offset') offsetInput?: string,
  ) {
    const limit = parseBoundedInteger(limitInput, 50, 1, 100);
    const offset = parseBoundedInteger(offsetInput, 0, 0, 100_000);
    return this.notifications.list(request.user.id, deviceIdFromRequest(request), limit, offset);
  }

  @Get('unread-count')
  unreadCount(@Req() request: AuthRequest) {
    return this.notifications.unreadCount(request.user.id, deviceIdFromRequest(request));
  }

  @Get('settings')
  async settings(@Req() request: AuthRequest) {
    const deviceId = deviceIdFromRequest(request);
    const [device, preferences] = await Promise.all([
      this.notifications.deviceStatus(request.user.id, deviceId),
      this.notifications.getPreferences(request.user.id),
    ]);
    return { ...device, ...preferences };
  }

  @Patch('settings')
  updateSettings(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = readObjectBody(body);
    if (typeof input.inAppEnabled !== 'boolean') {
      throw new UnprocessableEntityException('Uygulama içi bildirim tercihi geçersiz.');
    }
    return this.notifications.setInAppPreference(request.user.id, input.inAppEnabled);
  }

  @Sse('events')
  events(@Req() request: AuthRequest): Observable<{ data: unknown }> {
    return this.notifications.stream(request.user.id, deviceIdFromRequest(request));
  }

  @Patch('read-all')
  markAllRead(@Req() request: AuthRequest) {
    return this.notifications.markAllRead(request.user.id, deviceIdFromRequest(request));
  }

  @Patch(':id/read')
  async markRead(@Req() request: AuthRequest, @Param('id') id: string) {
    const result = await this.notifications.markRead(
      request.user.id,
      deviceIdFromRequest(request),
      validateId(id),
    );
    if (!result.updated) throw new NotFoundException('Bildirim bulunamadı.');
    return result;
  }

  @Delete()
  deleteAll(@Req() request: AuthRequest) {
    return this.notifications.deleteAll(request.user.id, deviceIdFromRequest(request));
  }

  @Delete(':id')
  async deleteOne(@Req() request: AuthRequest, @Param('id') id: string) {
    const result = await this.notifications.deleteOne(
      request.user.id,
      deviceIdFromRequest(request),
      validateId(id),
    );
    if (!result.deleted) throw new NotFoundException('Bildirim bulunamadı.');
    return result;
  }

  @Get('push/vapid-public-key')
  getVapidPublicKey() {
    return this.notifications.getPublicKey();
  }

  @Get('push/status')
  pushStatus(@Req() request: AuthRequest) {
    return this.notifications.deviceStatus(request.user.id, deviceIdFromRequest(request));
  }

  @Post('push/subscribe')
  subscribe(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = readObjectBody(body);
    if (
      typeof input.endpoint !== 'string' || input.endpoint.length > 4096 ||
      typeof input.keys !== 'object' || input.keys === null || Array.isArray(input.keys)
    ) {
      throw new UnprocessableEntityException('Push aboneliği geçersiz.');
    }
    const keys = input.keys as Record<string, unknown>;
    if (
      typeof keys.p256dh !== 'string' || keys.p256dh.length > 256 ||
      typeof keys.auth !== 'string' || keys.auth.length > 256
    ) {
      throw new UnprocessableEntityException('Push abonelik anahtarları geçersiz.');
    }
    let endpoint: URL;
    try {
      endpoint = new URL(input.endpoint);
    } catch {
      throw new UnprocessableEntityException('Push abonelik adresi geçersiz.');
    }
    const host = endpoint.hostname.toLowerCase();
    const trustedPushHost =
      host === 'fcm.googleapis.com' || host.endsWith('.fcm.googleapis.com') ||
      host === 'push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') ||
      host === 'web.push.apple.com' || host.endsWith('.push.apple.com') ||
      host === 'notify.windows.com' || host.endsWith('.notify.windows.com') ||
      host === 'wns.windows.com' || host.endsWith('.wns.windows.com');
    if (endpoint.protocol !== 'https:' || !trustedPushHost) {
      throw new UnprocessableEntityException('Push abonelik adresi HTTPS olmalı.');
    }
    return this.notifications.subscribe(request.user, deviceIdFromRequest(request), {
      endpoint: endpoint.href,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    });
  }

  @Delete('push/unsubscribe')
  unsubscribe(@Req() request: AuthRequest) {
    return this.notifications.unsubscribe(request.user.id, deviceIdFromRequest(request));
  }
}

function deviceIdFromRequest(request: AuthRequest): string {
  if (request.deviceId && isUuid(request.deviceId)) return request.deviceId;
  const cookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('sakanin_device_id='));
  const deviceId = cookie?.slice('sakanin_device_id='.length);
  return deviceId && isUuid(deviceId) ? deviceId : randomUUID();
}

function parseBoundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new UnprocessableEntityException('Sayfalama değeri geçersiz.');
  }
  return parsed;
}

function validateId(value: string): string {
  if (!isUuid(value)) throw new UnprocessableEntityException('Kimlik geçersiz.');
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readObjectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UnprocessableEntityException('İstek gövdesi geçersiz.');
  }
  return value as Record<string, unknown>;
}
