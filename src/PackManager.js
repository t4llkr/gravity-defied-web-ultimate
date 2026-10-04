// Управление левелпаками: ЛОКАЛЬНЫЕ источники.
// Метаданные: data/packs_gdmod.json, data/packs_gdtr.json.
// Файлы:     data/packs_gdmod.zip, data/packs_gdtr.zip (имена "<id>_...").
// Ключи хранения — числовые, как раньше: gdmod == id, gdtr == 1000000 + id.
// Это сохраняет совместимость с MRGCache, рекордами p<id>_ и gd-progress-<id>
// (миграция не нужна). Прокси и HTML-скрапинг удалены.
import { MRGCache } from "./MRGCache.js";
import { LocalArchive } from "./LocalArchive.js";
import { fetchPackFile } from "./LocalFiles.js";

export const GDTR_OFFSET = 1000000;
export const PACK_SOURCES = { gdmod: "gdmod", gdtr: "GDTR" };

export function formatBytes(n) {
  if (n == null || isNaN(n)) {
    return "";
  }
  if (n < 1024) {
    return n + " B";
  }
  if (n < 1048576) {
    return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
  }
  return (n / 1048576).toFixed(1) + " MB";
}

// ISO "2020-02-15" / "15.02.2020" / "15/02/2020" -> ms; неразбор -> null
export function normalizeDate(s) {
  if (!s || typeof s !== "string") {
    return null;
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return isNaN(t) ? null : t;
  }
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
  if (m) {
    const t = Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}

// Каждый тип — в обе стороны. progress_* считается в PackGallery (нужен доступ к рекордам).
const SORTS = {
  date_desc: (a, b) => (b.addedTs ?? -1) - (a.addedTs ?? -1),
  date_asc: (a, b) => (a.addedTs ?? Infinity) - (b.addedTs ?? Infinity),
  name_desc: (a, b) => (b.name || "").localeCompare(a.name || ""),
  name_asc: (a, b) => (a.name || "").localeCompare(b.name || ""),
  author_desc: (a, b) => (b.author || "").localeCompare(a.author || ""),
  author_asc: (a, b) => (a.author || "").localeCompare(b.author || ""),
  tracks_desc: (a, b) => (b.tracksTotal || 0) - (a.tracksTotal || 0),
  tracks_asc: (a, b) => (a.tracksTotal || 0) - (b.tracksTotal || 0),
  downloads_desc: (a, b) => (b.downloads ?? -1) - (a.downloads ?? -1),
  downloads_asc: (a, b) => (a.downloads ?? -1) - (b.downloads ?? -1),
  originality_desc: (a, b) => (b.originality ?? -1) - (a.originality ?? -1),
  originality_asc: (a, b) => (a.originality ?? -1) - (b.originality ?? -1),
  size_desc: (a, b) => (b.mrgBytes || 0) - (a.mrgBytes || 0),
  size_asc: (a, b) => (a.mrgBytes || 0) - (b.mrgBytes || 0),
  saved_desc: (a, b) => (b.savedAt || 0) - (a.savedAt || 0),
  saved_asc: (a, b) => (a.savedAt || 0) - (b.savedAt || 0),
  source_desc: (a, b) => ((b.source || "") + (b.name || "")).localeCompare((a.source || "") + (a.name || "")),
  source_asc: (a, b) => ((a.source || "") + (a.name || "")).localeCompare((b.source || "") + (b.name || "")),
};

// Прогресс по сложностям: сколько треков пройдено. Имя хранилища рекорда —
// packPrefix + лига + трек, склейка без разделителя ("p42_115" = лига 1, трек 15);
// лига = первая цифра суффикса. Дублируется в PackGallery через импорт.
export function countCompletedPerDifficulty(packId) {
  const storagePrefix = "gravity_defied_record_store:";
  const packPrefix = "p" + packId + "_";
  const counts = [0, 0, 0, 0];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(storagePrefix)) {
        continue;
      }
      const key = k.slice(storagePrefix.length);
      let suffix;
      if (packId === 0) {
        suffix = key;
      } else {
        if (!key.startsWith(packPrefix)) {
          continue;
        }
        suffix = key.slice(packPrefix.length);
      }
      if (!/^[0-9]{2,}$/.test(suffix)) {
        continue;
      }
      const league = suffix.charCodeAt(0) - 48;
      if (league < 0 || league > 3) {
        continue;
      }
      counts[league]++;
    }
  } catch {
  }
  return counts;
}

export class PackManager {
  constructor() {
    this.cache = new MRGCache();
    this.archives = { gdmod: LocalArchive.packs("gdmod"), gdtr: LocalArchive.packs("gdtr") };
    this._catalogs = {};
    // Поля окна каталога для PackMenu: раньше оценка с сервера, теперь честные —
    // весь локальный каталог известен сразу.
    this.windowStart = 0;
    this.windowItems = [];
    this.shortConfirmed = true;
    this.lastSliceRawCount = 0;
  }

  async init() {
    // MRGCache сам лениво открывает БД в каждом методе; держим вызов для PackMenu
    await this.cache.open();
  }

  static keyIdOf(source, id) {
    return source === "gdtr" ? GDTR_OFFSET + Number(id) : Number(id);
  }
  static sourceOf(keyId) {
    return Number(keyId) >= GDTR_OFFSET ? "gdtr" : "gdmod";
  }
  static srcIdOf(keyId) {
    const n = Number(keyId);
    return n >= GDTR_OFFSET ? n - GDTR_OFFSET : n;
  }

