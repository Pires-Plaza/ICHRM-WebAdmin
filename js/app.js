import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config.js';
import { signIn, signOutUser, friendlyError } from './auth.js';
import { initRTDB, setupModalListeners, loadPath as dbLoad } from './rtdb.js';

const $ = id => document.getElementById(id);

// ── Auth state ────────────────────────────────────────────────

let appReady = false;

onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').hidden = true;
    $('app').hidden = false;
    $('user-email').textContent = user.email;

    if (!appReady) {
      initRTDB();
      setupModalListeners();
      appReady = true;
    }

    dbLoad([]);
  } else {
    $('login-screen').hidden = false;
    $('app').hidden = true;
  }
});

// ── Sign in ───────────────────────────────────────────────────

$('sign-in-btn').addEventListener('click', async () => {
  const email    = $('email').value.trim();
  const password = $('password').value;
  const errEl    = $('auth-error');
  errEl.textContent = '';
  $('sign-in-btn').disabled = true;

  try {
    await signIn(email, password);
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
  } finally {
    $('sign-in-btn').disabled = false;
  }
});

$('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('sign-in-btn').click();
});

// ── Sign out ──────────────────────────────────────────────────

$('sign-out-btn').addEventListener('click', () => signOutUser());

