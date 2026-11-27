import { supabaseClient } from './supabaseClient';

type JsonRecord = Record<string, unknown>;
type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase bağlantı ayarları eksik.');
  }
  return supabaseClient;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await requireClient().auth.getUser();
  if (error) throw new Error(`Oturum doğrulanamadı: ${error.message}`);
  if (!data.user) throw new Error('Bu işlem için oturum açmalısınız.');
  return data.user.id;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function scenario(row: JsonRecord) {
  return {
    id: row.id,
    title: row.title,
    scenarioText: row.scenario_text,
    context: row.context_text,
    videoUrl: row.video_url ?? '',
    uploadedVideoUrl: row.uploaded_video_url ?? '',
    perspectives: row.perspectives ?? [],
    reflectionQuestions: row.reflection_questions ?? [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

async function signedVideoUrl(path: unknown): Promise<string> {
  if (typeof path !== 'string' || !path) return '';
  const { data, error } = await requireClient().storage
    .from('scenario-videos')
    .createSignedUrl(path, 60 * 60);
  throwIfError(error);
  if (!data) throw new Error('Senaryo videosu için imzalı bağlantı alınamadı.');
  return data.signedUrl;
}

export async function uploadScenarioVideo(file: File, scenarioId: string) {
  const client = requireClient();
  const previous = await client.from('scenarios').select('video_path').eq('id', scenarioId).single();
  throwIfError(previous.error);
  if (!previous.data) throw new Error('Senaryo bulunamadı.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${scenarioId}/${Date.now()}-${safeName}`;
  const uploaded = await client.storage.from('scenario-videos').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  throwIfError(uploaded.error);
  const updated = await client.from('scenarios').update({ video_path: path })
    .eq('id', scenarioId).select('video_url').single();
  if (updated.error) {
    const cleanup = await client.storage.from('scenario-videos').remove([path]);
    if (cleanup.error) throw new Error(`${updated.error.message}; uploaded file cleanup failed: ${cleanup.error.message}`);
    throw new Error(updated.error.message);
  }
  if (typeof previous.data.video_path === 'string') {
    const cleanup = await client.storage.from('scenario-videos').remove([previous.data.video_path]);
    if (cleanup.error) {
      throw new Error(`Video yüklendi ancak önceki video temizlenemedi: ${cleanup.error.message}`);
    }
  }
  return {
    videoUrl: updated.data.video_url ?? '',
    uploadedVideoUrl: await signedVideoUrl(path),
  };
}

function summary(row: JsonRecord) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    hasResponse: row.has_response ?? false,
    responseCount: row.response_count ?? 0,
  };
}

async function getScenario(id: string, withResponse: boolean) {
  const client = requireClient();
  const { data, error } = await client.from('scenarios').select('*').eq('id', id).single();
  throwIfError(error);
  let response: JsonRecord = {};
  if (withResponse) {
    const userId = await currentUserId();
    const result = await client.from('student_scenario_responses')
      .select('answers, classification, reasoning')
      .eq('scenario_id', id)
      .eq('student_id', userId)
      .maybeSingle();
    throwIfError(result.error);
    response = result.data ?? {};
  }
  return {
    ...scenario(data),
    uploadedVideoUrl: await signedVideoUrl(data.video_path),
    answers: response.answers ?? {},
    classification: response.classification ?? null,
    reasoning: response.reasoning ?? '',
  };
}

async function getQuestions(mine: boolean) {
  const client = requireClient();
  let query = client.from('expert_questions').select('*').order('created_at', { ascending: false });
  if (mine) query = query.eq('student_id', await currentUserId());
  const { data, error } = await query;
  throwIfError(error);
  const questions = data ?? [];
  const ids = [...new Set(questions.flatMap((item: JsonRecord) =>
    [item.student_id, item.answered_by].filter((id): id is string => typeof id === 'string'),
  ))];
  const profilesResult = ids.length
    ? await client.from('profiles').select('id, username').in('id', ids)
    : { data: [], error: null };
  throwIfError(profilesResult.error);
  const usernames = new Map((profilesResult.data ?? []).map((item: JsonRecord) => [item.id, item.username]));
  const scenarioIds = [...new Set(questions.map((item: JsonRecord) => item.scenario_id).filter(Boolean))];
  const scenariosResult = scenarioIds.length
    ? await client.from('scenarios').select('id, title').in('id', scenarioIds)
    : { data: [], error: null };
  throwIfError(scenariosResult.error);
  const scenarioTitles = new Map((scenariosResult.data ?? []).map((item: JsonRecord) => [item.id, item.title]));

  return questions.map((item: JsonRecord) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    scenarioId: item.scenario_id,
    scenarioTitle: scenarioTitles.get(item.scenario_id) ?? null,
    studentUsername: usernames.get(item.student_id) ?? null,
    answeredByUsername: usernames.get(item.answered_by) ?? null,
    createdAt: item.created_at,
    answeredAt: item.answered_at,
  }));
}

