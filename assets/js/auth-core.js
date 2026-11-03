// ============================================================================
// SubMed auth core.
// Pure-ish wrapper around Supabase Auth, with injectable dependencies for tests.
// ============================================================================

const AUTH_CALLBACK_KEYS = [
  'access_token',
  'code',
  'error',
  'error_code',
  'error_description',
  'refresh_token',
  'token_type',
  'type',
];

const LOCAL_ADMIN_STORAGE_KEY = 'submed.localAdminSession';
const LOCAL_ADMIN_ROUTE_STORAGE_KEY = 'submed.localAdminRoute';
const OAUTH_NEXT_ROUTE_STORAGE_KEY = 'submed.oauthNextRoute';
const LOCAL_ADMIN_CREDENTIALS = Object.freeze({
  username: 'Paul',
  supabaseEmail: 'paulgrosu64@gmail.com',
});

const HTML_ROUTE_ALIASES = new Map([
  ['login', 'login.html'],
  ['dashboard', 'dashboard.html'],
  ['grile', 'grile.html'],
  ['scan', 'scan.html'],
  ['student_card', 'student_card.html'],
]);

function currentLocation(locationRef = globalThis.location) {
  if (!locationRef) return new URL('http://localhost/');
  if (typeof locationRef.href === 'string') return new URL(locationRef.href);
  return new URL(String(locationRef));
}

function authUrlParams(locationRef = globalThis.location) {
  const url = currentLocation(locationRef);
  const hash = url.hash ? url.hash.replace(/^#\/?/, '') : '';
  return {
    url,
    search: url.searchParams,
    hash: new URLSearchParams(hash),
  };
}

function firstParam(params, keys) {
  for (const key of keys) {
    const value = params.search.get(key) || params.hash.get(key);
    if (value) return value;
  }
  return null;
}

function safeAuthMessage(value) {
  const text = String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!text) return '';
  if (/access_token|refresh_token|id_token|authorization|bearer/i.test(text)) return '';
  return text.slice(0, 180);
}

function routeFromLocation(locationRef = globalThis.location) {
  const url = currentLocation(locationRef);
  const file = url.pathname.split('/').filter(Boolean).pop() || '';
  return `${file || 'index.html'}${url.search || ''}${url.hash || ''}`;
}

