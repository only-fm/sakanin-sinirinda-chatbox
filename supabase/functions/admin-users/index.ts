import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

type AccountRole = 'student' | 'teacher' | 'expert' | 'admin';
type Action = 'list' | 'create' | 'update' | 'delete';

type Payload = {
  action: Action;
  userId?: string;
  user?: Record<string, unknown>;
};

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, message: string): never {
  throw new RequestError(status, message);
}

function validUsername(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= 32
    && /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(value);
}

function validRole(value: unknown): value is AccountRole {
  return value === 'student' || value === 'teacher' || value === 'expert' || value === 'admin';
}

function databaseRole(role: AccountRole): 'student' | 'expert' | 'admin' {
  return role === 'teacher' ? 'expert' : role;
}

function publicRole(role: 'student' | 'expert' | 'admin'): 'student' | 'teacher' | 'admin' {
  return role === 'expert' ? 'teacher' : role;
}

function parsePayload(value: unknown): Payload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(400, 'İstek gövdesi geçersiz.');
  }
  const payload = value as Record<string, unknown>;
  if (payload.action !== 'list' && payload.action !== 'create'
    && payload.action !== 'update' && payload.action !== 'delete') {
    fail(400, 'Kullanıcı işlemi geçersiz.');
  }
  if (payload.userId !== undefined
    && (typeof payload.userId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.userId))) {
    fail(400, 'Kullanıcı kimliği geçersiz.');
  }
  if (payload.user !== undefined
    && (typeof payload.user !== 'object' || payload.user === null || Array.isArray(payload.user))) {
    fail(400, 'Kullanıcı bilgileri geçersiz.');
  }
  return payload as Payload;
}

