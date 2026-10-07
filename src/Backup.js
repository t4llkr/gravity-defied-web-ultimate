// Полный бэкап пользовательских данных.
// localStorage — целиком (все ключи, включая будущие настройки);
// IDB — ссылочно: паки/скины по id (при импорте подтягиваются из data/),
// фоновая картинка — вложением (base64), т.к. её нет в данных приложения.
// Импорт — полная замена хранилищ, затем location.reload().
import { MRGCache } from "./MRGCache.js";
import { getAllSkins, saveSkin, removeSkin } from "./SkinStore.js";
import { loadBgImage, saveBgImage, clearBgImage } from "./VisualSettings.js";
import { fetchPackFile, fetchSkinFile } from "./LocalFiles.js";
import { PackManager } from "./PackManager.js";

const BACKUP_TYPE = "gd-ultimate-backup";
const BACKUP_VERSION = 1;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type = "application/octet-stream") {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    u[i] = bin.charCodeAt(i);
  }
  return new Blob([u], { type });
}

// ---------------- экспорт ----------------

export async function exportBackup() {
  const ls = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) {
        ls[k] = window.localStorage.getItem(k);
      }
    }
  } catch {
  }
  const cache = new MRGCache();
  const packs = (await cache.getAllMetadata()).map((m) => ({ id: m.id, name: m.name }));
  const skins = (await getAllSkins()).map((s) => ({ id: s.id, name: s.name }));
  let bgImage = null;
  try {
    const bgBlob = await loadBgImage();
    if (bgBlob) {
      bgImage = await blobToBase64(bgBlob);
    }
  } catch {
  }
  const data = {
    meta: {
      type: BACKUP_TYPE,
      version: BACKUP_VERSION,
      app: "gravity-defied-web-ultimate",
      exportedAt: new Date().toISOString(),
    },
    localStorage: ls,
    idb: { packs, skins, bgImage },
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gd-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------------- импорт ----------------

export async function importBackupFile(file) {
  let data = null;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "Not a valid backup file (bad JSON)." };
  }
  if (!data || typeof data !== "object" || data.meta?.type !== BACKUP_TYPE) {
    return { ok: false, error: "Not a Gravity Defied Ultimate backup file." };
  }
  if (typeof data.meta.version === "number" && data.meta.version > BACKUP_VERSION) {
    console.warn("Backup from a newer version, some data may be skipped.");
  }
  const report = { packsRestored: 0, packsMissing: [], skinsRestored: 0, skinsMissing: [], bgRestored: false };

  // IDB: очистка перед заменой
  const cache = new MRGCache();
  try {
    await cache.clearAll();
  } catch {
  }
  try {
    for (const s of await getAllSkins()) {
      await removeSkin(s.id);
    }
  } catch {
  }
  try {
    await clearBgImage();
  } catch {
  }

  // IDB: восстановление (метаданные обогащаем из каталога — иначе у Saved-паков
  // прогресс показывался без итогов по лигам, пока пак не прокликать)
  const pm = new PackManager();
  const catalogCache = {};
  for (const p of (data.idb?.packs ?? [])) {
    const id = Number(p.id);
    try {
      const blob = await fetchPackFile(PackManager.sourceOf(id), PackManager.srcIdOf(id));
      const buffer = await blob.arrayBuffer();
      let extra = {};
      try {
        const source = PackManager.sourceOf(id);
        catalogCache[source] = catalogCache[source] ?? await pm._catalog(source);
        const it = catalogCache[source].find((c) => c.id === id);
        if (it) {
          extra = {
            name: it.name,
            author: it.author,
            levels: it.levels,
            levelsBreakdown: it.levelsBreakdown,
            tracksTotal: it.tracksTotal,
            mrgSize: it.mrgSize,
          };
        }
      } catch {
      }
      await cache.savePack(id, buffer, { id, name: p.name ?? extra.name ?? "Pack " + id, savedAt: Date.now(), ...extra });
      report.packsRestored++;
    } catch {
      report.packsMissing.push(p.name ?? String(id));
    }
  }
  for (const s of (data.idb?.skins ?? [])) {
    const id = Number(s.id);
    try {
      const zipBlob = await fetchSkinFile(id);
      await saveSkin({ id, name: s.name ?? "Skin " + id, author: "", zipBlob, savedAt: Date.now() });
      report.skinsRestored++;
    } catch {
      report.skinsMissing.push(s.name ?? String(id));
    }
  }
  if (data.idb?.bgImage) {
    try {
      await saveBgImage(base64ToBlob(data.idb.bgImage));
      report.bgRestored = true;
    } catch {
    }
  }

  // localStorage: полная замена
  try {
    window.localStorage.clear();
    const ls = data.localStorage ?? {};
    for (const k of Object.keys(ls)) {
      window.localStorage.setItem(k, ls[k]);
    }
  } catch {
    return { ok: false, error: "Failed to write localStorage." };
  }
  return { ok: true, report };
}

// ---------------- UI-хелперы ----------------

export function pickBackupFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    // отмена выбора — через фокус (надёжнее oncancel)
    window.addEventListener("focus", () => setTimeout(() => resolve(null), 400), { once: true });
    input.click();
  });
}

const btnCss = "background:#22242a;border:1px solid #555;color:#eee;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;";

export function confirmReplaceDialog() {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:720;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
    const card = document.createElement("div");
    card.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:340px;display:flex;flex-direction:column;gap:14px;";
    const msg = document.createElement("div");
    msg.textContent = "Import backup? ALL current progress, records, settings and downloaded content will be replaced.";
    msg.style.cssText = "color:#eee;font-size:14px;word-break:break-word;";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-direction:column;gap:8px;";
    const done = (v) => { box.remove(); resolve(v); };
    const mk = (label, danger, v) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "width:100%;box-sizing:border-box;background:" + (danger ? "#7a2e2e" : "#22242a") + ";border:1px solid " + (danger ? "#a55" : "#555") + ";color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;";
      b.onclick = () => done(v);
      return b;
    };
    row.append(mk("Import and replace", true, true), mk("Cancel", false, false));
    card.append(msg, row);
    box.appendChild(card);
    box.onclick = (e) => { if (e.target === box) { done(false); } };
    document.body.appendChild(box);
  });
}
