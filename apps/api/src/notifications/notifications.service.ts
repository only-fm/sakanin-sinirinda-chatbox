import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, interval, mergeMap } from 'rxjs';
import webPush from 'web-push';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database.service';

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  target_url: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: Date;
  read_at: Date | null;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

@Injectable()
export class NotificationsService {
  private readonly vapidPublicKey =
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
      ? process.env.VAPID_PUBLIC_KEY
      : '';

  constructor(private readonly database: DatabaseService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (Boolean(publicKey) !== Boolean(privateKey)) {
      throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together');
    }
    if (publicKey && privateKey) {
      webPush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
        publicKey,
        privateKey,
      );
    }
  }

  async list(userId: string, deviceId: string, limit: number, offset: number) {
    const result = await this.database.pool.query<NotificationRecord>(
      `SELECT id, type, title, message, target_url, metadata, is_read, created_at, read_at
       FROM notifications
       WHERE recipient_user_id = $1
         AND (recipient_device_id IS NULL OR recipient_device_id = $2)
       ORDER BY created_at DESC, id DESC
       LIMIT $3 OFFSET $4`,
      [userId, deviceId, limit, offset],
    );
    return result.rows.map(toClientNotification);
  }

  async unreadCount(userId: string, deviceId: string): Promise<{ count: number }> {
    const result = await this.database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND is_read = FALSE
         AND (recipient_device_id IS NULL OR recipient_device_id = $2)`,
      [userId, deviceId],
    );
    return { count: Number(result.rows[0]?.count ?? 0) };
  }

  async markRead(userId: string, deviceId: string, id: string) {
    const result = await this.database.pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND recipient_user_id = $2
         AND (recipient_device_id IS NULL OR recipient_device_id = $3)
       RETURNING id`,
      [id, userId, deviceId],
    );
    return { updated: result.rowCount === 1 };
  }

  async markAllRead(userId: string, deviceId: string) {
    const result = await this.database.pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE recipient_user_id = $1 AND is_read = FALSE
         AND (recipient_device_id IS NULL OR recipient_device_id = $2)`,
      [userId, deviceId],
    );
    return { updatedCount: result.rowCount ?? 0 };
  }

  async deleteOne(userId: string, deviceId: string, id: string) {
    const result = await this.database.pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND recipient_user_id = $2
         AND (recipient_device_id IS NULL OR recipient_device_id = $3)`,
      [id, userId, deviceId],
    );
    return { deleted: result.rowCount === 1 };
  }

  async deleteAll(userId: string, deviceId: string) {
    const result = await this.database.pool.query(
      `DELETE FROM notifications WHERE recipient_user_id = $1
       AND (recipient_device_id IS NULL OR recipient_device_id = $2)`,
      [userId, deviceId],
    );
    return { deletedCount: result.rowCount ?? 0 };
  }

  async subscribe(
    user: AuthenticatedUser,
    deviceId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.database.pool.query(
      `INSERT INTO push_subscriptions (id, user_id, device_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, device_id) DO UPDATE SET
         endpoint = EXCLUDED.endpoint, p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth, updated_at = NOW()`,
      [randomUUID(), user.id, deviceId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
    );
    return { subscribed: true };
  }

  async unsubscribe(userId: string, deviceId: string) {
    const result = await this.database.pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId],
    );
    return { unsubscribed: (result.rowCount ?? 0) > 0 };
  }

  async deviceStatus(userId: string, deviceId: string) {
    const result = await this.database.pool.query(
      `SELECT EXISTS (SELECT 1 FROM push_subscriptions
       WHERE user_id = $1 AND device_id = $2) AS subscribed`,
      [userId, deviceId],
    );
    return { subscribed: result.rows[0]?.subscribed === true };
  }

  async getPreferences(userId: string) {
    const result = await this.database.pool.query<{ in_app_enabled: boolean }>(
      `SELECT in_app_enabled FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );
    return { inAppEnabled: result.rows[0]?.in_app_enabled ?? true };
  }

  async setInAppPreference(userId: string, enabled: boolean) {
    await this.database.pool.query(
      `INSERT INTO notification_preferences (user_id, in_app_enabled)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         in_app_enabled = EXCLUDED.in_app_enabled, updated_at = NOW()`,
      [userId, enabled],
    );
    return { inAppEnabled: enabled };
  }

  getPublicKey(): { publicKey: string } {
    return { publicKey: this.vapidPublicKey };
  }

  async create(
    recipientUserId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      targetUrl?: string | null;
      metadata?: Record<string, unknown>;
      recipientDeviceId?: string | null;
    },
  ): Promise<void> {
    const result = await this.database.pool.query<NotificationRecord>(
      `INSERT INTO notifications
        (id, recipient_user_id, recipient_device_id, type, title, message, target_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, type, title, message, target_url, metadata, is_read, created_at, read_at`,
      [
        randomUUID(),
        recipientUserId,
        notification.recipientDeviceId ?? null,
        notification.type,
        notification.title,
        notification.message,
        notification.targetUrl ?? null,
        JSON.stringify(notification.metadata ?? {}),
      ],
    );
    void this.sendPush(recipientUserId, toClientNotification(result.rows[0]), notification.recipientDeviceId)
      .catch((error: unknown) => console.error('Push notification delivery failed', error));
  }

  async createForRoles(
    roles: Array<'student' | 'teacher' | 'admin'>,
    notification: Parameters<NotificationsService['create']>[1],
  ): Promise<void> {
    try {
      const recipients = await this.database.pool.query<{ id: string }>(
        'SELECT id FROM users WHERE role = ANY($1::text[])',
        [roles],
      );
      await Promise.all(recipients.rows.map(async (recipient) => {
        try {
          await this.create(recipient.id, notification);
        } catch (error: unknown) {
          console.error('Notification creation failed', error);
        }
      }));
    } catch (error: unknown) {
      console.error('Notification recipient lookup failed', error);
    }
  }

  async registerAdminDevice(user: AuthenticatedUser, deviceId: string, userAgent: string | undefined) {
    const inserted = await this.database.pool.query(
      `INSERT INTO admin_devices (user_id, device_id, user_agent)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, device_id) DO NOTHING`,
      [user.id, deviceId, userAgent?.slice(0, 500) ?? null],
    );
    if (inserted.rowCount !== 1) {
      await this.database.pool.query(
        'UPDATE admin_devices SET last_seen_at = NOW(), user_agent = $3 WHERE user_id = $1 AND device_id = $2',
        [user.id, deviceId, userAgent?.slice(0, 500) ?? null],
      );
      return;
    }

    const known = await this.database.pool.query<{ device_id: string }>(
      `SELECT d.device_id FROM admin_devices d
       WHERE d.user_id = $1 AND d.device_id <> $2
         AND (
           EXISTS (
             SELECT 1 FROM auth_sessions s
             WHERE s.user_id = d.user_id AND s.device_id = d.device_id AND s.expires_at > NOW()
           )
           OR EXISTS (
             SELECT 1 FROM push_subscriptions p
             WHERE p.user_id = d.user_id AND p.device_id = d.device_id
           )
         )`,
      [user.id, deviceId],
    );
    for (const device of known.rows) {
      await this.create(user.id, {
        type: 'admin_new_device',
        title: 'Yeni Cihazdan Yönetici Girişi',
        message: 'Yönetici hesabınıza yeni bir cihazdan giriş yapıldı.',
        targetUrl: '/?notifications=settings',
        recipientDeviceId: device.device_id,
        metadata: { userAgent: userAgent?.slice(0, 500) ?? null },
      });
    }
  }

  async trackAdminDevice(user: AuthenticatedUser, deviceId: string, userAgent: string | undefined) {
    await this.database.pool.query(
      `INSERT INTO admin_devices (user_id, device_id, user_agent)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, device_id) DO UPDATE
       SET last_seen_at = NOW(), user_agent = EXCLUDED.user_agent`,
      [user.id, deviceId, userAgent?.slice(0, 500) ?? null],
    );
  }

  stream(userId: string, deviceId: string): Observable<{ data: unknown }> {
    let cursor = new Date();
    const seen = new Set<string>();
    return interval(2500).pipe(
      mergeMap(async () => {
        const results = await this.database.pool.query<NotificationRecord>(
          `SELECT id, type, title, message, target_url, metadata, is_read, created_at, read_at
           FROM notifications WHERE recipient_user_id = $1
             AND (recipient_device_id IS NULL OR recipient_device_id = $2)
             AND created_at >= $3
           ORDER BY created_at, id LIMIT 200`,
          [userId, deviceId, new Date(cursor.getTime() - 1500)],
        );
        cursor = new Date();
        return results.rows.filter((row) => {
          if (seen.has(row.id)) return false;
          seen.add(row.id);
          if (seen.size > 1000) {
            const oldest = seen.values().next().value as string | undefined;
            if (oldest) seen.delete(oldest);
          }
          return true;
        }).map((row) => ({ data: toClientNotification(row) }));
      }),
      mergeMap((events) => events),
    );
  }

  private async sendPush(
    userId: string,
    notification: ReturnType<typeof toClientNotification>,
    deviceId?: string | null,
  ): Promise<void> {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    const result = await this.database.pool.query<PushSubscriptionRow>(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
       WHERE user_id = $1 AND ($2::uuid IS NULL OR device_id = $2)`,
      [userId, deviceId ?? null],
    );
    await Promise.all(result.rows.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.message,
            url: notification.targetUrl,
          }),
        );
      } catch (error: unknown) {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          && typeof error.statusCode === 'number'
          ? error.statusCode
          : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await this.database.pool.query('DELETE FROM push_subscriptions WHERE id = $1', [subscription.id]);
        } else {
          console.error('Push notification delivery failed', error);
        }
      }
    }));
  }
}

function toClientNotification(row: NotificationRecord) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    targetUrl: row.target_url,
    metadata: row.metadata,
    isRead: row.is_read,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}
