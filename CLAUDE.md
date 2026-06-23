# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Static admin portal for the ICHRM conference Firebase backend. Manages Authors, Papers, and Sessions stored in Firebase Realtime Database (RTDB). Hosted on GitHub Pages — no build step, no bundler, no Node dependencies.

## Running locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

`localhost` must be listed under Firebase Console → Authentication → Settings → Authorized domains, otherwise sign-in will be blocked.

## Tech stack

- **Vanilla JS with ES modules** — `<script type="module">`, no framework, no bundler
- **Firebase JS SDK v10.14.0** loaded via CDN, mapped through an `importmap` in `index.html`
- **No package.json, no npm, no build step** — deploying means pushing to `main`

## Architecture

### Module responsibilities

- `js/firebase-config.js` — initialises the Firebase app and exports `auth` and `db`. The only file with credentials.
- `js/db.js` — thin wrappers over the Firebase RTDB SDK (`loadAll`, `saveDoc`, `deleteDoc`, `batchUpdate`). All Firebase reads/writes go through here.
- `js/app.js` — entry point. Owns auth state (`onAuthStateChanged`), sidebar navigation, and calls `initDetail()` once on load.
- `js/detail.js` — shared read-only detail modal (`showDetail(title, htmlString)`, `initDetail()`). Closed by ✕ button, backdrop click, or Escape.
- `js/authors.js`, `js/papers.js`, `js/sessions.js` — each exports a single `render()` function. Calling it replaces `#view` with the list view for that section. Internal `renderForm(id?)` replaces `#view` with the edit/create form.

### View pattern

There is one `<div id="view">` in the DOM. Every section owns the entire contents of this div — navigating between list and form within a section is done by replacing `innerHTML` / rebuilding the DOM, not by showing/hiding panels.

### Relationship sync (fan-out writes)

RTDB stores relationship lists as `{ id: true }` objects (arrays are not supported). Relationships are bi-directional and kept in sync using `batchUpdate` (a single atomic `update()` call to multiple paths). When saving an entity, the module diffs old vs. new relationship sets and writes null (delete) or true (add) to the reverse paths.

| Save | Also updates |
|------|-------------|
| Author.papers | `papers/{pid}/authors/{authorId}` |
| Paper.authors | `authors/{aid}/papers/{paperId}` |
| Paper.session | `sessions/{sid}/papers/{paperId}` |
| Session.papers | `papers/{pid}/session` |
| Session.speakers | no reverse — authors don't store sessions |

The same diff + batchUpdate pattern runs on delete to clean up all reverse references.

## Data model

```
/authors/{uuid}
  id, name, email, affiliation, bio, photoURL
  papers: { paperId: true }

/papers/{uuid}
  id, title, abstract
  session: sessionId          ← string, not an object
  authors: { authorId: true }

/sessions/{uuid}
  id, title, date (unix timestamp), location
  papers:   { paperId: true }
  speakers: { authorId: true }
```

Empty strings are stored as-is. Fields with no value are omitted from the object using `...(condition && { key: value })` spread syntax — setting a key to `null` in a Firebase `set()` removes it.

## Adding a new entity type

1. Create `js/newtype.js` following the same pattern as `authors.js`: export `render()`, keep `renderForm()` and `doDelete()` private, add `buildDetail()` for the modal.
2. Add `import { render as renderNewType } from './newtype.js'` in `app.js` and add it to the `sections` map.
3. Add a `<button class="nav-item" data-section="newtype">` in `index.html`.
4. Add a RTDB path entry to the data model above.
