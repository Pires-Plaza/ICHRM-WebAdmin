import { loadAll, saveDoc } from './db.js';

const view = () => document.getElementById('view');

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const home = await loadAll('homepage');

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Home Page'));
  v.appendChild(header);

  v.appendChild(buildCard(home));
}

function buildCard(home) {
  const toDatetimeLocal = ts => ts
    ? new Date(ts * 1000).toISOString().slice(0, 16)
    : '';

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

  const card = el('div', 'settings-card');

  const cardHeader = el('div', 'settings-card-header');
  cardHeader.appendChild(el('h2', 'settings-card-title', 'Home Page'));
  cardHeader.appendChild(saveBtn);
  card.appendChild(cardHeader);

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
      <textarea id="f-hp-topics">${esc(home.topics || '')}</textarea></div>
    <div class="field"><label>Format</label>
      <textarea id="f-hp-format">${esc(home.format || '')}</textarea></div>
  `;
  card.appendChild(form);

  return card;
}

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
