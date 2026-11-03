// ============================================================================
// SubMed v2 - Public browser configuration
// ============================================================================
// This file is intentionally committed so a fresh clone can run the app.
// Supabase anon/publishable keys are public in browser apps; safety depends on
// Row Level Security policies. Never put service_role keys or admin secrets here.
// ============================================================================

export const CONFIG = {
  SUPABASE_URL: 'https://nicjhiqkdimipakeaanm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pY2poaXFrZGltaXBha2VhYW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQ3MTMsImV4cCI6MjA5NzIwMDcxM30.-FYqfDVhZC2YpwNXcSnPO7xCi2OJUWtb6qGPCbXWaac',

  RENDER_API: 'https://submed-omr.onrender.com',

  ROUTES: {
    afterLogin: 'dashboard.html',
    afterLogout: 'login.html',
    login: 'login.html',
  },
};
