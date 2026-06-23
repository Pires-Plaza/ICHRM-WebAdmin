import {
  ref as sRef,
  listAll,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase-config.js';

const $ = id => document.getElementById(id);

let currentPath = '';

// ── Public ────────────────────────────────────────────────────

export function initStorage() {
  $('storage-upload-btn').addEventListener('click', () => $('storage-file-input').click());
  $('storage-file-input').addEventListener('change', e => {
    const files = [...e.target.files];
    e.target.value = '';
    files.forEach(uploadFile);
  });
}

export async function loadPath(path) {
  currentPath = path;
  renderBreadcrumb();

  const body = $('storage-content');
  body.innerHTML = '<p class="empty-state">Loading…</p>';

  try {
    const result = await listAll(sRef(storage, path));
    body.innerHTML = '';

    if (!result.prefixes.length && !result.items.length) {
      body.innerHTML = '<p class="empty-state">This folder is empty.</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'file-list';
    result.prefixes.forEach(prefix => list.appendChild(renderFolder(prefix)));
    result.items.forEach(item => list.appendChild(renderFile(item)));
    body.appendChild(list);
  } catch (err) {
    body.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

// ── Breadcrumb ────────────────────────────────────────────────

function renderBreadcrumb() {
  const nav = $('storage-breadcrumb');
  nav.innerHTML = '';

  const root = document.createElement('span');
  root.className = 'bc-item';
  root.textContent = 'root';
  root.addEventListener('click', () => loadPath(''));
  nav.appendChild(root);

  if (!currentPath) return;

  const parts = currentPath.split('/').filter(Boolean);
  parts.forEach((part, i) => {
    const sep = document.createElement('span');
    sep.className = 'bc-sep';
    sep.textContent = '/';
    nav.appendChild(sep);

    if (i === parts.length - 1) {
      const cur = document.createElement('span');
      cur.className = 'bc-current';
      cur.textContent = part;
      nav.appendChild(cur);
    } else {
      const item = document.createElement('span');
      item.className = 'bc-item';
      item.textContent = part;
      const subPath = parts.slice(0, i + 1).join('/');
      item.addEventListener('click', () => loadPath(subPath));
      nav.appendChild(item);
    }
  });
}

// ── Folder row ────────────────────────────────────────────────

function renderFolder(prefixRef) {
  const row = document.createElement('div');
  row.className = 'file-row';

  row.appendChild(icon('📁'));

  const name = document.createElement('span');
  name.className = 'file-name folder-name';
  name.textContent = prefixRef.name;
  name.addEventListener('click', () => loadPath(prefixRef.fullPath));
  row.appendChild(name);

  return row;
}

// ── File row ──────────────────────────────────────────────────

function renderFile(itemRef) {
  const row = document.createElement('div');
  row.className = 'file-row';

  row.appendChild(icon(fileIcon(itemRef.name)));

  const name = document.createElement('span');
  name.className = 'file-name';
  name.textContent = itemRef.name;
  row.appendChild(name);

  const actions = document.createElement('div');
  actions.className = 'file-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-sm';
  copyBtn.textContent = 'Copy URL';
  copyBtn.addEventListener('click', async () => {
    try {
      const url = await getDownloadURL(itemRef);
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 2000);
    } catch (err) {
      alert(`Failed to get URL: ${err.message}`);
    }
  });
  actions.appendChild(copyBtn);

  const dlBtn = document.createElement('button');
  dlBtn.className = 'btn-sm';
  dlBtn.textContent = '↓';
  dlBtn.title = 'Open / Download';
  dlBtn.addEventListener('click', async () => {
    try {
      const url = await getDownloadURL(itemRef);
      window.open(url, '_blank');
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  });
  actions.appendChild(dlBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-sm btn-danger';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete "${itemRef.name}"?`)) return;
    try {
      await deleteObject(itemRef);
      loadPath(currentPath);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  });
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

// ── Upload ────────────────────────────────────────────────────

function uploadFile(file) {
  const body = $('storage-content');
  const dest  = currentPath ? `${currentPath}/${file.name}` : file.name;
  const fileRef = sRef(storage, dest);

  const progressEl = document.createElement('div');
  progressEl.className = 'upload-item';
  progressEl.innerHTML = `
    <span class="upload-name">${file.name}</span>
    <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
  `;
  body.prepend(progressEl);

  const task = uploadBytesResumable(fileRef, file);

  task.on(
    'state_changed',
    snap => {
      const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
      progressEl.querySelector('.progress-fill').style.width = `${pct}%`;
    },
    err => {
      progressEl.innerHTML = `<span class="error">Upload failed: ${err.message}</span>`;
      setTimeout(() => progressEl.remove(), 4000);
    },
    () => {
      progressEl.remove();
      loadPath(currentPath);
    }
  );
}

// ── Helpers ───────────────────────────────────────────────────

function icon(emoji) {
  const el = document.createElement('span');
  el.className = 'file-icon';
  el.textContent = emoji;
  return el;
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', avif: '🖼️',
    pdf: '📄',
    doc: '📝', docx: '📝', txt: '📝', md: '📝',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', aac: '🎵', flac: '🎵',
    zip: '🗜️', gz: '🗜️', tar: '🗜️', rar: '🗜️',
    js: '💾', ts: '💾', json: '💾', html: '💾', css: '💾', xml: '💾',
  };
  return map[ext] ?? '📄';
}
