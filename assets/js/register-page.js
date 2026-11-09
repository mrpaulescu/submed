import { Auth } from './auth.js?v=supabase-singleton-20261028';

const $ = id => document.getElementById(id);
const banner = $('alertBanner');

function showAlert(msg, type = 'error') {
  if (!banner) return;
  banner.textContent = msg;
  banner.className = `alert-banner show ${type}`;
}
function hideAlert() {
  if (banner) banner.className = 'alert-banner';
}
function setLoading(on) {
  $('submitBtn').disabled = on;
  $('btnText').style.display = on ? 'none' : 'inline';
  $('btnSpinner').style.display = on ? 'block' : 'none';
  $('btnArrow').style.display = on ? 'none' : 'block';
}

Auth.redirectIfLoggedIn().catch(err => {
  console.warn('Verificarea sesiunii existente a esuat:', err);
});

let pwVisible = false;
$('pwToggle').addEventListener('click', () => {
  pwVisible = !pwVisible;
  $('password').type = pwVisible ? 'text' : 'password';
  $('eyeIcon').innerHTML = pwVisible
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
});

$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert();
  const name = $('name').value.trim();
  const email = $('email').value.trim();
  const password = $('password').value;

  if (!name || !email || !password) {
    showAlert('Completează toate câmpurile.');
    return;
  }
  if (password.length < 6) {
    showAlert('Parola trebuie să aibă minim 6 caractere.');
    return;
  }

  setLoading(true);
  try {
    const result = await Auth.register(name, email, password);
    if (result?.session) {
      showAlert('Cont creat! Te redirecționăm către contul tău.', 'success');
      setTimeout(() => location.href = Auth.getPostLoginRedirect(), 700);
    } else {
      showAlert('Cont creat! Verifică-ți emailul pentru confirmare.', 'success');
      setTimeout(() => location.href = 'login.html', 2000);
    }
  } catch (err) {
    showAlert(err.message || 'Nu am putut crea contul.');
  } finally {
    setLoading(false);
  }
});

$('googleBtn').addEventListener('click', async e => {
  e.preventDefault();
  hideAlert();
  try {
    await Auth.loginWithGoogle();
  } catch (err) {
    showAlert('Google Sign-In indisponibil: ' + (err?.message || 'eroare necunoscută'));
  }
});

['name', 'email', 'password'].forEach(id =>
  $(id).addEventListener('input', function () {
    this.classList.remove('input-error');
    hideAlert();
  })
);

document.documentElement.dataset.authPageReady = 'true';
