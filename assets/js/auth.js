// ============================================================================
// SubMed v2 - Autentificare (Supabase Auth)
// ============================================================================
// Folosire: import { Auth } from './assets/js/auth.js';
// ============================================================================
import { createAuth } from './auth-core.js?v=auth-recovery-086b40d-20260929a';
import { CONFIG } from './runtime-config.js?v=auth-recovery-086b40d-20260929a';

export { buildAuthRedirectTo, getOAuthErrorMessage, getPostLoginRoute, hasAuthCallbackParams } from './auth-core.js?v=auth-recovery-086b40d-20260929a';

function unavailableSupabase(error) {
  const unavailable = async () => {
    throw new Error(`Supabase indisponibil: ${error?.message || 'clientul nu s-a putut incarca'}`);
  };
  return {
    auth: {
      signUp: unavailable,
      signInWithPassword: unavailable,
      signInWithOAuth: unavailable,
      resetPasswordForEmail: unavailable,
      updateUser: unavailable,
      async signOut() { return { error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
      async getUser() { return { data: { user: null }, error: null }; },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle: unavailable,
        single: unavailable,
      };
    },
  };
}

async function loadSupabaseClient() {
  const timeout = new Promise(resolve => {
    setTimeout(() => resolve(unavailableSupabase(new Error('timeout la incarcarea Supabase'))), 2500);
  });
  const client = import('./supabase-client.js')
    .then(module => module.supabase)
    .catch(error => unavailableSupabase(error));
  return Promise.race([client, timeout]);
}

const HTML_PATH_ALIASES = new Map([
  ['/login', '/login.html'],
  ['/dashboard', '/dashboard.html'],
  ['/grile', '/grile.html'],
  ['/scan', '/scan.html'],
  ['/student_card', '/student_card.html'],
]);

function normalizeAppRedirect(href) {
  try {
    const url = new URL(href, globalThis.location?.href || 'http://localhost/');
    const normalizedPath = HTML_PATH_ALIASES.get(url.pathname);
    if (normalizedPath) {
      url.pathname = normalizedPath;
    }
    return url.href;
  } catch (error) {
    return href;
  }
}

export const Auth = createAuth({
  supabase: await loadSupabaseClient(),
  config: CONFIG,
  setLocation: href => {
    const normalized = normalizeAppRedirect(href);
    try {
      const url = new URL(normalized, globalThis.location?.href || 'http://localhost/');
      if (url.origin === globalThis.location?.origin) {
        const route = `${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`;
        const opened = globalThis.open?.(route, '_self');
        if (opened) return;
        globalThis.location.href = route;
        return;
      }
    } catch (error) {
      // Fall through to assigning the normalized URL.
    }
    globalThis.location.href = normalized;
  },
});
