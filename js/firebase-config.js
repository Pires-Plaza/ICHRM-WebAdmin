import { initializeApp } from 'firebase/app';
import { getAuth }        from 'firebase/auth';
import { getDatabase }    from 'firebase/database';
import { getStorage }     from 'firebase/storage';

// Replace every value below with your Firebase project config.
// Console → Project settings → Your apps → SDK setup and configuration
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getDatabase(app);
export const storage = getStorage(app);
