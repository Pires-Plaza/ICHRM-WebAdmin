import { initializeApp } from 'firebase/app';
import { getAuth }        from 'firebase/auth';
import { getDatabase }    from 'firebase/database';

const firebaseConfig = {
  apiKey:            "AIzaSyDVCASR3I4Ta-Aq7W9OsByq4cM6p2wfTpo",
  authDomain:        "ichrm-backend.firebaseapp.com",
  databaseURL:       "https://ichrm-backend-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "ichrm-backend",
  messagingSenderId: "478624127642",
  appId:             "1:478624127642:web:572fd649231da404ce1d23",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getDatabase(app);
