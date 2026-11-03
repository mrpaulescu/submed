// ============================================================================
// SubMed v2 - Runtime configuration
// ============================================================================
// Uses the committed public config by default. A hosting page may set
// globalThis.SUBMED_CONFIG before app modules load to override public values.
// ============================================================================

import { CONFIG as PUBLIC_CONFIG } from '../../config.public.js';

const runtimeOverrides = globalThis.SUBMED_CONFIG || {};

export const CONFIG = {
  ...PUBLIC_CONFIG,
  ...runtimeOverrides,
  ROUTES: {
    ...(PUBLIC_CONFIG.ROUTES || {}),
    ...(runtimeOverrides.ROUTES || {}),
  },
};
