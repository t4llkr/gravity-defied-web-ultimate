// Автосохранение черновика редактора (T3.2). Отдельная маленькая БД - не трогаем
// версию основной БД паков. EditorState сериализуем напрямую (plain-объекты).
const DB_NAME = "gd-editor";
const STORE = "draft";
const KEY = "current";
const DEBOUNCE_MS = 800;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDraft() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("editor draft load failed", e);
    return null;
  }
}

let saveTimer = null;

export function scheduleDraftSave(state, onSaved) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const db = await openDb();
      const payload = {
        savedAt: Date.now(),
        packName: state.packName,
        author: state.author || "",
        league: state.league,
        track: state.track,
        leagues: state.leagues,
      };
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(payload, KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      if (onSaved) onSaved(payload.savedAt);
    } catch (e) {
      console.error("editor draft save failed", e);
    }
  }, DEBOUNCE_MS);
}

export async function clearDraft() {
  clearTimeout(saveTimer);
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
  }
}