export async function supabaseRequest<T>(
  path: string,
  body?: JsonRecord,
  method: ApiMethod = body ? 'POST' : 'GET',
): Promise<T> {
  const client = requireClient();
  const url = new URL(path, window.location.origin);
  const route = url.pathname;
  const userId = await currentUserId();
  const query = url.searchParams;

  if (route === '/scenarios/manage' && method === 'POST' && body) {
    const { data, error } = await client.from('scenarios').insert({
      title: body.title,
      scenario_text: body.scenarioText,
      context_text: body.context,
      video_url: body.videoUrl || null,
      perspectives: body.perspectives,
      reflection_questions: body.reflectionQuestions,
      created_by: userId,
    }).select('*').single();
    throwIfError(error);
    return scenario(data) as T;
  }

  if (route === '/scenarios' || route === '/scenarios/review' || route === '/scenarios/manage') {
    let query = client.from('scenarios').select('*').order('created_at', { ascending: false });
    if (route !== '/scenarios/manage') {
      query = query.eq('status', 'published').order('published_at', { ascending: false });
    }
    const { data, error } = await query;
    throwIfError(error);
    if (route === '/scenarios/manage' || route === '/scenarios/review') {
      return await Promise.all((data ?? []).map(async (row: JsonRecord) => ({
        ...scenario(row),
        uploadedVideoUrl: await signedVideoUrl(row.video_path),
      }))) as T;
    }
    const { data: responses, error: responseError } = await client.from('student_scenario_responses')
      .select('scenario_id')
      .eq('student_id', userId);
    throwIfError(responseError);
    const responseCounts = new Map<string, number>();
    for (const response of responses ?? []) {
      if (typeof response.scenario_id === 'string') {
        responseCounts.set(response.scenario_id, (responseCounts.get(response.scenario_id) ?? 0) + 1);
      }
    }
    return (data ?? []).map((row: JsonRecord) => ({
      ...summary(row),
      hasResponse: typeof row.id === 'string' && responseCounts.has(row.id),
      responseCount: typeof row.id === 'string' ? responseCounts.get(row.id) ?? 0 : 0,
    })) as T;
  }

  const manageMatch = route.match(/^\/scenarios\/manage\/([^/]+)(?:\/(publish|unpublish))?$/);
  if (manageMatch) {
    const [, id, action] = manageMatch;
    if (action) {
      const { data, error } = await client.from('scenarios').update({
        status: action === 'publish' ? 'published' : 'draft',
        published_at: action === 'publish' ? new Date().toISOString() : null,
      }).eq('id', id).select('*').single();
      throwIfError(error);
      return scenario(data) as T;
    }
    if (method === 'GET') return await getScenario(id, false) as T;
    if (method === 'DELETE') {
      const current = await client.from('scenarios').select('video_path').eq('id', id).single();
      throwIfError(current.error);
      if (!current.data) throw new Error('Senaryo bulunamadı.');
      const { error } = await client.from('scenarios').delete().eq('id', id);
      throwIfError(error);
      if (typeof current.data.video_path === 'string') {
        const cleanup = await client.storage.from('scenario-videos').remove([current.data.video_path]);
        if (cleanup.error) {
          throw new Error(`Senaryo silindi ancak videosu temizlenemedi: ${cleanup.error.message}`);
        }
      }
      return { message: 'Senaryo silindi.' } as T;
    }
    if (method === 'PUT' && body) {
      const { data, error } = await client.from('scenarios').update({
        title: body.title,
        scenario_text: body.scenarioText,
        context_text: body.context,
        video_url: body.videoUrl || null,
        perspectives: body.perspectives,
        reflection_questions: body.reflectionQuestions,
      }).eq('id', id).select('*').single();
      throwIfError(error);
      return scenario(data) as T;
    }
  }

  const scenarioMatch = route.match(/^\/scenarios\/([^/]+)$/);
  if (scenarioMatch && method === 'GET') return await getScenario(scenarioMatch[1], true) as T;

  if (route === '/scenarios/admin/responses' && method === 'GET') {
    let responseQuery = client.from('student_scenario_responses')
      .select('student_id, scenario_id, answers, classification, reasoning, updated_at, scenarios(title, reflection_questions)');
    const studentId = query.get('studentId');
    const scenarioId = query.get('scenarioId');
    if (studentId) responseQuery = responseQuery.eq('student_id', studentId);
    if (scenarioId) responseQuery = responseQuery.eq('scenario_id', scenarioId);
    const { data, error } = await responseQuery.order('updated_at', { ascending: false });
    throwIfError(error);
    const ids = [...new Set((data ?? []).map((item: JsonRecord) => item.student_id))];
    const profiles = ids.length
      ? await client.from('profiles').select('id, username').in('id', ids)
      : { data: [], error: null };
    throwIfError(profiles.error);
    const usernames = new Map((profiles.data ?? []).map((item: JsonRecord) => [item.id, item.username]));
    return (data ?? []).map((item: JsonRecord) => ({
      studentId: item.student_id,
      studentUsername: usernames.get(item.student_id) ?? '',
      scenarioId: item.scenario_id,
      scenarioTitle: (item.scenarios as JsonRecord | null)?.title ?? '',
      answers: item.answers,
      reflectionQuestions: (item.scenarios as JsonRecord | null)?.reflection_questions ?? [],
      classification: item.classification,
      reasoning: item.reasoning,
      updatedAt: item.updated_at,
    })) as T;
  }

  const responseMatch = route.match(/^\/scenarios\/([^/]+)\/responses$/);
  if (responseMatch && method === 'POST' && body) {
    const { data, error } = await client.from('student_scenario_responses').upsert({
      student_id: userId,
      scenario_id: responseMatch[1],
      answers: body.answers,
      classification: body.classification,
      reasoning: body.reasoning,
      updated_at: new Date().toISOString(),
    }).select('updated_at').single();
    throwIfError(error);
    if (!data) throw new Error('Yanıt kaydedilemedi.');
    return { updatedAt: data.updated_at } as T;
  }

  if (route === '/expert-questions' && method === 'GET') return await getQuestions(false) as T;
  if (route === '/expert-questions/mine' && method === 'GET') return await getQuestions(true) as T;
  if (route === '/expert-questions' && method === 'POST' && body) {
    const { data, error } = await client.from('expert_questions').insert({
      student_id: userId,
      scenario_id: body.scenarioId ?? null,
      question: body.question,
    }).select('*').single();
    throwIfError(error);
    return data as T;
  }

  const answerMatch = route.match(/^\/expert-questions\/([^/]+)\/answer$/);
  if (answerMatch && method === 'PATCH' && body) {
    const { data, error } = await client.from('expert_questions').update({
      answer: body.answer,
      answered_by: userId,
      answered_at: new Date().toISOString(),
    }).eq('id', answerMatch[1]).select('*').single();
    throwIfError(error);
    return data as T;
  }

  if (route === '/problem-reports' && method === 'POST' && body) {
    const { data, error } = await client.from('profiles').select('role').eq('id', userId).single();
    throwIfError(error);
    if (!data) throw new Error('Kullanıcı profili bulunamadı.');
    const result = await client.from('problem_reports').insert({
      reporter_id: userId,
      reporter_role: data.role,
      screen: body.screen,
      description: body.description,
      context: body.context ?? {},
    }).select('*').single();
    throwIfError(result.error);
    return result.data as T;
  }

  if (route === '/problem-reports' && method === 'GET') {
    let reportQuery = client.from('problem_reports').select('*').order('created_at', { ascending: false });
    const status = query.get('status');
    const reporterId = query.get('reporterId');
    if (status && status !== 'all') reportQuery = reportQuery.eq('status', status);
    if (reporterId) reportQuery = reportQuery.eq('reporter_id', reporterId);
    const { data, error } = await reportQuery;
    throwIfError(error);
    const ids = [...new Set((data ?? []).flatMap((item: JsonRecord) =>
      [item.reporter_id, item.resolved_by].filter((id): id is string => typeof id === 'string'),
    ))];
    const profiles = ids.length
      ? await client.from('profiles').select('id, username').in('id', ids)
      : { data: [], error: null };
    throwIfError(profiles.error);
    const usernames = new Map((profiles.data ?? []).map((item: JsonRecord) => [item.id, item.username]));
    return (data ?? []).map((item: JsonRecord) => ({
      id: item.id,
      reporterUsername: usernames.get(item.reporter_id) ?? '',
      reporterRole: item.reporter_role === 'expert' ? 'teacher' : item.reporter_role,
      screen: item.screen,
      description: item.description,
      context: item.context,
      status: item.status,
      resolvedByUsername: usernames.get(item.resolved_by) ?? null,
      createdAt: item.created_at,
      resolvedAt: item.resolved_at,
    })) as T;
  }
  const reportMatch = route.match(/^\/problem-reports\/([^/]+)\/resolve$/);
  if (reportMatch && method === 'PATCH') {
    const { data, error } = await client.from('problem_reports').update({
      status: 'resolved',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    }).eq('id', reportMatch[1]).select('*').single();
    throwIfError(error);
    return data as T;
  }

  if (route === '/admin/users' || route.startsWith('/admin/users/')) {
    const targetUserId = route.match(/^\/admin\/users\/([^/]+)$/)?.[1];
    const action = method === 'GET'
      ? 'list'
      : method === 'POST'
        ? 'create'
        : method === 'PATCH'
          ? 'update'
          : method === 'DELETE'
            ? 'delete'
            : null;
    if (!action || (action === 'list' && targetUserId)
      || (action !== 'list' && action !== 'create' && !targetUserId)) {
      throw new Error('Kullanıcı işlemi geçersiz.');
    }
    const { data, error } = await client.functions.invoke('admin-users', {
      body: { action, userId: targetUserId, user: body },
    });
    throwIfError(error);
    return data as T;
  }

  if (route === '/admin/audit-logs' && method === 'GET') {
    const limit = Math.min(Number(query.get('limit') ?? 100), 200);
    const offset = Math.max(Number(query.get('offset') ?? 0), 0);
    let logQuery = client.from('audit_logs').select('*').order('created_at', { ascending: false })
      .range(offset, offset + limit);
    const actorId = query.get('userId');
    if (actorId) logQuery = logQuery.eq('actor_user_id', actorId);
    const { data, error } = await logQuery;
    throwIfError(error);
    const logs = data ?? [];
    return {
      logs: logs.slice(0, limit).map((item: JsonRecord) => ({
        id: item.id,
        actorUsername: item.actor_username,
        actorRole: item.actor_role === 'expert' ? 'teacher' : item.actor_role,
        action: item.action,
        entityType: item.entity_type,
        entityId: item.entity_id,
        details: item.details,
        createdAt: item.created_at,
      })),
      hasMore: logs.length > limit,
    } as T;
  }

  if (route === '/notifications' && method === 'GET') {
    const limit = Math.min(Number(query.get('limit') ?? 50), 100);
    const offset = Math.max(Number(query.get('offset') ?? 0), 0);
    const { data, error } = await client.from('notifications').select('*')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    throwIfError(error);
    return (data ?? []).map((item: JsonRecord) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      targetUrl: item.target_url,
      metadata: item.metadata,
      isRead: item.is_read,
      createdAt: item.created_at,
      readAt: item.read_at,
    })) as T;
  }
  if (route === '/notifications/unread-count') {
    const { count, error } = await client.from('notifications').select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', userId).eq('is_read', false);
    throwIfError(error);
    return { count: count ?? 0 } as T;
  }
  if (route === '/notifications/settings' && method === 'GET') {
    const preferences = await client.from('notification_preferences')
      .select('in_app_enabled').eq('user_id', userId).maybeSingle();
    throwIfError(preferences.error);
    const push = await client.from('push_subscriptions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    throwIfError(push.error);
    return { inAppEnabled: preferences.data?.in_app_enabled ?? true, subscribed: (push.count ?? 0) > 0 } as T;
  }
  if (route === '/notifications/settings' && method === 'PATCH' && body) {
    const { data, error } = await client.from('notification_preferences').upsert({
      user_id: userId,
      in_app_enabled: body.inAppEnabled,
      updated_at: new Date().toISOString(),
    }).select('in_app_enabled').single();
    throwIfError(error);
    if (!data) throw new Error('Bildirim ayarları kaydedilemedi.');
    return { inAppEnabled: data.in_app_enabled } as T;
  }
  if (route === '/notifications/read-all' && method === 'PATCH') {
    const { error } = await client.from('notifications').update({
      is_read: true,
      read_at: new Date().toISOString(),
    }).eq('recipient_user_id', userId).eq('is_read', false);
    throwIfError(error);
    return { updatedCount: 0 } as T;
  }
  if (route === '/notifications' && method === 'DELETE') {
    const { error } = await client.from('notifications').delete().eq('recipient_user_id', userId);
    throwIfError(error);
    return { deletedCount: 0 } as T;
  }
  const notificationRead = route.match(/^\/notifications\/([^/]+)\/read$/);
  if (notificationRead && method === 'PATCH') {
    const { error } = await client.from('notifications').update({
      is_read: true,
      read_at: new Date().toISOString(),
    }).eq('id', notificationRead[1]).eq('recipient_user_id', userId);
    throwIfError(error);
    return { updated: true } as T;
  }
  const notificationId = route.match(/^\/notifications\/([^/]+)$/);
  if (notificationId && method === 'DELETE') {
    const { error } = await client.from('notifications').delete()
      .eq('id', notificationId[1]).eq('recipient_user_id', userId);
    throwIfError(error);
    return { deleted: true } as T;
  }

  if (route === '/notifications/push/vapid-public-key') {
    return { publicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '' } as T;
  }
  if (route === '/notifications/push/status') {
    const { count, error } = await client.from('push_subscriptions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    throwIfError(error);
    return { subscribed: (count ?? 0) > 0 } as T;
  }
  if (route === '/notifications/push/subscribe' && method === 'POST' && body) {
    const deviceId = getDeviceId();
    const { error } = await client.from('push_subscriptions').upsert({
      user_id: userId,
      device_id: deviceId,
      endpoint: body.endpoint,
      p256dh: (body.keys as JsonRecord).p256dh,
      auth: (body.keys as JsonRecord).auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,device_id' });
    throwIfError(error);
    return { subscribed: true } as T;
  }
  if (route === '/notifications/push/unsubscribe' && method === 'DELETE') {
    const { error } = await client.from('push_subscriptions').delete()
      .eq('user_id', userId).eq('device_id', getDeviceId());
    throwIfError(error);
    return { unsubscribed: true } as T;
  }

  throw new Error(`Supabase API eşlemesi henüz tanımlanmadı: ${method} ${route}`);
}

function getDeviceId(): string {
  const key = 'sakanin-device-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  localStorage.setItem(key, value);
  return value;
}
