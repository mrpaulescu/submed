// ============================================================================
// SubMed v2 - Public configuration example
// ============================================================================
// Copy this file to config.js for local development or deployment.
// Do not commit config.js with real project values.
// Supabase anon/publishable keys are visible in frontend apps; safety depends on RLS.
// Never put a service_role key or admin secret in frontend code.
// ============================================================================

export const CONFIG = {
  // Supabase - Project Settings > API
  SUPABASE_URL: 'https://PROJECT_REF.supabase.co',
  SUPABASE_ANON_KEY: 'SUPABASE_ANON_OR_PUBLISHABLE_KEY',

  // OCR/OMR microservice
  RENDER_API: 'https://submed-omr.onrender.com',

  // Auth redirects
  ROUTES: {
    afterLogin: 'dashboard.html',
    afterLogout: 'login.html',
    login: 'login.html',
  },
};
