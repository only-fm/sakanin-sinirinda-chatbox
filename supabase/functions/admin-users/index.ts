import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

function validUsername(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 32
    && /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(value);
}

function loginEmail(username: string): string {
  return `${username.toLowerCase()}@login.sakanin-sinirinda.invalid`;
}

function validRole(value: unknown): value is 'student' | 'teacher' | 'expert' | 'admin' {
  return value === 'student' || value === 'teacher' || value === 'expert' || value === 'admin';
}

function databaseRole(role: 'student' | 'teacher' | 'expert' | 'admin') {
  return role === 'teacher' ? 'expert' : role;
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
    const { data: userResult, error: userError } = await callerClient.auth.getUser();
    if (userError || !userResult.user) fail(401, 'Oturum doğrulanamadı.');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const callerProfile = await adminClient.from('profiles')
      .select('role').eq('id', userResult.user.id).single();
    if (callerProfile.error) throw callerProfile.error;
    if (callerProfile.data.role !== 'admin') fail(403, 'Bu işlem için yönetici yetkisi gerekir.');
    const logAudit = async (actionName: string, entityId: string, details: Record<string, unknown>) => {
      const { data: actor, error: actorError } = await adminClient.from('profiles')
        .select('username, role').eq('id', userResult.user.id).single();
      if (actorError) throw actorError;
      const { error } = await adminClient.from('audit_logs').insert({
        actor_user_id: userResult.user.id,
        actor_username: actor.username,
        actor_role: actor.role,
        action: actionName,
        entity_type: 'user',
        entity_id: entityId,
        details,
      });
      if (error) {
        throw new Error(`Hesap işlemi tamamlandı ancak audit kaydı yazılamadı: ${error.message}`);
      }
    };

    const payload = await request.json() as {
      method?: string;
      path?: string;
      user?: Record<string, unknown>;
    };
    const action = payload.method ?? 'GET';
    const path = payload.path ?? '/admin/users';
    const id = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/i)?.[1];

    if (!id && action === 'GET') {
      const { data, error } = await adminClient.from('profiles')
        .select('id, username, role, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return response(200, (data ?? []).map((profile) => ({
        id: profile.id,
        username: profile.username,
        role: profile.role === 'expert' ? 'teacher' : profile.role,
        createdAt: profile.created_at,
      })));
    }

    if (action === 'POST' && path === '/admin/users') {
      const input = payload.user ?? {};
      if (!validUsername(input.username)) {
        fail(422, 'Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire içerebilir.');
      }
      if (typeof input.password !== 'string' || input.password.length < 1
        || input.password.length > 128 || input.password.trim() !== input.password) {
        fail(422, 'Parola 1-128 karakter olmalı ve başında/sonunda boşluk içermemeli.');
      }
      if (!validRole(input.role)) fail(422, 'Kullanıcı rolü geçersiz.');
      const username = input.username.toLowerCase();
      const duplicate = await adminClient.from('profiles').select('id').eq('username', username).maybeSingle();
      if (duplicate.error) throw duplicate.error;
      if (duplicate.data) fail(409, 'Bu kullanıcı adı zaten kullanılıyor.');

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
      }).eq('id', created.data.user.id).select('id, username, role, created_at').single();
      if (profile.error) {
        const rollback = await adminClient.auth.admin.deleteUser(created.data.user.id);
        if (rollback.error) {
          throw new Error(`${profile.error.message}; kullanıcı geri alma hatası: ${rollback.error.message}`);
        }
        throw profile.error;
      }
      await logAudit('account.created', profile.data.id, { username, role: input.role });
      return response(201, {
        id: profile.data.id,
        username: profile.data.username,
        role: input.role,
        createdAt: profile.data.created_at,
      });
    }

    if (!id || !['PATCH', 'DELETE'].includes(action)) fail(404, 'İstenen kullanıcı uç noktası bulunamadı.');
    if (id === userResult.user.id) fail(409, 'Kullanmakta olduğunuz yönetici hesabını değiştiremez veya silemezsiniz.');

    const target = await adminClient.auth.admin.getUserById(id);
    if (target.error) throw target.error;
    const targetProfile = await adminClient.from('profiles')
      .select('username, role').eq('id', id).single();
    if (targetProfile.error) throw targetProfile.error;
    if (action === 'DELETE') {
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) throw error;
      await logAudit('account.deleted', id, {
        username: targetProfile.data.username,
        role: targetProfile.data.role,
      });
      return response(200, { message: 'Hesap silindi.' });
    }

    const input = payload.user ?? {};
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
      : String(target.data.user.user_metadata.username ?? '');
    if (input.username !== undefined && username !== targetProfile.data.username) {
      const duplicate = await adminClient.from('profiles')
        .select('id').eq('username', username).neq('id', id).maybeSingle();
      if (duplicate.error) throw duplicate.error;
      if (duplicate.data) fail(409, 'Bu kullanıcı adı zaten kullanılıyor.');
    }
    const authUpdate: Record<string, unknown> = {};
    if (input.password !== undefined) authUpdate.password = input.password;
    if (input.username !== undefined) {
      authUpdate.email = loginEmail(username);
      authUpdate.email_confirm = true;
      authUpdate.user_metadata = { ...target.data.user.user_metadata, username };
    }
    if (Object.keys(authUpdate).length) {
      const updatedAuth = await adminClient.auth.admin.updateUserById(id, authUpdate);
      if (updatedAuth.error) throw updatedAuth.error;
    }
    const profileUpdate: Record<string, unknown> = {};
    if (input.username !== undefined) profileUpdate.username = username;
    if (input.role !== undefined) profileUpdate.role = databaseRole(input.role);
    const updated = await adminClient.from('profiles').update(profileUpdate)
      .eq('id', id).select('id, username, role, created_at').single();
    if (updated.error) throw updated.error;
    await logAudit('account.updated', id, {
      ...(input.username === undefined ? {} : { username: updated.data.username }),
      ...(input.role === undefined ? {} : { role: updated.data.role }),
      changedPassword: input.password !== undefined,
    });
    return response(200, {
      id: updated.data.id,
      username: updated.data.username,
      role: updated.data.role === 'expert' ? 'teacher' : updated.data.role,
      createdAt: updated.data.created_at,
    });
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    const message = error instanceof Error ? error.message : 'Bilinmeyen sunucu hatası.';
    return response(status, { message });
  }
});
