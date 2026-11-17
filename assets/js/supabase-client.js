// ============================================================================
// SubMed v2 — Supabase singleton
// Load the official UMD build lazily so a CDN/ESM graph cannot block page boot.
// Supabase documents jsDelivr and unpkg as browser CDN installation options.
// ============================================================================
import { CONFIG } from './runtime-config.js';

const SDK_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@supabase/supabase-js@2',
];

function loadSdkScript(src, timeoutMs = 6000) {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Supabase SDK poate fi încărcat doar în browser.'));
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;

    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
        return;
      }
      const sdk = globalThis.supabase;
      if (sdk?.createClient) resolve(sdk);
      else reject(new Error('CDN-ul a răspuns, dar SDK-ul Supabase nu a fost inițializat.'));
    };

    const timer = setTimeout(
      () => finish(new Error('Timeout la încărcarea SDK-ului Supabase.')),
      timeoutMs
    );

    script.async = true;
    script.src = src;
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Nu am putut descărca SDK-ul Supabase de la ' + new URL(src).hostname + '.'));
    document.head.appendChild(script);
  });
}

async function loadSupabaseSdk() {
  const failures = [];
  for (const source of SDK_SOURCES) {
    try {
      return await loadSdkScript(source);
    } catch (error) {
      failures.push(error?.message || String(error));
    }
  }

  // Last fallback: Supabase also documents the browser ESM build on jsDelivr.
  try {
    const esmAttempt = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout la încărcarea fallback-ului ESM Supabase.')), 7000);
    });
    const module = await Promise.race([esmAttempt, timeout]);
    if (typeof module?.createClient === 'function') return module;
    failures.push('Fallback-ul ESM nu a exportat createClient.');
  } catch (error) {
    failures.push(error?.message || String(error));
  }

  throw new Error(
    'Nu am putut încărca biblioteca de autentificare Supabase. Verifică conexiunea și încearcă din nou. ' +
    failures.join(' ')
  );
}

const sdk = await loadSupabaseSdk();

if (!CONFIG?.SUPABASE_URL || !CONFIG?.SUPABASE_ANON_KEY) {
  throw new Error('Configurația publică Supabase lipsește sau este incompletă.');
}

export const supabase = sdk.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
