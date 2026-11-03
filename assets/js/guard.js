// ============================================================================
// SubMed — guard de acces (paywall) pentru paginile care NU folosesc
// components.js (instrumente standalone). Redirecționează la login dacă nu
// ești autentificat. Dacă backendul nu e disponibil, nu redirecționează.
// Folosire:  <script type="module" src="assets/js/guard.js"></script>
// ============================================================================
import { Auth } from './auth.js';
Auth.requireLogin().catch(() => { /* backend indisponibil → preview */ });