function loginEmail(username: string): string {
  return `${username.toLowerCase()}@login.sakanin-sinirinda.invalid`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { message: 'Yalnızca POST desteklenir.' });
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(500, { message: 'Supabase Function ortam değişkenleri yapılandırılmamış.' });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) fail(401, 'Oturum doğrulanamadı.');

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) fail(401, 'Oturum doğrulanamadı.');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('role, username')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (caller?.role !== 'admin') fail(403, 'Bu işlem için yönetici yetkisi gerekir.');

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      fail(400, 'İstek gövdesi geçersiz.');
    }
    const payload = parsePayload(requestBody);
    const input = payload.user ?? {};
    const targetId = payload.userId;
    const audit = async (action: string, id: string, details: Record<string, unknown>) => {
      const { error } = await adminClient.from('audit_logs').insert({
        actor_user_id: authData.user.id,
        actor_username: caller.username,
        actor_role: caller.role,
        action,
        entity_type: 'user',
        entity_id: id,
        details,
      });
      if (error) throw new Error(`Hesap işlemi tamamlandı ancak audit kaydı yazılamadı: ${error.message}`);
    };

    if (payload.action === 'list') {
      if (targetId || payload.user) fail(400, 'Listeleme isteği geçersiz.');
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, username, role')
        .order('username', { ascending: true });
      if (error) throw error;
      return response(200, (data ?? []).map((profile) => ({
        id: profile.id,
        username: profile.username,
        role: publicRole(profile.role),
      })));
    }

    if (payload.action === 'create') {
      if (targetId) fail(400, 'Yeni hesap isteği geçersiz.');
      if (!validUsername(input.username)) {
        fail(422, 'Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire içerebilir.');
      }
      if (typeof input.password !== 'string' || input.password.length < 1
        || input.password.length > 128 || input.password.trim() !== input.password) {
        fail(422, 'Parola 1-128 karakter olmalı ve başında/sonunda boşluk içermemeli.');
      }
      if (!validRole(input.role)) fail(422, 'Kullanıcı rolü geçersiz.');

      const username = input.username.toLowerCase();
      const { data: duplicate, error: duplicateError } = await adminClient
        .from('profiles').select('id').eq('username', username).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) fail(409, 'Bu kullanıcı adı zaten kullanılıyor.');

      const created = await adminClient.auth.admin.createUser({
        email: loginEmail(username),
        password: input.password,
        email_confirm: true,
        user_metadata: { username },
      });
      if (created.error) throw created.error;

      const profile = await adminClient.from('profiles').update({
        username,
        role: databaseRole(input.role),
      }).eq('id', created.data.user.id).select('id, username, role').single();
      if (profile.error) {
        const rollback = await adminClient.auth.admin.deleteUser(created.data.user.id);
        if (rollback.error) {
          throw new Error(`${profile.error.message}; kullanıcı geri alma hatası: ${rollback.error.message}`);
        }
        throw profile.error;
      }
      await audit('account.created', profile.data.id, { username, role: input.role });
      return response(201, {
        id: profile.data.id,
        username: profile.data.username,
        role: publicRole(databaseRole(input.role)),
      });
    }

    if (!targetId) fail(400, 'Kullanıcı kimliği eksik.');
    if (targetId === authData.user.id) fail(409, 'Kullanmakta olduğunuz yönetici hesabını değiştiremez veya silemezsiniz.');

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles').select('id, username, role').eq('id', targetId).maybeSingle();
    if (targetProfileError) throw targetProfileError;
    if (!targetProfile) fail(404, 'Kullanıcı profili bulunamadı.');

    if (payload.action === 'delete') {
      if (payload.user) fail(400, 'Silme isteği geçersiz.');
      const { error } = await adminClient.auth.admin.deleteUser(targetId);
      if (error) throw error;
      await audit('account.deleted', targetId, {
        username: targetProfile.username,
        role: targetProfile.role,
      });
      return response(200, { message: 'Hesap silindi.' });
    }

    if (Object.keys(input).some((key) => !['username', 'password', 'role'].includes(key))) {
      fail(422, 'Güncellenecek alanlar geçersiz.');
    }
    if (input.username === undefined && input.password === undefined && input.role === undefined) {
      fail(422, 'Kullanıcı adı, rol veya yeni parola girilmeli.');
    }
    if (input.username !== undefined && !validUsername(input.username)) {
      fail(422, 'Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire içerebilir.');
    }
    if (input.password !== undefined && (typeof input.password !== 'string'
      || input.password.length < 1 || input.password.length > 128
      || input.password.trim() !== input.password)) {
      fail(422, 'Parola 1-128 karakter olmalı ve başında/sonunda boşluk içermemeli.');
    }
    if (input.role !== undefined && !validRole(input.role)) fail(422, 'Kullanıcı rolü geçersiz.');

    const username = typeof input.username === 'string'
      ? input.username.toLowerCase()
      : targetProfile.username;
    if (input.username !== undefined && username !== targetProfile.username) {
      const { data: duplicate, error } = await adminClient
        .from('profiles').select('id').eq('username', username).neq('id', targetId).maybeSingle();
      if (error) throw error;
      if (duplicate) fail(409, 'Bu kullanıcı adı zaten kullanılıyor.');
    }

    const profileUpdate: Record<string, unknown> = {};
    if (input.username !== undefined) profileUpdate.username = username;
    if (input.role !== undefined) profileUpdate.role = databaseRole(input.role);
    if (Object.keys(profileUpdate).length) {
      const { error } = await adminClient.from('profiles').update(profileUpdate).eq('id', targetId);
      if (error) throw error;
    }

    const authUpdate: Record<string, unknown> = {};
    if (input.password !== undefined) authUpdate.password = input.password;
    if (input.username !== undefined) {
      authUpdate.email = loginEmail(username);
      authUpdate.email_confirm = true;
      authUpdate.user_metadata = { username };
    }
    if (Object.keys(authUpdate).length) {
      const { error } = await adminClient.auth.admin.updateUserById(targetId, authUpdate);
      if (error) {
        if (Object.keys(profileUpdate).length) {
          const rollback = await adminClient.from('profiles').update({
            username: targetProfile.username,
            role: targetProfile.role,
          }).eq('id', targetId);
          if (rollback.error) {
            throw new Error(`${error.message}; profil geri alma hatası: ${rollback.error.message}`);
          }
        }
        throw error;
      }
    }

    await audit('account.updated', targetId, {
      ...(input.username === undefined ? {} : { username }),
      ...(input.role === undefined ? {} : { role: databaseRole(input.role) }),
      changedPassword: input.password !== undefined,
    });
    return response(200, {
      id: targetProfile.id,
      username,
      role: publicRole(input.role === undefined ? targetProfile.role : databaseRole(input.role)),
    });
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Bilinmeyen sunucu hatası.';
    return response(status, { message });
  }
});
