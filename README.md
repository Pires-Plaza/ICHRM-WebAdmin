# ICHRM Admin Portal

Static admin UI for Firebase (RTDB + Storage), hostable on GitHub Pages.

## Setup

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Enable **Realtime Database** — start in **locked mode**
3. Enable **Storage** — start in **production mode**
4. Enable **Authentication** → Sign-in method → **Email/Password**

### 2. Add your config

Open `js/firebase-config.js` and replace every placeholder with your project's config.  
Find it at: **Project settings → Your apps → SDK setup and configuration**.

### 3. Create an admin user

**Authentication → Users → Add user**.  
Only users you add here can sign in to this portal.

### 4. Set security rules

**Realtime Database** (`Rules` tab):
```json
{
  "rules": {
    ".read":  "auth != null",
    ".write": "auth != null"
  }
}
```

**Storage** (`Rules` tab):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Authorize your domain

**Authentication → Settings → Authorized domains** — add your GitHub Pages domain:
```
YOUR_USERNAME.github.io
```

### 6. Deploy to GitHub Pages

Push to `main`. In your repo → **Settings → Pages** → Source: **Deploy from branch** → `main` / `/ (root)`.

## Features

| Database | Storage |
|----------|---------|
| Browse JSON tree | Browse folders |
| Navigate by path or breadcrumb | Upload files with progress bar |
| Add / edit / delete nodes | Copy download URL to clipboard |
| Type-aware values (string, number, bool, JSON) | Delete files |
