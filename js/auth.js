import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebase-config.js';

export const signIn = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const signOutUser = () => signOut(auth);

export function friendlyError(code) {
  const map = {
    'auth/invalid-email':      'Invalid email address.',
    'auth/user-not-found':     'No account found with this email.',
    'auth/wrong-password':     'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests':  'Too many attempts. Try again later.',
    'auth/user-disabled':      'This account has been disabled.',
  };
  return map[code] ?? 'Sign in failed. Please try again.';
}
