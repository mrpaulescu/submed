import { Auth } from './auth.js?v=supabase-singleton-20261028';

const gatedLinks = document.querySelectorAll('[data-auth-gate="wizard.html"]');

gatedLinks.forEach(link => {
  link.addEventListener('click', async event => {
    event.preventDefault();
    if (link.dataset.authChecking === 'true') return;

    link.dataset.authChecking = 'true';
    link.setAttribute('aria-busy', 'true');

    try {
      const session = await Auth.getSession();
      if (session) {
        window.location.assign('wizard.html');
      } else {
        window.location.assign('login.html?next=wizard.html');
      }
    } catch (error) {
      console.error('Nu am putut verifica sesiunea înainte de deschiderea wizardului:', error);
      // Fallback sigur: autentificarea se face înainte de revenirea în wizard.
      window.location.assign('login.html?next=wizard.html');
    }
  });
});
