const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables from standard project locations (server/.env, root .env, client/.env)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../client/.env') });

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Strips surrounding quotes and whitespace from an environment variable string.
 */
function cleanEnvValue(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

/**
 * Helper to check whether a key string is non-empty and not a dummy/placeholder.
 */
function isValidKeyString(val) {
  const cleaned = cleanEnvValue(val);
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  if (
    lower.includes('your_supabase') ||
    lower.includes('your-supabase') ||
    lower.includes('your_secret') ||
    lower.includes('your_hidden') ||
    lower.includes('your_publishable') ||
    lower.includes('your_anon') ||
    lower.includes('your_service_role') ||
    lower.includes('placeholder') ||
    lower.startsWith('<your')
  ) {
    return false;
  }
  return true;
}

/**
 * Extracts a key from Supabase's JSON dictionary environment variable format
 * (e.g., SUPABASE_SECRET_KEYS='{"default":"sb_secret_..."}' or SUPABASE_PUBLISHABLE_KEYS).
 */
function extractKeyFromJsonEnv(rawJson, preferredKeyName = 'default') {
  const cleaned = cleanEnvValue(rawJson);
  if (!cleaned || !cleaned.startsWith('{')) return '';
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      if (isValidKeyString(parsed[preferredKeyName])) {
        return cleanEnvValue(parsed[preferredKeyName]);
      }
      for (const val of Object.values(parsed)) {
        if (isValidKeyString(val)) {
          return cleanEnvValue(val);
        }
      }
    }
  } catch (_) {}
  return '';
}

/**
 * Decodes the payload of a 3-part JWT without throwing.
 */
function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

/**
 * Classifies the type of Supabase key:
 * - 'publishable' (modern sb_publishable_... or sbp_...)
 * - 'secret' (modern sb_secret_... or sbs_...)
 * - 'legacy_jwt' (legacy anon / service_role JWT starting with eyJ...)
 * - 'unknown'
 */
function getKeyType(key) {
  const trimmed = cleanEnvValue(key);
  if (!trimmed) return 'unknown';
  if (trimmed.startsWith('sb_publishable_') || trimmed.startsWith('sbp_')) {
    return 'publishable';
  }
  if (trimmed.startsWith('sb_secret_') || trimmed.startsWith('sbs_')) {
    return 'secret';
  }
  if (trimmed.startsWith('eyJ')) {
    return 'legacy_jwt';
  }
  return 'unknown';
}

/**
 * Determines whether a key is a secret/service_role key that must never be used as a publishable key.
 */
function isSecretOrServiceRoleKey(key) {
  const trimmed = cleanEnvValue(key);
  if (!trimmed) return false;
  if (getKeyType(trimmed) === 'secret') return true;
  if (getKeyType(trimmed) === 'legacy_jwt') {
    const payload = decodeJwtPayload(trimmed);
    if (payload && payload.role === 'service_role') return true;
  }
  return false;
}

/**
 * Validates whether a token is an authenticated end-user Supabase JWT
 * (as opposed to 'dev-fallback-token', a teacher passcode, an sb_publishable_/sb_secret_ key,
 * or a static anon/service_role JWT).
 */
function isValidUserJwt(token) {
  const trimmed = cleanEnvValue(token);
  if (!trimmed || !trimmed.startsWith('eyJ')) return false;
  const payload = decodeJwtPayload(trimmed);
  if (!payload || typeof payload !== 'object') return false;
  if (payload.role === 'anon' || payload.role === 'service_role') return false;
  return Boolean(payload.sub && isValidUuid(payload.sub));
}

/**
 * Resolves the Supabase Project URL from environment variables.
 */
function getSupabaseUrl() {
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ];
  for (const candidate of candidates) {
    const cleaned = cleanEnvValue(candidate);
    if (
      cleaned &&
      cleaned.startsWith('http') &&
      !cleaned.includes('your-supabase-project') &&
      !cleaned.includes('your_supabase')
    ) {
      return cleaned;
    }
  }
  return '';
}

/**
 * Resolves the Publishable Key (used for client/browser & RLS-scoped requests).
 * Safe to expose publicly in client browsers.
 *
 * Priority:
 * 1. SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_DEFAULT_KEY / SUPABASE_PUBLIC_KEY
 * 2. SUPABASE_PUBLISHABLE_KEYS (JSON dictionary format)
 * 3. VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * 4. SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy JWT format)
 */
