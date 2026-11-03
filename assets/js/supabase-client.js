// ============================================================================
// SubMed v2 — Client Supabase (singleton)
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './runtime-config.js';

export const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,   // necesar pentru OAuth redirect
    },
  }
);