function safeNextRoute(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith('//')) return null;
  if (text.includes('\\') || text.includes('\n') || text.includes('\r')) return null;
  const normalized = text.replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('../') || normalized.includes('/../')) return null;
  const match = normalized.match(/^([^?#]*)(.*)$/);
  const path = match?.[1] || '';
  const suffix = match?.[2] || '';
  return `${HTML_ROUTE_ALIASES.get(path) || path}${suffix}`;
}

function routeBase(route) {
  return (safeNextRoute(route) || '').split(/[?#]/, 1)[0];
}

function loginUrlWithNext(loginRoute, nextRoute, locationRef = globalThis.location) {
  const loginUrl = new URL(loginRoute || 'login.html', `${currentLocation(locationRef).origin}/`);
  const next = safeNextRoute(nextRoute);
  if (next && routeBase(next) !== routeBase(loginRoute || 'login.html')) {
    loginUrl.searchParams.set('next', next);
  }
  return loginUrl.href;
}

function isLocalOrigin(locationRef = globalThis.location) {
  const hostname = currentLocation(locationRef).hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function isLocalAdminAlias(username) {
  return username === LOCAL_ADMIN_CREDENTIALS.username;
}

function localAdminSession() {
  const user = {
    id: 'local-admin-paul',
    email: 'paul@local.submed',
    user_metadata: { full_name: 'Paul' },
  };
  return {
    access_token: 'local-admin-session',
    token_type: 'bearer',
    user,
    local_admin: true,
  };
}

function localAdminProfile(session) {
  if (!session?.local_admin) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: 'Paul',
    avatar_url: null,
    role: 'admin',
    student_code: null,
    local_admin: true,
  };
}

export function hasAuthCallbackParams(locationRef = globalThis.location) {
  const params = authUrlParams(locationRef);
  return AUTH_CALLBACK_KEYS.some(key => params.search.has(key) || params.hash.has(key));
}

export function getOAuthErrorMessage(locationRef = globalThis.location) {
  const params = authUrlParams(locationRef);
  const error = safeAuthMessage(firstParam(params, ['error_description', 'error']));
  if (!error) return null;
  return `Autentificarea cu Google a esuat.${error ? ` ${error}` : ''}`;
}

export function cleanAuthCallbackUrl(locationRef = globalThis.location, historyRef = globalThis.history) {
  if (!historyRef?.replaceState || !hasAuthCallbackParams(locationRef)) return;
  const params = authUrlParams(locationRef);
  for (const key of AUTH_CALLBACK_KEYS) params.url.searchParams.delete(key);
  params.url.hash = '';
  historyRef.replaceState({}, globalThis.document?.title || '', params.url.pathname + params.url.search);
}

export function buildAuthRedirectTo(path, locationRef = globalThis.location) {
  const url = currentLocation(locationRef);
  const target = safeNextRoute(path) || 'dashboard.html';
  return new URL(target, `${url.origin}/`).href;
}

export function getPostLoginRoute(config, locationRef = globalThis.location) {
  const params = authUrlParams(locationRef);
  return safeNextRoute(params.search.get('next')) || config?.ROUTES?.afterLogin || 'dashboard.html';
}

function subscriptionFrom(data) {
  return data?.subscription || data?.data?.subscription || data;
}

export function createAuth({
  supabase,
  config,
  locationRef = globalThis.location,
  historyRef = globalThis.history,
  fetchRef = globalThis.fetch,
  storageRef = globalThis.localStorage,
  setLocation = href => { globalThis.location.href = href; },
} = {}) {
  if (!supabase?.auth) throw new Error('Supabase auth client is missing.');
  if (!config?.ROUTES) throw new Error('Auth routes config is missing.');

  function readLocalAdminSession() {
    clearLocalAdminSession();
    return null;
  }

  function writeLocalAdminSession(session) {
    if (!storageRef?.setItem) return;
    storageRef.setItem(LOCAL_ADMIN_STORAGE_KEY, JSON.stringify(session));
  }

  function readLocalAdminRoute() {
    if (!isLocalOrigin(locationRef) || !storageRef?.getItem) return false;
    return storageRef.getItem(LOCAL_ADMIN_ROUTE_STORAGE_KEY) === '1';
  }

  function writeLocalAdminRoute() {
    if (!isLocalOrigin(locationRef) || !storageRef?.setItem) return;
    storageRef.setItem(LOCAL_ADMIN_ROUTE_STORAGE_KEY, '1');
  }

  function clearLocalAdminRoute() {
    try { storageRef?.removeItem?.(LOCAL_ADMIN_ROUTE_STORAGE_KEY); } catch (error) { /* ignore storage cleanup */ }
  }

  function clearLocalAdminSession() {
    try { storageRef?.removeItem?.(LOCAL_ADMIN_STORAGE_KEY); } catch (error) { /* ignore storage cleanup */ }
  }

  function writeOAuthNextRoute(route) {
    if (!storageRef?.setItem) return;
    const next = safeNextRoute(route);
    if (!next || routeBase(next) === routeBase(config.ROUTES.login)) {
      try { storageRef.removeItem?.(OAUTH_NEXT_ROUTE_STORAGE_KEY); } catch (error) { /* ignore storage cleanup */ }
      return;
    }
    storageRef.setItem(OAUTH_NEXT_ROUTE_STORAGE_KEY, next);
  }

  function consumeOAuthNextRoute() {
    if (!storageRef?.getItem) return null;
    const stored = storageRef.getItem(OAUTH_NEXT_ROUTE_STORAGE_KEY);
    try { storageRef.removeItem?.(OAUTH_NEXT_ROUTE_STORAGE_KEY); } catch (error) { /* ignore storage cleanup */ }
    return safeNextRoute(stored);
  }

  async function getRawSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || readLocalAdminSession();
  }

  async function getSupabaseSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function waitForCallbackSession({ timeoutMs = 3500 } = {}) {
    const immediate = await getRawSession();
    if (immediate || !hasAuthCallbackParams(locationRef) || getOAuthErrorMessage(locationRef)) return immediate;

    return new Promise(resolve => {
      let settled = false;
      let subscription = null;
      const finish = async (session = null) => {
        if (settled) return;
        settled = true;
        try { subscription?.unsubscribe?.(); } catch (e) { /* ignore cleanup */ }
        resolve(session || await getRawSession().catch(() => null));
      };

      try {
        subscription = subscriptionFrom(supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
            finish(session);
          }
        }));
      } catch (e) {
        finish(null);
        return;
      }

      getRawSession().then(session => {
        if (session) finish(session);
      }).catch(() => {});
      setTimeout(() => finish(null), timeoutMs);
    });
  }

  async function assertAuthEndpointReachable() {
    if (!fetchRef || !config.SUPABASE_URL) return;
    const hasAnonKey = Boolean(config.SUPABASE_ANON_KEY);
    let healthUrl;
    try {
      healthUrl = new URL(hasAnonKey ? '/auth/v1/settings' : '/auth/v1/health', config.SUPABASE_URL).href;
    } catch (error) {
      throw new Error('Supabase auth endpoint invalid. Verifica SUPABASE_URL.');
    }
    try {
      const response = await fetchRef(healthUrl, {
        method: 'GET',
        ...(hasAnonKey ? { headers: { apikey: config.SUPABASE_ANON_KEY } } : { mode: 'no-cors' }),
        cache: 'no-store',
      });
      if (hasAnonKey && response?.ok === false) throw new Error(`HTTP ${response.status || 'error'}`);
    } catch (error) {
      throw new Error('Supabase auth endpoint unreachable. Verifica SUPABASE_URL si conexiunea la proiectul Supabase.');
    }
  }

  return {
    async register(name, email, password) {
      await assertAuthEndpointReachable();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: buildAuthRedirectTo('login.html?confirmed=1', locationRef),
        },
      });
      if (error) throw error;
      return data;
    },

    async login(email, password) {
      if (isLocalOrigin(locationRef) && isLocalAdminAlias(email)) {
        await assertAuthEndpointReachable();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: LOCAL_ADMIN_CREDENTIALS.supabaseEmail,
          password,
        });
        if (error) throw error;
        clearLocalAdminSession();
        writeLocalAdminRoute();
        return data;
      }
      await assertAuthEndpointReachable();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      clearLocalAdminRoute();
      return data;
    },

    async loginWithGoogle() {
      const requestedRoute = getPostLoginRoute(config, locationRef);
      const redirectTo = buildAuthRedirectTo(config.ROUTES.login, locationRef);
      writeOAuthNextRoute(requestedRoute);
      await assertAuthEndpointReachable();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) {
        consumeOAuthNextRoute();
        throw error;
      }
      if (data?.url) setLocation(data.url);
      return data;
    },

    async resetPassword(email) {
      const redirectTo = buildAuthRedirectTo('reset-password.html', locationRef);
      await assertAuthEndpointReachable();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },

    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    async logout() {
      const localSession = readLocalAdminSession();
      clearLocalAdminSession();
      clearLocalAdminRoute();
      if (localSession) await supabase.auth.signOut().catch(() => {});
      else await supabase.auth.signOut();
      setLocation(buildAuthRedirectTo(config.ROUTES.afterLogout, locationRef));
    },

    async getSession() {
      return waitForCallbackSession();
    },

    async redirectIfLoggedIn() {
      const session = await this.getSession();
      if (session) {
        setLocation(this.getPostLoginRedirect());
        return true;
      }
      return false;
    },

    async getUser() {
      const session = await this.getSession();
      const localProfile = localAdminProfile(session);
      if (localProfile) return localProfile;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      return {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.full_name || 'Student',
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
        role: profile?.role || 'student',
        student_code: profile?.student_code || null,
      };
    },

    async requireLogin() {
      const session = await this.getSession();
      if (!session) {
        setLocation(loginUrlWithNext(config.ROUTES.login, routeFromLocation(locationRef), locationRef));
        return null;
      }
      return session;
    },

    async requireAdmin() {
      const session = await this.getSession();
      if (!session) {
        setLocation(loginUrlWithNext(config.ROUTES.login, routeFromLocation(locationRef), locationRef));
        return null;
      }
      const user = await this.getUser();
      if (!user || user.role !== 'admin') {
        setLocation(buildAuthRedirectTo(config.ROUTES.afterLogin, locationRef));
        return null;
      }
      return user;
    },

    async requireSupabaseAdmin() {
      const session = await getSupabaseSession();
      if (!session) {
        setLocation(loginUrlWithNext(config.ROUTES.login, routeFromLocation(locationRef), locationRef));
        return null;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLocation(loginUrlWithNext(config.ROUTES.login, routeFromLocation(locationRef), locationRef));
        return null;
      }
      const { data: profile, error } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (error || profile?.role !== 'admin') {
        setLocation(buildAuthRedirectTo(config.ROUTES.afterLogin, locationRef));
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        name: profile.name || user.user_metadata?.full_name || 'Admin',
        avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || null,
        role: profile.role,
        student_code: profile.student_code || null,
      };
    },

    getOAuthErrorMessage() {
      return getOAuthErrorMessage(locationRef);
    },

    cleanAuthCallbackUrl() {
      cleanAuthCallbackUrl(locationRef, historyRef);
    },

    getPostLoginRedirect() {
      const params = authUrlParams(locationRef);
      const requested = safeNextRoute(params.search.get('next'));
      const oauthRequested = hasAuthCallbackParams(locationRef) ? consumeOAuthNextRoute() : null;
      const target = requested || oauthRequested || (readLocalAdminRoute() ? 'admin.html' : config.ROUTES.afterLogin);
      return buildAuthRedirectTo(target, locationRef);
    },
  };
}
