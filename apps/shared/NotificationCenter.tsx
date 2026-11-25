import { useEffect, useRef, useState } from 'react';
import { supabaseClient } from '../landing-web/src/supabaseClient';
import { supabaseRequest } from '../landing-web/src/supabaseApi';
import './notification-center.css';

type UserRole = 'admin' | 'teacher' | 'student';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  targetUrl: string | null;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

type NotificationSettings = {
  subscribed: boolean;
  inAppEnabled: boolean;
};

export function NotificationCenter({ role }: { role: UserRole }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings>({
    subscribed: false,
    inAppEnabled: true,
  });
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionPrompt, setPermissionPrompt] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [deletingIds, setDeletingIds] = useState(() => new Set<string>());
  const [deletingAll, setDeletingAll] = useState(false);
  const seenIds = useRef(new Set<string>());

  async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    return supabaseRequest<T>(
      path,
      body as Record<string, unknown> | undefined,
      method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    );
  }

  async function refresh() {
    try {
      const [notifications, count, currentSettings] = await Promise.all([
        api<NotificationItem[]>('/notifications?limit=50'),
        api<{ count: number }>('/notifications/unread-count'),
        api<NotificationSettings>('/notifications/settings'),
      ]);
      seenIds.current = new Set(notifications.map((item) => item.id));
      setItems(notifications);
      setUnreadCount(count.count);
      setSettings(currentSettings);
      setError('');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Bildirimler yüklenemedi.');
    }
  }

  useEffect(() => {
    void refresh();
    if (new URLSearchParams(window.location.search).get('notifications') === 'settings') {
      setOpen(true);
      setShowSettings(true);
    }
    let active = true;
    const client = supabaseClient;
    let channel: ReturnType<NonNullable<typeof client>['channel']> | undefined;
    if (client) {
      void client.auth.getUser().then(({ data, error: authError }) => {
        if (!active) return;
        if (authError) {
          setError(`Oturum doğrulanamadı: ${authError.message}`);
          return;
        }
        if (!data.user) return;
        channel = client
          .channel(`notifications:${data.user.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${data.user.id}`,
          }, ({ new: row }) => {
            const notification = {
              id: String(row.id),
              type: String(row.type),
              title: String(row.title),
              message: String(row.message),
              targetUrl: typeof row.target_url === 'string' ? row.target_url : null,
              metadata: (row.metadata ?? {}) as Record<string, unknown>,
              isRead: Boolean(row.is_read),
              createdAt: String(row.created_at),
            };
            if (seenIds.current.has(notification.id)) return;
            seenIds.current.add(notification.id);
            setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 50));
            if (!notification.isRead) setUnreadCount((current) => current + 1);
          })
          .subscribe((status, subscribeError) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setError(subscribeError?.message ?? 'Gerçek zamanlı bildirim bağlantısı kurulamadı.');
            }
          });
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Bildirim bağlantısı kurulamadı.');
      });
    }
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const promptDismissed = sessionStorage.getItem(`sakanin_notification_prompt_dismissed_${role}`);
    if (permission !== 'granted' && permission !== 'unsupported' && !promptDismissed) setPermissionPrompt(true);
    return () => {
      active = false;
      if (channel && client) void client.removeChannel(channel);
    };
  }, []);

  async function markRead(item: NotificationItem) {
    if (!item.isRead) {
      try {
        await api(`/notifications/${item.id}/read`, 'PATCH');
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'Bildirim okunamadı.');
        return;
      }
    }
    if (item.targetUrl) {
      const target = new URL(item.targetUrl, window.location.origin);
      if (target.origin !== window.location.origin) {
        setError('Bildirim hedefi geçersiz.');
        return;
      }
      window.location.assign(target.href);
    }
  }

  async function markAllRead() {
    try {
      await api('/notifications/read-all', 'PATCH');
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Bildirimler okundu olarak işaretlenemedi.');
    }
  }

  async function deleteItem(id: string) {
    if (deletingIds.has(id) || deletingAll) return;
    setDeletingIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    try {
      await api(`/notifications/${id}`, 'DELETE');
      const wasUnread = items.some((item) => item.id === id && !item.isRead);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        seenIds.current.delete(id);
      }, 360);
      if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
    } catch (cause: unknown) {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setError(cause instanceof Error ? cause.message : 'Bildirim silinemedi.');
    }
  }

  async function clearAll() {
    if (deletingAll) return;
    if (!window.confirm('Tüm bildirim geçmişinizi silmek istediğinizden emin misiniz?')) return;
    setDeletingAll(true);
    try {
      await api('/notifications', 'DELETE');
      window.setTimeout(() => {
        setItems([]);
        setUnreadCount(0);
        setOffset(0);
        setDeletingAll(false);
        seenIds.current.clear();
      }, 360);
    } catch (cause: unknown) {
      setDeletingAll(false);
      setError(cause instanceof Error ? cause.message : 'Bildirim geçmişi silinemedi.');
    }
  }

  async function enablePush() {
    setError('');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Bu tarayıcı Web Push bildirimlerini desteklemiyor.');
      return;
    }
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        setError(permission === 'denied'
          ? 'Bildirim izni tarayıcı ayarlarından açılmalı. Adres çubuğundaki site izinlerini kontrol edin.'
          : 'Bildirim izni verilmedi.');
        return;
      }
      dismissPrompt();
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const { publicKey } = await api<{ publicKey: string }>('/notifications/push/vapid-public-key');
      if (!publicKey) throw new Error('Sunucuda VAPID anahtarları yapılandırılmamış.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        });
      }
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Tarayıcı push aboneliği eksik bilgi döndürdü.');
      }
      await api('/notifications/push/subscribe', 'POST', {
        endpoint: json.endpoint,
        keys: json.keys,
      });
      setSettings((current) => ({ ...current, subscribed: true }));
      setError('Bildirimler etkinleştirildi.');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Push bildirimi etkinleştirilemedi.');
      if ('Notification' in window && Notification.permission === 'granted') {
        dismissPrompt();
        setOpen(true);
        setShowSettings(true);
      }
    }
  }

  async function disablePush() {
    try {
      await api('/notifications/push/unsubscribe', 'DELETE');
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      setSettings((current) => ({ ...current, subscribed: false }));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Push bildirimi kapatılamadı.');
    }
  }

  async function setInAppEnabled(enabled: boolean) {
    try {
      const updated = await api<{ inAppEnabled: boolean }>('/notifications/settings', 'PATCH', {
        inAppEnabled: enabled,
      });
      setSettings((current) => ({ ...current, inAppEnabled: updated.inAppEnabled }));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Bildirim tercihi kaydedilemedi.');
    }
  }

  async function loadMore() {
    const nextOffset = offset + 50;
    try {
      const older = await api<NotificationItem[]>(`/notifications?limit=50&offset=${nextOffset}`);
      setItems((current) => [...current, ...older]);
      setOffset(nextOffset);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Bildirim geçmişi yüklenemedi.');
    }
  }

  function dismissPrompt() {
    sessionStorage.setItem(`sakanin_notification_prompt_dismissed_${role}`, 'true');
    setPermissionPrompt(false);
  }

  const permissionDenied = 'Notification' in window && Notification.permission === 'denied';
  const visibleItems = showHistory ? items : items.slice(0, 6);

  return (
    <div className="notification-center">
      <button
        aria-expanded={open}
        aria-label={`Bildirimler${unreadCount ? `, ${unreadCount} okunmamış` : ''}`}
        className="notification-bell"
        onClick={() => { setOpen((current) => !current); setShowHistory(false); setShowSettings(false); }}
        type="button"
      >
        <span aria-hidden="true">🔔</span>
        {settings.inAppEnabled && unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-popover" aria-label="Bildirim merkezi">
          <div className="notification-heading">
            <div>
              <h2>{showSettings ? 'Bildirim ayarları' : showHistory ? 'Bildirim geçmişi' : 'Bildirimler'}</h2>
              {showHistory && <p>Tüm bildirimleriniz</p>}
            </div>
            <button className="notification-close" onClick={() => setOpen(false)} aria-label="Kapat" type="button">×</button>
          </div>

          {showSettings ? (
            <div className="notification-settings">
              <label>
                <span><strong>Uygulama içi bildirimler</strong><small>Bildirim merkezi ve gerçek zamanlı uyarılar</small></span>
                <input type="checkbox" checked={settings.inAppEnabled} onChange={(event) => void setInAppEnabled(event.target.checked)} />
              </label>
              <div className="notification-setting-row">
                <span><strong>Tarayıcı bildirimleri</strong><small>{'Notification' in window ? `İzin: ${Notification.permission}` : 'Desteklenmiyor'}</small></span>
                {settings.subscribed
                  ? <button className="notification-secondary" onClick={() => void disablePush()} type="button">Bu cihazda kapat</button>
                  : <button className="notification-primary" onClick={() => void enablePush()} type="button">Etkinleştir</button>}
              </div>
              {permissionDenied && <p className="notification-help">İzni tarayıcı ayarlarından açıp bu sayfayı yenileyin.</p>}
              {error && <p className="notification-error" role="status">{error}</p>}
              <button className="notification-secondary" onClick={() => setShowSettings(false)} type="button">Bildirimlere dön</button>
            </div>
          ) : (
            <>
              <div className="notification-actions">
                <button onClick={() => setShowSettings(true)} type="button">Ayarlar</button>
                <button disabled={!unreadCount} onClick={() => void markAllRead()} type="button">Tümünü okundu işaretle</button>
              </div>
              {error && <p className="notification-error" role="status">{error}</p>}
              {!settings.inAppEnabled ? (
                <p className="notification-empty">Uygulama içi bildirimler kapalı.</p>
              ) : visibleItems.length === 0 ? (
                <div className="notification-empty"><img src="/icon.png" alt="" /><p>Henüz bildiriminiz yok.</p></div>
              ) : (
                <ul className="notification-list">
                  {visibleItems.map((item) => (
                    <li
                      className={[
                        'notification-item',
                        item.isRead ? '' : 'unread',
                        deletingAll || deletingIds.has(item.id) ? 'notification-removing' : '',
                      ].filter(Boolean).join(' ')}
                      key={item.id}
                    >
                      <button className="notification-content" onClick={() => void markRead(item)} type="button">
                        <img src="/icon.png" alt="" />
                        <span><strong>{item.title}</strong><span>{item.message}</span>{deviceDescription(item) && <small>{deviceDescription(item)}</small>}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('tr-TR')}</time></span>
                      </button>
                      <button className="notification-delete" onClick={() => void deleteItem(item.id)} aria-label="Bildirimi sil" type="button">×</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="notification-footer">
                {!showHistory && <button onClick={() => setShowHistory(true)} type="button">Bildirim geçmişi</button>}
                {showHistory && items.length >= offset + 50 && <button onClick={() => void loadMore()} type="button">Daha eski bildirimleri yükle</button>}
                <button className="notification-danger" disabled={!items.length} onClick={() => void clearAll()} type="button">Tümünü temizle</button>
              </div>
            </>
          )}
        </section>
      )}

      {permissionPrompt && (
        <div className="notification-modal-backdrop" role="presentation">
          <section aria-labelledby="notification-prompt-title" aria-modal="true" className="notification-modal" role="dialog">
            <img className="notification-logo" src="/icon.png" alt="" />
            <span className="notification-modal-bell" aria-hidden="true">🔔</span>
            <h2 id="notification-prompt-title">Bildirimleri Kaçırma!</h2>
            <p>Şakanın Sınırında platformundaki yeni sorulardan, uzman yanıtlarından ve yayımlanan senaryolardan anında haberdar ol.</p>
            {permissionDenied && <p className="notification-help">Tarayıcı izni reddedilmiş. İzni tarayıcı ayarlarından açıp Bildirim Ayarları bölümünden etkinleştirin.</p>}
            {error && <p className="notification-error" role="status">{error}</p>}
            {!permissionDenied && <button className="notification-primary" onClick={() => void enablePush()} type="button">Bildirimleri Etkinleştir</button>}
            <button className="notification-secondary" onClick={dismissPrompt} type="button">Şimdilik Daha Sonra</button>
            <button className="notification-text-button" onClick={() => { dismissPrompt(); setOpen(true); setShowSettings(true); }} type="button">Bildirim ayarlarını aç</button>
          </section>
        </div>
      )}
    </div>
  );
}

function deviceDescription(item: NotificationItem): string {
  if (item.type !== 'admin_new_device' || typeof item.metadata?.userAgent !== 'string') return '';
  const agent = item.metadata.userAgent;
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Bilinmeyen tarayıcı';
  const platform = /Windows/.test(agent) ? 'Windows' : /Mac OS/.test(agent) ? 'macOS' : /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Linux/.test(agent) ? 'Linux' : 'Bilinmeyen platform';
  return `${browser} · ${platform}`;
}

function decodeVapidKey(value: string): BufferSource {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)) as BufferSource;
}
