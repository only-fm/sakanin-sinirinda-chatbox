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

function loginEmail(username: string): string {
  return `${username.toLowerCase()}@login.sakanin-sinirinda.invalid`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { message: 'Yalnızca POST desteklenir.' });
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(500, { message: 'Supabase Function ortam değişkenleri yapılandırılmamış.' });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return response(400, { message: 'İstek gövdesi geçersiz.' });
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return response(400, { message: 'İstek gövdesi geçersiz.' });
  }
  const { email, password, captchaToken } = payload as Record<string, unknown>;
  if (typeof email !== 'string' || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== 'string' || password.length < 1 || password.length > 128
    || typeof captchaToken !== 'string' || !captchaToken.trim()) {
    return response(422, { message: 'Geçerli e-posta, parola ve Turnstile doğrulaması gereklidir.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('username')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (profileError) {
    console.error('Email login profile lookup failed', profileError.message);
    return response(500, { message: 'Giriş işlemi şu anda tamamlanamadı.' });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: authError } = await authClient.auth.signInWithPassword({
    email: profile ? loginEmail(profile.username) : normalizedEmail,
    password,
    options: { captchaToken },
  });

  if (authError) {
    if (authError.code === 'invalid_credentials') {
      return response(401, { message: 'E-posta veya parola hatalı.' });
    }
    return response(401, { message: authError.message });
  }
  if (!data.session) {
    return response(401, { message: 'E-posta veya parola hatalı.' });
  }

  return response(200, {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});
