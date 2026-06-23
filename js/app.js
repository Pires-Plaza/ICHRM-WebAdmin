import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config.js';
import { signIn, signOutUser, friendlyError } from './auth.js';
import { initRTDB, setupModalListeners, loadPath as dbLoad } from './rtdb.js';
import { initStorage, loadPath as storageLoad } from './storage.js';

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
      initStorage();
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

// ── Tab switching ─────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    $('panel-database').hidden = tab !== 'database';
    $('panel-storage').hidden  = tab !== 'storage';

    if (tab === 'storage') storageLoad('');
  });
});
