// Миграции схемы сохранённых данных.
// gd-schema-version в localStorage: если отсутствует или меньше текущей —
// выполняется зачистка устаревшего и записывается новая версия.
// Срабатывает один раз на клиента; дальше — постоянный крючок для будущих
// схем (bump SCHEMA_VERSION -> новая логика).
//
// Вайп избирательный: сейчас (v1, перестройка каталога) чистится всё
// id-зависимое ДЛЯ ПАКОВ КАТАЛОГА, но НЕ: id 0 (Original levels, p0_*
// и gd-progress-0), custom-паки (id >= 2_000_000), тест-пак (9000001),
// черновики редактора, скины и настройки.
import { MRGCache } from "./MRGCache.js";

const SCHEMA_VERSION = 1;
const CUSTOM_ID_BASE = 2000000;

const doWipeV1 = async () => {
  // ---- localStorage ----
  try {
    const doomed = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) {
        continue;
      }
      if (k === "gd-last-pack") {
        if (window.localStorage.getItem(k) !== "0") {
          doomed.push(k); // указывал на пак старого каталога
        }
        continue;
      }
      if (k === "gd-pack-flags") {
        try {
          const flags = JSON.parse(window.localStorage.getItem(k) || "{}");
          const kept = {};
          if (flags["0"]) {
            kept["0"] = flags["0"]; // ручной флаг Original levels сохраняем
          }
          window.localStorage.setItem(k, JSON.stringify(kept));
        } catch {
        }
        continue;
      }
      const m = k.match(/^gd-progress-(\d+)$/);
      if (m && Number(m[1]) !== 0) {
        doomed.push(k);
      }
    }
    for (const k of doomed) {
      window.localStorage.removeItem(k);
    }
  } catch (e) {
    console.error("schema migrate: localStorage", e);
  }
  // ---- RecordStore: p<id>_* для id != 0 ----
  try {
    const { RecordStore } = await import("./rms/RecordStore.js");
    for (const name of RecordStore.listRecordStores()) {
      if (name === "GWTRStates") {
        continue;
      }
      const m = name.match(/^p(\d+)_/);
      if (m && Number(m[1]) !== 0) {
        RecordStore.deleteRecordStore(name);
      }
    }
  } catch (e) {
    console.error("schema migrate: records", e);
  }
  // ---- IDB: кэш паков каталога (id < 2_000_000); custom не трогаем ----
  try {
    const cache = new MRGCache();
    const all = await cache.getAllMetadata();
    for (const meta of all) {
      if (Number(meta.id) < CUSTOM_ID_BASE) {
        await cache.deletePack(Number(meta.id));
      }
    }
  } catch (e) {
    console.error("schema migrate: idb", e);
  }
};

export async function migrateSchema() {
  let stored = 0;
  try {
    stored = Number(window.localStorage.getItem("gd-schema-version") || "0") || 0;
  } catch {
  }
  if (stored >= SCHEMA_VERSION) {
    return;
  }
  console.log(`[schema] migrate ${stored} -> ${SCHEMA_VERSION}`);
  if (stored < 1) {
    await doWipeV1();
  }
  try {
    window.localStorage.setItem("gd-schema-version", String(SCHEMA_VERSION));
  } catch {
  }
}
