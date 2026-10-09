// Управление левелпаками: ЛОКАЛЬНЫЕ источники.
// Метаданные: data/packs_gdmod.json, data/packs_gdtr.json.
// Файлы:     data/packs_gdmod.zip, data/packs_gdtr.zip (имена "<id>_...").
// Ключи хранения — числовые, как раньше: gdmod == id, gdtr == 1000000 + id.
// Это сохраняет совместимость с MRGCache, рекордами p<id>_ и gd-progress-<id>
// (миграция не нужна). Прокси и HTML-скрапинг удалены.
import { MRGCache } from "./MRGCache.js";
import { LocalArchive } from "./LocalArchive.js";
import { fetchPackFile } from "./LocalFiles.js";


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
// оба направления на ключ: кнопки в галерее переключают asc/desc циклом
const authorCmp = (a, b) => {
  const A = (a.author || "").toLowerCase();
  const B = (b.author || "").toLowerCase();
  if (!A && !B) return 0;
  if (!A) return 1; // без автора — в конец
  if (!B) return -1;
  return A.localeCompare(B) || (a.name || "").localeCompare(b.name || "");
};
const SORTS = {
  tracks_desc: (a, b) => (b.tracksTotal ?? 0) - (a.tracksTotal ?? 0),
  tracks_asc: (a, b) => (a.tracksTotal ?? 0) - (b.tracksTotal ?? 0),
  name_asc: (a, b) => (a.name || "").localeCompare(b.name || ""),
  name_desc: (a, b) => (b.name || "").localeCompare(a.name || ""),
  author_asc: (a, b) => authorCmp(a, b),
  author_desc: (a, b) => authorCmp(b, a),
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
    this.archives = {
      merged: new LocalArchive("packs_catalog", { byPrefix: true }),
    };
    // авто-флаги "невозможный" из packs_broken.json (bad + flagged);
    // в данных каталога, не в localStorage — снять нельзя до фикса пака
    this.brokenAuto = new Set();
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

  static keyIdOf(_source, id) {
    return Number(id);
  }
  static sourceOf() {
    return "packs";
  }
  static srcIdOf(keyId) {
    return Number(keyId);
  }

  // ---- метаданные каталогов ----
  isAutoFlagged(id) {
    return this.brokenAuto.has(Number(id));
  }

  async _catalog(_source) {
    if (!this._catalogs.merged) {
      const data = await this.archives.merged.json();
      const list = (data.items || [])
        .filter((it) => it && it.hasMrg !== false)
        .map((it) => this._normalize("packs", it));
      this._catalogs.merged = list;
      // напрямую: LocalArchive.json() требует items, а тут {meta, bad, flagged}
      try {
        const r = await fetch("data/packs_broken.json");
        if (r.ok) {
          const broken = await r.json();
          this.brokenAuto = new Set([
            ...(broken.bad || []).map((p) => Number(p.id)),
            ...(broken.flagged || []).map((p) => Number(p.id)),
          ]);
        }
      } catch {
      }
      if (!this.brokenAuto) {
        this.brokenAuto = new Set(); // файла нет — авто-флагов нет
      }
      // окно PackMenu: весь локальный каталог известен сразу
      this.windowStart = 0;
      this.windowItems = list;
      this.shortConfirmed = true;
    }
    return this._catalogs.merged;
  }
  _normalize(_source, it) {
    const breakdown = Array.isArray(it.levelsBreakdown) && it.levelsBreakdown.length === 3 ? it.levelsBreakdown : [0, 0, 0];
    return {
      id: Number(it.id),
      srcId: Number(it.id),
      source: "packs",
      name: it.name ?? "Pack " + it.id,
      author: it.author ?? "",
      levels: breakdown.join("/"),
      levelsBreakdown: breakdown,
      tracksTotal: it.tracksTotal ?? breakdown.reduce((s, n) => s + n, 0),
      mrgBytes: null,
      mrgSize: "",
      downloads: null,
      originality: null,
      addedRaw: null,
      addedTs: null,
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
    const cmp = SORTS[sort] || SORTS.tracks_desc;
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
      // ручной флаг ИЛИ авто-флаг из packs_broken.json
      if (!isCurrent && hideImpossible && (flags[it.id] || this.isAutoFlagged(it.id))) {
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
    const all = await this._catalog("merged");
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
  // Случайный пак для кнопки "Random": исключены сохранённые, невозможные и 100%.
  async randomPack(source, { query = "" } = {}) {
    const all = await this._catalog(source);
    const q = query.trim().toLowerCase();
    let flags = {};
    try {
      flags = JSON.parse(window.localStorage.getItem("gd-pack-flags") || "{}");
    } catch {
    }
    const cached = new Set((await this.getCachedPacks()).map((m) => m.id));
    const pool = [];
    for (const it of all) {
      if (cached.has(it.id)) {
        continue;
      }
      if (flags[it.id]) {
        continue;
      }
      const done = countCompletedPerDifficulty(it.id);
      const b = it.levelsBreakdown;
      if (Array.isArray(b) && b.length === 3 && b.every((n, i) => n > 0 && done[i] >= n)) {
        continue;
      }
      if (q && !(it.name || "").toLowerCase().includes(q)) {
        continue;
      }
      pool.push(it);
    }
    if (pool.length === 0) {
      return null;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Страница пака при текущей сортировке/поиске (hide-тогглы не учитываем —
  // кандидат рандома им не подвержен по построению)
  async packPageById(source, id, sort, query, perPage) {
    const all = await this._catalog(source);
    const cmp = SORTS[sort] || SORTS.tracks_desc;
    const q = query.trim().toLowerCase();
    const list = all.filter((it) => !q || (it.name || "").toLowerCase().includes(q)).sort(cmp);
    const idx = list.findIndex((it) => it.id === id);
    if (idx < 0) {
      return 1;
    }
    return Math.floor(idx / perPage) + 1;
  }

  async savedList() {
    const metas = await this.getCachedPacks();
    let merged = [];
    try {
      merged = await this._catalog("merged");
    } catch {
    }
    const byId = new Map(merged.map((c) => [c.id, c]));
    const out = [];
    for (const meta of metas) {
      const source = "packs";
      let extra = { mrgBytes: null, addedTs: null, addedRaw: null };
      const it = byId.get(meta.id);
      if (it) {
        extra = { mrgBytes: it.mrgBytes, addedTs: it.addedTs, addedRaw: it.addedRaw };
      }
      out.push({ ...meta, source, savedAt: meta.savedAt || 0, ...extra });
    }
    return out;
  }

  // ---- получение .mrg: extract из zip -> тот же кэш-пайплайн, что раньше ----
  async downloadPack(id) {
    const source = PackManager.sourceOf(id);
    const srcId = PackManager.srcIdOf(id);
    // метаданные ищем в объединённом каталоге — рантайму не нужны исходные JSON
    const cat = await this._catalog("merged");
    const entry = cat.find((c) => c.id === Number(id));
    if (!entry) {
      throw new Error("Pack not in catalog: " + source + "/" + srcId);
    }
    // файл пака: data/packs/<id>.mrg (строгое имя, манифест не нужен)
    const blob = await fetchPackFile(srcId);
    const buffer = await blob.arrayBuffer();
    const metadata = {
      id: Number(id),
      name: entry.name,
      author: entry.author,
      levels: entry.levels,
      levelsBreakdown: entry.levelsBreakdown,
      tracksTotal: entry.tracksTotal,
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
