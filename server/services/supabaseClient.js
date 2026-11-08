const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';

/**
 * Helper to check whether a key string is non-empty and not a dummy/placeholder.
 */
function isValidKeyString(val) {
  if (!val || typeof val !== 'string') return false;
  const lower = val.toLowerCase().trim();
  if (!lower) return false;
  if (
    lower.includes('your_supabase') ||
    lower.includes('your-supabase') ||
    lower.includes('your_secret') ||
    lower.includes('your_publishable') ||
    lower.includes('your_anon') ||
    lower.includes('your_service_role')
  ) {
    return false;
  }
  return true;
}

/**
 * Classifies the type of Supabase key:
 * - 'publishable' (modern sb_publishable_... or sbp_...)
 * - 'secret' (modern sb_secret_... or sbs_...)
 * - 'legacy_jwt' (legacy anon / service_role JWT starting with eyJ...)
 * - 'unknown'
 */
function getKeyType(key) {
  if (!key || typeof key !== 'string') return 'unknown';
  const trimmed = key.trim();
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
 * Resolves the Publishable Key (used for client/browser RLS scoped requests).
 * Safe to expose publicly in client browsers.
 *
 * Priority:
 * 1. SUPABASE_PUBLISHABLE_KEY (modern standard)
 * 2. VITE_SUPABASE_PUBLISHABLE_KEY (modern frontend standard)
 * 3. SUPABASE_ANON_KEY (legacy JWT format)
 */
function getPublishableKey() {
  const modernKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (isValidKeyString(modernKey)) return modernKey.trim();

  const viteKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (isValidKeyString(viteKey)) return viteKey.trim();

  const legacyKey = process.env.SUPABASE_ANON_KEY;
  if (isValidKeyString(legacyKey)) return legacyKey.trim();

  return '';
}

/**
 * Resolves the Secret Key (used for privileged server-side operations, bypasses RLS).
 * Must remain confidential on the server.
 *
 * Priority:
 * 1. SUPABASE_SECRET_KEY (modern standard)
 * 2. SUPABASE_SERVICE_ROLE_KEY (legacy JWT format)
 * 3. Falls back to Publishable Key if no secret key is provided (restricted client mode)
 */
function getSecretKey() {
  const modernSecret = process.env.SUPABASE_SECRET_KEY;
  if (isValidKeyString(modernSecret)) return modernSecret.trim();

  const legacyService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isValidKeyString(legacyService)) return legacyService.trim();

  return getPublishableKey();
}

// Backward-compatibility aliases
const getAnonKey = getPublishableKey;
const getValidKey = getSecretKey;

const supabasePublishableKey = getPublishableKey();
const supabaseSecretKey = getSecretKey();
const supabaseServiceRoleKey = supabaseSecretKey;
const supabaseAnonKey = supabasePublishableKey;

function checkConfigured() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return false;
  }
  const url = process.env.SUPABASE_URL || supabaseUrl;
  const secretKey = getSecretKey();
  return Boolean(
    url &&
    url.startsWith('http') &&
    !url.includes('your-supabase-project') &&
    secretKey
  );
}

let supabase = null;

if (checkConfigured()) {
  try {
    supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const keyType = getKeyType(supabaseSecretKey);
    console.log(`[Supabase Client] Successfully initialized connection to Supabase (${keyType} key mode).`);
  } catch (err) {
    console.warn('[Supabase Client Initialization Warning]:', err.message);
    supabase = null;
  }
} else {
  console.log('[Supabase Client] Running in unconfigured/placeholder mode. Environment variables needed for live DB operations.');
}

/**
 * Creates a per-request Supabase client scoped to the authenticated user's JWT.
 * This client uses the publishable key + the user's access token, so auth.uid()
 * resolves correctly in RLS policies.
 *
 * Falls back to the global admin client if inputs are missing.
 */
function createUserClient(accessToken) {
  const pubKey = getPublishableKey() || supabasePublishableKey;
  if (!checkConfigured() || !accessToken || !pubKey) {
    return supabase;
  }

  try {
    const userClient = createClient(supabaseUrl, pubKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
    return userClient;
  } catch (err) {
    console.warn('[Supabase User Client Warning]:', err.message);
    return supabase;
  }
}

async function uploadDiagramToStorage(pngBuffer, fileName) {
  const base64Url = `data:image/png;base64,${pngBuffer.toString('base64')}`;

  if (!checkConfigured() || !supabase) {
    return base64Url;
  }

  try {
    const filePath = `crops/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('diagram-media')
      .upload(filePath, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.warn('[Supabase Storage Upload Warning]:', uploadError.message);
      return base64Url;
    }

    const { data: publicUrlData } = supabase.storage
      .from('diagram-media')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || base64Url;
  } catch (err) {
    console.warn('[Supabase Storage Exception]:', err.message);
    return base64Url;
  }
}

module.exports = {
  supabase,
  isConfigured: () => Boolean(supabase),
  createUserClient,
  uploadDiagramToStorage,
  getPublishableKey,
  getSecretKey,
  getKeyType,
  checkConfigured,
  // Legacy backward-compatibility exports
  getAnonKey,
  getValidKey,
};