function getPublishableKey() {
  const directCandidates = [
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    process.env.SUPABASE_PUBLIC_KEY,
    extractKeyFromJsonEnv(process.env.SUPABASE_PUBLISHABLE_KEYS),
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ];

  for (const candidate of directCandidates) {
    if (isValidKeyString(candidate)) {
      const cleaned = cleanEnvValue(candidate);
      // Guard against accidentally placing a secret/service_role key into a publishable key variable
      if (!isSecretOrServiceRoleKey(cleaned)) {
        return cleaned;
      }
    }
  }

  return '';
}

/**
 * Resolves the Secret / Hidden Key (used for privileged server-side operations, bypasses RLS).
 * Must remain confidential on the server.
 *
 * Priority:
 * 1. SUPABASE_SECRET_KEY / SUPABASE_SECRET_DEFAULT_KEY / SUPABASE_HIDDEN_KEY (modern standard)
 * 2. SUPABASE_SECRET_KEYS (JSON dictionary format)
 * 3. SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY (legacy JWT format)
 * 4. Falls back to Publishable Key if no secret key is provided (restricted client mode)
 */
function getSecretKey() {
  const secretCandidates = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SECRET_DEFAULT_KEY,
    process.env.SUPABASE_HIDDEN_KEY,
    extractKeyFromJsonEnv(process.env.SUPABASE_SECRET_KEYS),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ];

  for (const candidate of secretCandidates) {
    if (isValidKeyString(candidate)) {
      return cleanEnvValue(candidate);
    }
  }

  return getPublishableKey();
}

/**
 * Returns true if a dedicated privileged Secret / Service Role key is configured
 * (rather than falling back to a publishable/anon key).
 */
function hasPrivilegedSecretKey() {
  const key = getSecretKey();
  return isSecretOrServiceRoleKey(key);
}

// Backward-compatibility aliases
const getAnonKey = getPublishableKey;
const getValidKey = getSecretKey;

function checkConfigured() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return false;
  }
  const url = getSupabaseUrl();
  const key = getSecretKey() || getPublishableKey();
  return Boolean(url && key);
}

let cachedAdminClient = null;
let cachedAdminUrl = '';
let cachedAdminKey = '';

/**
 * Builds options for a stateless server-side Supabase client.
 * For non-JWT keys (sb_secret_... and sb_publishable_...), ensures the key is sent on `apikey`
 * and never polluted by interactive user sessions.
 */
function buildStatelessClientOptions(apiKey, extraHeaders = {}) {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: apiKey,
        ...extraHeaders,
      },
    },
  };
}

/**
 * Returns the singleton privileged Admin / Backend Supabase client.
 * Dynamically initializes or refreshes if environment variables change.
 * Never call stateful auth methods (signInWithPassword, signUp, refreshSession) on this client;
 * use createAuthClient() for end-user authentication flows so the admin client's Authorization
 * context is never overwritten with a user's expiring JWT.
 */
