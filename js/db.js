import { ref, get, set, remove, update } from 'firebase/database';
import { db } from './firebase-config.js';

export const loadAll = async (collection) => {
  const snap = await get(ref(db, collection));
  return snap.exists() ? snap.val() : {};
};

export const saveDoc = (path, data) => set(ref(db, path), data);

export const deleteDoc = (path) => remove(ref(db, path));

export const batchUpdate = (updates) => update(ref(db), updates);
