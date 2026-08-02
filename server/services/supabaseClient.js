const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';

function getValidKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (serviceKey && !serviceKey.includes('your_supabase') && !serviceKey.includes('your-supabase')) {
    return serviceKey;
  }
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (anonKey && !anonKey.includes('your_supabase') && !anonKey.includes('your-supabase')) {
    return anonKey;
  }
  return '';
}

const supabaseServiceRoleKey = getValidKey();

function checkConfigured() {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-supabase-project') &&
    supabaseServiceRoleKey
  );
}

const isConfigured = checkConfigured();


let supabase = null;
if (isConfigured) {
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
  }
} else {
  console.log('[Supabase Client] Running in unconfigured/placeholder mode. Environment variables needed for live DB operations.');
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
  supabase: typeof supabase !== 'undefined' ? supabase : null,
  isConfigured: () => Boolean(typeof supabase !== 'undefined' && supabase),
  uploadDiagramToStorage,
};

