// Custom-паки: .mrg из редактора или импорта во вкладке Custom. Храним в существующем
// MRGCache (IDB "GravityDefiedPacks", те же сторы packs/metadata) - отдельная БД
// и миграция не нужны. keyId = 2000000 + n: не пересекается с gdmod (id),
// gdtr (1000000 + id) и тест-паком редактора (9000001).
import { MRGCache } from "./MRGCache.js";
import { serializePack } from "./TrackCodec.js";

export const CUSTOM_ID_BASE = 2000000;
export const isCustomId = (id) => Number(id) >= CUSTOM_ID_BASE;

const cache = new MRGCache();

const txSafe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error("CustomStore:", e);
    return null;
  }
};

export function customList() {
  return txSafe(async () => {
    const all = await cache.getAllMetadata();
    return all.filter((m) => isCustomId(m.id)).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }).then((r) => r || []);
}

export async function customGet(id) {
  return txSafe(() => cache.getPack(Number(id)));
}

// rec: {id?, name, author, mrg: Uint8Array|ArrayBuffer, levelsBreakdown?}
// id задан -> обновление (savedAt сохраняем), иначе выдаётся следующий свободный id.
export async function customPut(rec) {
  const mrgBuffer = rec.mrg instanceof Uint8Array ? rec.mrg.slice().buffer : rec.mrg;
  let id = rec.id != null ? Number(rec.id) : null;
  let prevSavedAt = null;
  if (id != null) {
    const prev = await customGet(id);
    prevSavedAt = prev && prev.metadata ? prev.metadata.savedAt : null;
  } else {
    const rows = await customList();
    id = rows.reduce((m, r) => Math.max(m, Number(r.id)), CUSTOM_ID_BASE - 1) + 1;
  }
  const levelsBreakdown = rec.levelsBreakdown || [0, 0, 0];
  const metadata = {
    id,
    name: rec.name || "Custom pack",
    author: rec.author || "custom",
    source: "custom",
    levels: levelsBreakdown.join("/"),
    levelsBreakdown,
    tracksTotal: levelsBreakdown.reduce((s, n) => s + n, 0),
    leaguesTotal: levelsBreakdown.filter((n) => n > 0).length,
    savedAt: prevSavedAt || Date.now(),
  };
  await cache.savePack(id, mrgBuffer, metadata);
  return { id, metadata };
}

export async function customDelete(id) {
  return txSafe(() => cache.deletePack(Number(id)));
}

// дебаунс-сейв из редактора: состояние -> .mrg -> MRGCache
let saveTimer = null;
export function scheduleCustomSave(state, customId, onSaved) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const bytes = serializePack(state.leagues);
      await customPut({
        id: customId,
        name: state.packName,
        author: state.author,
        mrg: bytes,
        levelsBreakdown: state.leagues.map((lg) => lg.length),
      });
      if (onSaved) onSaved(Date.now());
    } catch (e) {
      console.error("custom save failed", e);
    }
  }, 800);
}
