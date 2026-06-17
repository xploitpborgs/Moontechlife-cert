import { createClient } from '@supabase/supabase-js';
import { readBearerToken } from './_security.js';

const { process } = globalThis;
const ADMIN_ROLES = new Set(['admin', 'system_admin']);
let warnedAboutAnonFallback = false;

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

function requireEnvValue(label, ...names) {
  const value = readEnv(...names);
  if (!value) {
    throw new Error(`${label} is not configured.`);
  }
  return value;
}

function getSupabaseUrl() {
  return requireEnvValue('SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL');
}

function getSupabaseAnonKey() {
  return requireEnvValue('SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
}

function getSupabaseServerKey() {
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (serviceKey) return serviceKey;

  if (!warnedAboutAnonFallback) {
    warnedAboutAnonFallback = true;
    console.warn('[security] SUPABASE_SERVICE_ROLE_KEY is not configured. Falling back to the anon key on the server reduces security.');
  }

  return getSupabaseAnonKey();
}

function buildClient(key, globalHeaders = undefined) {
  return createClient(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: globalHeaders ? { headers: globalHeaders } : undefined,
  });
}

export function getPrivilegedSupabase() {
  return buildClient(getSupabaseServerKey());
}

export function getPublicSupabase() {
  return buildClient(getSupabaseAnonKey());
}

export function createTokenScopedSupabase(token) {
  return buildClient(getSupabaseAnonKey(), {
    Authorization: `Bearer ${token}`,
  });
}

export function getUserRoleCandidates(user, profileRole = '') {
  const roles = new Set();

  const pushRole = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushRole);
      return;
    }
    roles.add(String(value).trim().toLowerCase());
  };

  pushRole(user?.app_metadata?.role);
  pushRole(user?.app_metadata?.roles);
  pushRole(user?.user_metadata?.role);
  pushRole(user?.user_metadata?.roles);
  pushRole(profileRole);

  return [...roles];
}

export async function requireAdminRequest(req) {
  const token = readBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }

  try {
    const authClient = createTokenScopedSupabase(token);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return { ok: false, status: 401, error: 'Unauthorized.' };
    }

    const { data: profile } = await authClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    const roles = getUserRoleCandidates(userData.user, profile?.role || '');
    if (!roles.some((role) => ADMIN_ROLES.has(role))) {
      return { ok: false, status: 403, error: 'Forbidden.' };
    }

    return {
      ok: true,
      status: 200,
      user: userData.user,
      roles,
    };
  } catch (error) {
    console.error('[auth][admin]', error);
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }
}
