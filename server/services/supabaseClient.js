const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-supabase-project') &&
  supabaseServiceRoleKey &&
  !supabaseServiceRoleKey.includes('your_supabase')
);

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

module.exports = {
  supabase,
  isConfigured: () => Boolean(supabase),
};