function getAdminClient() {
  if (!checkConfigured()) {
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSecretKey();
  if (!url || !key) {
    return null;
  }

  if (cachedAdminClient && cachedAdminUrl === url && cachedAdminKey === key) {
    return cachedAdminClient;
  }

  try {
    cachedAdminClient = createClient(url, key, buildStatelessClientOptions(key));
    cachedAdminUrl = url;
    cachedAdminKey = key;
    const keyType = getKeyType(key);
    console.log(`[Supabase Client] Successfully initialized connection to Supabase (${keyType} key mode).`);
    return cachedAdminClient;
  } catch (err) {
    console.warn('[Supabase Client Initialization Warning]:', err.message);
    cachedAdminClient = null;
    return null;
  }
}

// Initialize at startup if env vars are already present
const initialClient = getAdminClient();
if (!initialClient && process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test') {
  console.log('[Supabase Client] Running in unconfigured/placeholder mode. Environment variables needed for live DB operations.');
}

/**
 * Creates a fresh, disposable per-request Supabase client for Supabase Auth operations
 * (signUp, signInWithPassword, refreshSession, getUser).
 * Uses the Publishable Key (or falls back to Secret Key) so user sessions never mutate
 * the shared singleton admin client.
 */
function createAuthClient() {
  if (!checkConfigured()) {
    return null;
  }
  const url = getSupabaseUrl();
  const authKey = getPublishableKey() || getSecretKey();
  if (!url || !authKey) {
    return null;
  }
  try {
    return createClient(url, authKey, buildStatelessClientOptions(authKey));
  } catch (err) {
    console.warn('[Supabase Auth Client Warning]:', err.message);
    return getAdminClient();
  }
}

/**
 * Creates a per-request Supabase client scoped to an authenticated user's JWT.
 * Uses the publishable key + `Authorization: Bearer <user_jwt>` so `auth.uid()`
 * resolves in RLS policies.
 *
 * IMPORTANT: If `accessToken` is missing or is NOT a valid 3-part user JWT
 * (for example, `'dev-fallback-token'`, a teacher passcode, or an `sb_secret_...` key),
 * it safely returns the privileged admin client instead of sending a non-JWT in
 * `Authorization: Bearer ...` (which PostgREST rejects with PGRST301 Invalid JWT).
 */
function createUserClient(accessToken) {
  const adminClient = getAdminClient();
  if (!checkConfigured()) {
    return null;
  }

  // Only attach Authorization: Bearer <token> when accessToken is a genuine Supabase user JWT
  if (!isValidUserJwt(accessToken)) {
    return adminClient;
  }

  const url = getSupabaseUrl();
  const pubKey = getPublishableKey() || getSecretKey();
  if (!url || !pubKey) {
    return adminClient;
  }

  try {
    return createClient(
      url,
      pubKey,
      buildStatelessClientOptions(pubKey, {
        Authorization: `Bearer ${accessToken.trim()}`,
      })
    );
  } catch (err) {
    console.warn('[Supabase User Client Warning]:', err.message);
    return adminClient;
  }
}

/**
 * Ensures a teacher record exists in `public.teachers` for a valid Supabase Auth user.
 * Uses the privileged admin client (with fallback to the provided client) so foreign key
 * references to `teachers(id)` on `exam_sessions` and `students` never fail.
 */
async function ensureTeacherProfile(user, fallbackClient = null) {
  if (!user || !isValidUuid(user.id)) return false;
  const adminClient = getAdminClient() || fallbackClient;
  if (!adminClient) return false;

  const email = user.email || `${user.id}@teacher.local`;
  const fullName =
    user.user_metadata?.full_name ||
    user.fullName ||
    user.full_name ||
    (email.includes('@') ? email.split('@')[0] : 'Instructor');

  try {
    const { error } = await adminClient.from('teachers').upsert(
      {
        id: user.id,
        email,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error && fallbackClient && fallbackClient !== adminClient) {
      await fallbackClient.from('teachers').upsert(
        {
          id: user.id,
          email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }
    return !error;
  } catch (err) {
    console.warn('[Ensure Teacher Profile Warning]:', err.message);
    return false;
  }
}

async function uploadDiagramToStorage(pngBuffer, fileName) {
  const base64Url = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const adminClient = getAdminClient();

  if (!checkConfigured() || !adminClient) {
    return base64Url;
  }

  try {
    const filePath = `crops/${fileName}`;
    const { error: uploadError } = await adminClient.storage
      .from('diagram-media')
      .upload(filePath, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.warn('[Supabase Storage Upload Warning]:', uploadError.message);
      return base64Url;
    }

    const { data: publicUrlData } = adminClient.storage
      .from('diagram-media')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || base64Url;
  } catch (err) {
    console.warn('[Supabase Storage Exception]:', err.message);
    return base64Url;
  }
}

// Dynamic Proxy so `supabase.from(...)`, `supabase.auth...`, and `supabase.storage...`
// always route to the active admin client even if env vars were loaded after require().
const supabaseProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getAdminClient();
      if (!client) return undefined;
      const val = client[prop];
      return typeof val === 'function' ? val.bind(client) : val;
    },
  }
);

module.exports = {
  get supabase() {
    return getAdminClient() || (checkConfigured() ? supabaseProxy : null);
  },
  getAdminClient,
  createAuthClient,
  createUserClient,
  ensureTeacherProfile,
  uploadDiagramToStorage,
  isConfigured: () => Boolean(getAdminClient()),
  getSupabaseUrl,
  getPublishableKey,
  getSecretKey,
  hasPrivilegedSecretKey,
  getKeyType,
  isValidUserJwt,
  isValidUuid,
  checkConfigured,
  // Legacy backward-compatibility exports
  getAnonKey,
  getValidKey,
};
