import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config.js';
import { signIn, signOutUser, friendlyError } from './auth.js';
import { render as renderAuthors }  from './authors.js';
import { render as renderPapers }   from './papers.js';
import { render as renderSessions } from './sessions.js';
import { render as renderSettings } from './settings.js';
import { initDetail } from './detail.js';

initDetail();

const $ = id => document.getElementById(id);

const sections = {
  authors:  renderAuthors,
  papers:   renderPapers,
  sessions: renderSessions,
  settings: renderSettings,
};

// ── Auth state ────────────────────────────────────────────────

let navReady = false;

onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').hidden = true;
    $('app').hidden = false;
    $('user-email').textContent = user.email;

    if (!navReady) {
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          item.classList.add('active');
          sections[item.dataset.section]();
        });
      });
      navReady = true;
    }

    renderAuthors();
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
  errEl.textContent   = '';
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
