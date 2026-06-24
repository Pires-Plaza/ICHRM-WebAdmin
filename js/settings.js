import { loadAll, saveDoc } from './db.js';

const view = () => document.getElementById('view');

// ── Render ────────────────────────────────────────────────────

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [conf, home] = await Promise.all([
    loadAll('conference'),
    loadAll('homepage'),
  ]);

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Settings'));
  v.appendChild(header);

  v.appendChild(buildConferenceCard(conf));
  v.appendChild(buildHomepageCard(home));
}

// ── Conference status card ─────────────────────────────────────

function buildConferenceCard(conf) {
  const card = el('div', 'settings-card');
  card.appendChild(el('h2', 'settings-card-title', 'Conference Status'));

  const ongoing = conf.ongoing === true;

  const wrap = el('div', 'toggle-wrap');
  wrap.innerHTML = `
    <label class="toggle">
      <input type="checkbox" id="f-ongoing" ${ongoing ? 'checked' : ''}>
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
    <span id="f-ongoing-label" class="toggle-label"></span>
  `;

  const cb    = wrap.querySelector('#f-ongoing');
  const label = wrap.querySelector('#f-ongoing-label');

  const updateLabel = () => {
    label.innerHTML = cb.checked
      ? 'Conference is <strong>ongoing</strong>'
      : 'Conference is <strong>not ongoing</strong>';
  };

  cb.addEventListener('change', updateLabel);
  updateLabel();
  card.appendChild(wrap);

  const actions = el('div', 'form-actions');
  const saveBtn = btn('Save', 'btn-primary', async () => {
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveDoc('conference', { ongoing: cb.checked });
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save';
    }
  });
  actions.appendChild(saveBtn);
  card.appendChild(actions);

  return card;
}

// ── Homepage card ─────────────────────────────────────────────

function buildHomepageCard(home) {
  const card = el('div', 'settings-card');
  card.appendChild(el('h2', 'settings-card-title', 'Home Page'));

  const toDatetimeLocal = ts => ts
    ? new Date(ts * 1000).toISOString().slice(0, 16)
    : '';

  const form = el('div', 'form-body');
  form.innerHTML = `
    <div class="field"><label>Title</label>
      <input type="text" id="f-hp-title" value="${esc(home.title || '')}" /></div>
    <div class="field"><label>Subtitle</label>
      <input type="text" id="f-hp-subtitle" value="${esc(home.subtitle || '')}" /></div>
    <div class="field"><label>Description</label>
      <textarea id="f-hp-description">${esc(home.description || '')}</textarea></div>
    <div class="field"><label>Start Date &amp; Time</label>
      <input type="datetime-local" id="f-hp-dateStart" value="${toDatetimeLocal(home.dateStart)}" /></div>
    <div class="field"><label>End Date &amp; Time</label>
      <input type="datetime-local" id="f-hp-dateEnd" value="${toDatetimeLocal(home.dateEnd)}" /></div>
    <div class="field"><label>Venue</label>
      <input type="text" id="f-hp-venue" value="${esc(home.venue || '')}" /></div>
    <div class="field"><label>Address</label>
      <input type="text" id="f-hp-address" value="${esc(home.address || '')}" /></div>
    <div class="field"><label>Banner / Logo URL</label>
      <input type="url" id="f-hp-bannerURL" value="${esc(home.bannerURL || '')}" /></div>
    <div class="field"><label>Topics</label>
      <input type="text" id="f-hp-topics" value="${esc(home.topics || '')}" /></div>
    <div class="field"><label>Format</label>
      <input type="text" id="f-hp-format" value="${esc(home.format || '')}" /></div>
  `;

  const actions = el('div', 'form-actions');
  const saveBtn = btn('Save', 'btn-primary', async () => {
    const g = id => document.getElementById(id).value.trim();
    const dateStartRaw = document.getElementById('f-hp-dateStart').value;
    const dateEndRaw   = document.getElementById('f-hp-dateEnd').value;

    const homepageData = {
      title:       g('f-hp-title'),
      subtitle:    g('f-hp-subtitle'),
      description: g('f-hp-description'),
      venue:       g('f-hp-venue'),
      address:     g('f-hp-address'),
      bannerURL:   g('f-hp-bannerURL'),
      topics:      g('f-hp-topics'),
      format:      g('f-hp-format'),
      dateStart:   dateStartRaw ? Math.floor(new Date(dateStartRaw).getTime() / 1000) : null,
      dateEnd:     dateEndRaw   ? Math.floor(new Date(dateEndRaw).getTime()   / 1000) : null,
    };

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveDoc('homepage', homepageData);
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save';
    }
  });

  actions.appendChild(saveBtn);
  form.appendChild(actions);
  card.appendChild(form);

  return card;
}

// ── Helpers ───────────────────────────────────────────────────

function btn(text, className, onClick) {
  const b = document.createElement('button');
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
