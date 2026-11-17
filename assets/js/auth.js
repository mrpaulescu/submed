// ============================================================================
// SubMed — Lazy authentication facade
// The login/register UI must not wait for a third-party CDN before it boots.
// The real Supabase client is imported only when an auth/data method is used.
// A failed CDN load is reported to the user; reloading the page starts a fresh CDN fallback sequence.
// ============================================================================
import { createAuth } from './auth-core.js?v=auth-core-lazy-20261117';
import { CONFIG } from './runtime-config.js?v=auth-config-lazy-20261117';

export {
  buildAuthRedirectTo,
  getOAuthErrorMessage,
  getPostLoginRoute,
  hasAuthCallbackParams,
} from './auth-core.js?v=auth-core-lazy-20261117';

let supabaseClientPromise = null;

function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('./supabase-client.js?v=supabase-umd-fallback-20261117')
      .then(module => {
        if (!module?.supabase?.auth) {
          throw new Error('SDK-ul Supabase nu a furnizat un client valid.');
        }
        return module.supabase;
      })
      .catch(error => {
        const detail = error?.message || 'biblioteca Supabase nu s-a putut încărca';
        throw new Error('Supabase nu este disponibil momentan. Verifică conexiunea, reîncarcă pagina și încearcă din nou. ' + detail);
      });
  }
  return supabaseClientPromise;
}

// Awaitable PostgREST query builder. The chain is recorded synchronously and
// executed only once the Supabase client is ready.
class LazyQuery {
  constructor(table) {
    this.table = table;
    this.steps = [];
  }
  select(...args) { this.steps.push(['select', args]); return this; }
  eq(...args) { this.steps.push(['eq', args]); return this; }
  order(...args) { this.steps.push(['order', args]); return this; }
  limit(...args) { this.steps.push(['limit', args]); return this; }
  single(...args) { this.steps.push(['single', args]); return this; }
  maybeSingle(...args) { this.steps.push(['maybeSingle', args]); return this; }
  then(resolve, reject) {
    return getSupabaseClient().then(client => {
      return this.steps.reduce(
        (query, [method, args]) => query[method](...args),
        client.from(this.table)
      );
    }).then(resolve, reject);
  }
  catch(reject) { return this.then(undefined, reject); }
  finally(callback) { return this.then(value => Promise.resolve(callback?.()).then(() => value), error => Promise.resolve(callback?.()).then(() => { throw error; })); }
}

const AUTH_METHODS = [
  'signUp',
  'signInWithPassword',
  'signInWithOAuth',
  'resetPasswordForEmail',
  'updateUser',
  'signOut',
  'getSession',
  'getUser',
];

const authProxy = Object.fromEntries(AUTH_METHODS.map(method => [
  method,
  (...args) => getSupabaseClient().then(client => client.auth[method](...args)),
]));

authProxy.onAuthStateChange = callback => {
  let active = true;
  let innerSubscription = null;

  getSupabaseClient().then(client => {
    if (!active) return;
    const result = client.auth.onAuthStateChange(callback);
    innerSubscription = result?.data?.subscription || result?.subscription || null;
  }).catch(error => {
    // Auth callback registration is best-effort here. The awaited getSession()
    // call reports the actual SDK/network error to its caller.
    console.warn('[SubMed Auth] Nu am putut conecta listenerul de sesiune:', error);
  });

  return {
    data: {
      subscription: {
        unsubscribe() {
          active = false;
          try { innerSubscription?.unsubscribe?.(); } catch (_) {}
        },
      },
    },
  };
};

const supabaseProxy = {
  auth: authProxy,
  from(table) { return new LazyQuery(table); },
};

function normalizeAppRedirect(href) {
  try {
    const url = new URL(href, globalThis.location?.href || 'http://localhost/');
    const aliases = new Map([
      ['/login', '/login.html'],
      ['/dashboard', '/dashboard.html'],
      ['/grile', '/grile.html'],
      ['/scan', '/scan.html'],
      ['/student_card', '/student_card.html'],
    ]);
    const normalizedPath = aliases.get(url.pathname);
    if (normalizedPath) url.pathname = normalizedPath;
    return url.href;
  } catch (_) {
    return href;
  }
}

const authMethods = createAuth({
  supabase: supabaseProxy,
  config: CONFIG,
  setLocation: href => {
    const normalized = normalizeAppRedirect(href);
    try {
      const url = new URL(normalized, globalThis.location?.href || 'http://localhost/');
      if (url.origin === globalThis.location?.origin) {
        const route = `${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`;
        globalThis.location.href = route;
        return;
      }
    } catch (_) {
      // Fall through to assigning the normalized URL.
    }
    globalThis.location.href = normalized;
  },
});

export const Auth = {
  ...authMethods,
  onAuthStateChange(callback) {
    return authProxy.onAuthStateChange(callback);
  },
};
