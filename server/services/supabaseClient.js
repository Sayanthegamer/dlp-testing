const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';

// Retrieve the anon key (used for user-scoped clients where RLS applies)
function getAnonKey() {
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (anonKey && !anonKey.includes('your_supabase') && !anonKey.includes('your-supabase')) {
    return anonKey;
  }
  return '';
}

// Retrieve the best available key for the global admin client (prefers service role)
function getValidKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (serviceKey && !serviceKey.includes('your_supabase') && !serviceKey.includes('your-supabase')) {
    return serviceKey;
  }
  return getAnonKey();
}

const supabaseServiceRoleKey = getValidKey();
const supabaseAnonKey = getAnonKey();

function checkConfigured() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return false;
  }
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-supabase-project') &&
    supabaseServiceRoleKey
  );
}

let supabase = null;

if (checkConfigured()) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[Supabase Client] Successfully initialized connection to Supabase.');
  } catch (err) {
    console.warn('[Supabase Client Initialization Warning]:', err.message);
    supabase = null;
  }
} else {
  console.log('[Supabase Client] Running in unconfigured/placeholder mode. Environment variables needed for live DB operations.');
}

/**
 * Creates a per-request Supabase client scoped to the authenticated user's JWT.
 * This client uses the anon key + the user's access token, so auth.uid()
 * resolves correctly in RLS policies.
 *
 * Falls back to the global admin client if inputs are missing.
 */
function createUserClient(accessToken) {
  if (!checkConfigured() || !accessToken || !supabaseAnonKey) {
    return supabase;
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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
};