  // ---- метаданные каталогов ----
  async _catalog(source) {
    if (!this._catalogs[source]) {
      const data = await this.archives[source].json();
      const list = data.items
        .filter((it) => it.hasMrg !== false && it.mrgSize != null)
        .map((it) => this._normalize(source, it));
      list.sort(SORTS.date_desc);
      this._catalogs[source] = list;
      if (source === "gdmod") {
        // окно PackMenu: весь каталог известен
        this.windowStart = 0;
        this.windowItems = list;
        this.shortConfirmed = true;
      }
    }
    return this._catalogs[source];
  }
  _normalize(source, it) {
    const breakdown = Array.isArray(it.levelsBreakdown) ? it.levelsBreakdown : [0, 0, 0];
    return {
      id: PackManager.keyIdOf(source, it.id),
      srcId: Number(it.id),
      source,
      name: it.name ?? "Pack " + it.id,
      author: it.author ?? "",
      authorId: it.authorId ?? null,
      levels: breakdown.join("/"),
      levelsBreakdown: breakdown,
      tracksTotal: it.tracks ?? breakdown.reduce((s, n) => s + n, 0),
      mrgBytes: it.mrgSize ?? null,
      mrgSize: formatBytes(it.mrgSize),
      downloads: it.downloads ?? null,
      originality: it.originality ?? null,
      addedRaw: it.added ?? null,
      addedTs: normalizeDate(it.added),
      hasMrg: true,
      hasGdlvl: false,
    };
  }
  async catalogSize(source) {
    return (await this._catalog(source)).length;
  }

  // ---- выборка для PackGallery: сортировка на полном массиве, потом страница ----
  async catalogPage(source, uiPage, uiPerPage, { sort = "date_desc", hideDownloaded = false, hideCompleted = false, hideImpossible = false, currentId = null, query = "" } = {}) {
    const all = await this._catalog(source);
    const cmp = SORTS[sort] || SORTS.date_desc;
    const q = query.trim().toLowerCase();
    let flags = {};
    try {
      flags = JSON.parse(window.localStorage.getItem("gd-pack-flags") || "{}");
    } catch {
    }
    const cached = new Map((await this.getCachedPacks()).map((m) => [m.id, m]));
    const decorated = [];
    for (const it of all) {
      // текущий пак — контекст: фильтры его не скрывают (зелёная рамка всегда на месте)
      const isCurrent = currentId !== null && it.id === currentId;
      const meta = cached.get(it.id);
      if (!isCurrent && hideDownloaded && meta) {
        continue;
      }
      const done = countCompletedPerDifficulty(it.id);
      const b = it.levelsBreakdown;
      const doneAll = Array.isArray(b) && b.length === 3 && b.every((n, i) => n > 0 && done[i] >= n);
      if (!isCurrent && hideCompleted && doneAll) {
        continue;
      }
      if (!isCurrent && hideImpossible && flags[it.id]) {
        continue;
      }
      if (q && !(it.name || "").toLowerCase().includes(q)) {
        continue;
      }
      decorated.push(meta ? { ...it, downloaded: true, cachedMeta: meta } : { ...it, downloaded: false });
    }
    decorated.sort(cmp);
    const totalItems = decorated.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / uiPerPage));
    const page = Math.min(Math.max(1, uiPage), totalPages);
    return { items: decorated.slice((page - 1) * uiPerPage, page * uiPerPage), totalItems, totalPages, page };
  }

  // ---- выборка для PackMenu (вкладка browse — каталог gdmods) ----
  async getUiPage(uiPage, uiPerPage) {
    const all = await this._catalog("gdmod");
    const items = all.slice((uiPage - 1) * uiPerPage, uiPage * uiPerPage);
    this.lastSliceRawCount = items.length;
    return items;
  }

  // ---- сохранённые паки ----
  async getCachedPacks() {
    return this.cache.getAllMetadata();
  }
  async isPackCached(id) {
    return this.cache.hasPack(id);
  }
  async savedList() {
    const metas = await this.getCachedPacks();
    const out = [];
    for (const meta of metas) {
      const source = PackManager.sourceOf(meta.id);
      const srcId = PackManager.srcIdOf(meta.id);
      let extra = { mrgBytes: null, addedTs: null, addedRaw: null };
      try {
        const cat = await this._catalog(source);
        const it = cat.find((c) => c.srcId === srcId);
        if (it) {
          extra = { mrgBytes: it.mrgBytes, addedTs: it.addedTs, addedRaw: it.addedRaw };
        }
      } catch {
      }
      out.push({ ...meta, source, savedAt: meta.savedAt || 0, ...extra });
    }
    return out;
  }

  // ---- получение .mrg: extract из zip -> тот же кэш-пайплайн, что раньше ----
  async downloadPack(id) {
    const source = PackManager.sourceOf(id);
    const srcId = PackManager.srcIdOf(id);
    const cat = await this._catalog(source);
    const entry = cat.find((c) => c.srcId === srcId);
    if (!entry) {
      throw new Error("Pack not in catalog: " + source + "/" + srcId);
    }
    // файл пака: data/packs_<source>/<id>.mrg (строгое имя, манифест не нужен)
    const blob = await fetchPackFile(source, srcId);
    const buffer = await blob.arrayBuffer();
    const metadata = {
      id: Number(id),
      name: entry.name,
      author: entry.author,
      levels: entry.levels,
      levelsBreakdown: entry.levelsBreakdown,
      tracksTotal: entry.tracksTotal,
      mrgSize: entry.mrgSize,
      mrgBytes: entry.mrgBytes,
      savedAt: Date.now(),
    };
    await this.cache.savePack(Number(id), buffer, metadata);
    return { buffer, metadata };
  }
  async getPackBlobUrl(id) {
    return this.cache.getPackBlobUrl(id);
  }
  async deletePack(id) {
    await this.cache.deletePack(id);
  }
  async clearCache() {
    await this.cache.clearAll();
  }
  async getCacheSize() {
    return this.cache.getCacheSize();
  }
}
