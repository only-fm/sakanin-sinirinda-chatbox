import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthRequest, shouldUseSecureCookie, UserRole } from './auth.types';
import { REQUIRED_ROLES } from './roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requestedRoles = requiredRoles?.length
      ? requiredRoles
      : isUserRole(request.query.role)
        ? [request.query.role]
        : [];
    if (requestedRoles.length === 0) {
      throw new ForbiddenException('Bu işlem için uygun rol belirtilmeli.');
    }

    let hasValidSession = false;
    const cookieRoles: UserRole[] = ['student', 'teacher', 'admin'];
    const orderedCookieRoles = [
      ...requestedRoles,
      ...cookieRoles.filter((role) => !requestedRoles.includes(role)),
    ];
    for (const role of orderedCookieRoles) {
      const cookieName = `sakanin_${role}_session`;
      const cookie = request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`));
      const token = cookie?.slice(`${cookieName}=`.length);
      if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) continue;

      const user = await this.authService.getUserForSession(token);
      if (!user) continue;
      hasValidSession = true;
      if (user.role !== role || !requestedRoles.includes(user.role)) continue;

      request.user = user;
      const currentDeviceId = getDeviceId(request);
      const deviceId = currentDeviceId ?? randomUUID();
      request.deviceId = deviceId;
      if (!currentDeviceId) {
        context.switchToHttp().getResponse<Response>().cookie('sakanin_device_id', deviceId, {
          httpOnly: true,
          secure: shouldUseSecureCookie(request),
          sameSite: 'lax',
          path: '/api',
          maxAge: 365 * 24 * 60 * 60 * 1000,
          ...(process.env.SESSION_COOKIE_DOMAIN
            ? { domain: process.env.SESSION_COOKIE_DOMAIN }
            : {}),
        });
        try {
          await this.authService.attachDeviceToSession(
            token,
            user,
            deviceId,
            request.headers['user-agent'],
          );
        } catch (error: unknown) {
          console.error('Existing session device registration failed', error);
        }
      }
      return true;
    }

    if (hasValidSession) {
      throw new ForbiddenException('Bu oturum istenen rol ile eşleşmiyor.');
    }
    throw new UnauthorizedException('Giriş yapmanız gerekiyor.');
  }
}

function getDeviceId(request: AuthRequest): string | null {
  const cookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('sakanin_device_id='));
  const value = cookie?.slice('sakanin_device_id='.length);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'teacher' || value === 'admin';
}
