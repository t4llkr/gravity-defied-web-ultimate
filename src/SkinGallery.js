// Галерея скинов: вкладки Catalog / Saved. Локально — метаданные из data/skins.json,
// миниатюры из data/skins_thumbs.zip, файлы скинов из data/skins.zip.
// Миниатюры Saved генерируются из хранящегося zip тем же путём, что применение скина.
import { unzip } from "./ZipReader.js";
import { removeSkin, saveSkin } from "./SkinStore.js";
import { fetchSkinFile } from "./LocalFiles.js";

const CATALOG_PAGE_SIZE = 50;
const UI_KEY = "gd-skins-ui";
const HELMET_PLACEHOLDER = new URL("./assets/helmet.png", import.meta.url).href;
const THUMBS_DIR = new URL("../data/thumbs/", import.meta.url).href;

// манифест data/thumbs.json {"thumbs": {"<id>": "<файл>"}} — лениво, один раз
let thumbsManifestPromise = null;
function thumbsManifest() {
  if (!thumbsManifestPromise) {
    thumbsManifestPromise = fetch(new URL("../data/thumbs.json", import.meta.url).href)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && d.thumbs ? d.thumbs : {}))
      .catch(() => ({}));
  }
  return thumbsManifestPromise;
}

let activeSkinGallery = null;
const thumbCache = new Map(); // "c"+id | "s"+id -> dataURL

export function closeSkinGallery() {
  if (activeSkinGallery) {
    activeSkinGallery();
    activeSkinGallery = null;
  }
}

// Миниатюра = прямой object URL на картинку из zip (helmet* или первая картинка) —
// без canvas/createImageBitmap: меньше звеньев, меньше молчаливых отказов.
async function thumbFromZipBlob(zipBlob) {
  const files = await unzip(zipBlob);
  let name = null;
  for (const n of files.keys()) {
    if (/helmet/i.test(n)) {
      name = n;
      break;
    }
  }
  if (!name) {
    for (const n of files.keys()) {
      if (/\.(png|gif|jpe?g|bmp)$/i.test(n)) {
        name = n;
        break;
      }
    }
  }
  if (!name) {
    return HELMET_PLACEHOLDER;
  }
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const mime = ext === "gif" ? "image/gif" : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "bmp" ? "image/bmp" : "image/png";
  return URL.createObjectURL(new Blob([files.get(name)], { type: mime }));
}

// миниатюра из папки data/thumbs (по манифесту); fallback — сгенерировать из скина
async function folderThumb(id) {
  const manifest = await thumbsManifest();
  const file = manifest[String(id)];
  if (!file) {
    return null;
  }
  const r = await fetch(THUMBS_DIR + file);
  if (!r.ok) {
    return null;
  }
  return URL.createObjectURL(await r.blob());
}

// миниатюра каталога: папка thumbs, иначе — шлем из файла скина
async function catalogThumb(id) {
  if (thumbCache.has("c" + id)) {
    return thumbCache.get("c" + id);
  }
  let url = null;
  try {
    url = await folderThumb(id);
  } catch {
  }
  if (!url) {
    try {
      url = await thumbFromZipBlob(await fetchSkinFile(id));
    } catch (e) {
      console.error("SkinGallery: catalog thumb failed, id=" + id, e);
      url = HELMET_PLACEHOLDER;
    }
  }
  thumbCache.set("c" + id, url);
  return url;
}

// миниатюра сохранённого скина: папка thumbs (как в каталоге),
// запасной вариант — из хранящегося zipBlob
async function savedThumb(rec) {
  if (thumbCache.has("s" + rec.id)) {
    return thumbCache.get("s" + rec.id);
  }
  let url = null;
  try {
    url = await folderThumb(rec.id);
  } catch {
  }
  if (!url && rec.zipBlob) {
    try {
      url = await thumbFromZipBlob(rec.zipBlob);
    } catch (e) {
      console.error("SkinGallery: saved thumb failed, id=" + rec.id, e);
    }
  }
  if (!url && rec.thumbUrl) {
    url = rec.thumbUrl;
  }
  if (!url) {
    url = HELMET_PLACEHOLDER;
  }
  thumbCache.set("s" + rec.id, url);
  return url;
}

export function openSkinGallery(skinManager, catalog) {
  if (activeSkinGallery) {
    return;
  }

  let uiState = { tab: "catalog", sorts: {}, catalogPage: 1, query: {} };
  try {
    const s = window.localStorage.getItem(UI_KEY);
    if (s) {
      uiState = { ...uiState, ...JSON.parse(s) };
    }
  } catch {
  }
  const saveUiState = () => {
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify(uiState));
    } catch {
    }
  };
  // [ключ, подпись, направление по умолчанию] — клик включает, повторный клик меняет направление
  const SORT_TYPES = {
    catalog: [
      ["date", "Date", "desc"], ["downloads", "Downloads", "desc"],
      ["name", "Name", "asc"], ["author", "Author", "asc"],
    ],
    saved: [
      ["saved", "Saved date", "desc"], ["name", "Name", "asc"],
      ["size", "Size", "desc"], ["author", "Author", "asc"],
    ],
  };
  const DEFAULT_SORT = { catalog: "date_desc", saved: "saved_desc" };
  const currentSort = () => uiState.sorts[uiState.tab] || DEFAULT_SORT[uiState.tab];
  let busyId = null;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:500;background:rgba(10,10,12,0.94);overflow:auto;";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:flex-end;gap:6px;padding:18px 20px 0;flex-wrap:wrap;";
  overlay.appendChild(header);

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;gap:12px;align-items:center;padding:10px 24px;flex-wrap:wrap;";
  overlay.appendChild(controls);

  const body = document.createElement("div");
  body.style.cssText = "padding:10px 24px 40px;";
  overlay.appendChild(body);

  const tabCss = "background:#1b1d22;border:1px solid #3a3d45;color:#ccc;padding:8px 18px;border-radius:8px 8px 0 0;cursor:pointer;font-size:14px;";
  const tabs = {};
  for (const [tabId, label] of [["catalog", "Catalog"], ["saved", "Saved"]]) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = tabCss;
    b.onclick = () => { uiState.tab = tabId; saveUiState(); setTabs(); render(); };
    tabs[tabId] = b;
    header.appendChild(b);
  }
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = "background:#22242a;border:1px solid #444;color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:14px;margin-left:auto;";
  closeBtn.onclick = () => closeSkinGallery();
  header.appendChild(closeBtn);

  // ряд кнопок сортировки: клик по типу включает его, повторный клик — меняет направление
  const sortBar = document.createElement("div");
  sortBar.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
  const sortBtns = {};
  const setSort = (val) => {
    uiState.sorts[uiState.tab] = val;
    saveUiState();
    if (uiState.tab === "catalog") {
      uiState.catalogPage = 1;
    }
    render();
  };
  for (const tabId of Object.keys(SORT_TYPES)) {
    sortBtns[tabId] = [];
    for (const [key, label, defDir] of SORT_TYPES[tabId]) {
      const b = document.createElement("button");
      b.dataset.key = key;
      b.textContent = label;
      b.style.cssText = "background:#1b1d22;border:1px solid #3a3d45;color:#ccc;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;";
      b.onclick = () => {
        const cur = currentSort();
        if (cur === key + "_desc") {
          setSort(key + "_asc");
        } else if (cur === key + "_asc") {
          setSort(key + "_desc");
        } else {
          setSort(key + "_" + defDir);
        }
      };
      sortBtns[tabId].push(b);
      sortBar.appendChild(b);
    }
  }
  const refreshSortBtns = () => {
    const cur = currentSort();
    const m = /^(.*)_(asc|desc)$/.exec(cur);
    const curKey = m ? m[1] : null;
    const curDir = m ? m[2] : null;
    for (const [tabId, btns] of Object.entries(sortBtns)) {
      for (const b of btns) {
        const meta = SORT_TYPES[tabId].find((x) => x[0] === b.dataset.key);
        const on = tabId === uiState.tab && b.dataset.key === curKey;
        b.style.display = tabId === uiState.tab ? "" : "none";
        b.style.borderColor = on ? "#6af" : "#3a3d45";
        b.style.color = on ? "#fff" : "#ccc";
        b.textContent = on ? meta[1] + (curDir === "desc" ? " ↓" : " ↑") : meta[1];
      }
    }
  };
  // поисковая строка — во всех вкладках
  const searchWrap = document.createElement("label");
  searchWrap.style.cssText = "display:flex;align-items:center;gap:6px;margin-left:auto;";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search by name...";
  searchInput.style.cssText = "background:#1b1d22;border:1px solid #3a3d45;color:#ccc;padding:6px 8px;border-radius:6px;font-size:13px;min-width:200px;";
  searchInput.oninput = () => {
    uiState.query[uiState.tab] = searchInput.value;
    saveUiState();
    if (uiState.tab === "catalog") {
      uiState.catalogPage = 1;
    }
    render();
  };
  searchWrap.appendChild(searchInput);
  controls.appendChild(sortBar);
  controls.appendChild(searchWrap);

  const setTabs = () => {
    for (const [id, b] of Object.entries(tabs)) {
      const on = id === uiState.tab;
      b.style.cssText = tabCss;
      b.style.background = on ? "#262a31" : "#1b1d22";
      b.style.borderColor = on ? "#5a5e68" : "#3a3d45";
      b.style.color = on ? "#fff" : "#ccc";
      b.style.fontWeight = on ? "bold" : "normal";
    }
    refreshSortBtns();
    searchInput.value = uiState.query[uiState.tab] || "";
  };

  function clearBody() {
    body.innerHTML = "";
  }
  // фиксированная сетка + фиксированные плитки — ничего не прыгает от страницы к странице
  function grid() {
    const g = document.createElement("div");
    g.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,148px);justify-content:center;gap:12px;";
    return g;
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#274;color:#dfe;border:1px solid #4a6;padding:8px 18px;border-radius:6px;font-size:14px;z-index:5;";
    overlay.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  // state: "current" (зелёная рамка); размеры плитки зафиксированы
  function tile(imgSrc, name, author, isCurrent, onClick, statusText = "", onDelete = null) {
    const t = document.createElement("div");
    t.style.cssText = "position:relative;width:148px;height:170px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 8px;border:1px solid " + (isCurrent ? "#5a5" : "#444") + ";border-radius:6px;cursor:pointer;background:#181820;flex:0 0 auto;";
    const img = document.createElement("img");
    img.src = imgSrc;
    img.style.cssText = "width:84px;height:84px;object-fit:contain;image-rendering:pixelated;background:#fff;border-radius:4px;flex:0 0 auto;";
    const n = document.createElement("div");
    n.textContent = name;
    n.style.cssText = "font-size:13px;text-align:center;color:#eee;word-break:break-word;line-height:15px;height:31px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;width:100%;";
    const a = document.createElement("div");
    a.textContent = author || "";
    a.title = author || "";
    a.style.cssText = "font-size:11px;color:#888;text-align:center;max-width:132px;height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 0 auto;";
    t.append(img, n, a);
    if (statusText) {
      const st = document.createElement("div");
      st.textContent = statusText;
      st.style.cssText = "font-size:11px;color:#fc6;height:14px;flex:0 0 auto;";
      t.appendChild(st);
    }
    t.onclick = onClick;
    if (onDelete) {
      const x = document.createElement("button");
      x.textContent = "✕";
      x.title = "Delete";
      x.style.cssText = "position:absolute;top:4px;right:4px;width:20px;height:20px;line-height:1;padding:0;background:#3a2222;border:1px solid #6a3a3a;color:#e99;border-radius:4px;cursor:pointer;font-size:11px;opacity:0;transition:opacity 0.15s;";
      t.onmouseenter = () => { x.style.opacity = "1"; };
      t.onmouseleave = () => { x.style.opacity = "0"; };
      x.onclick = (e) => { e.stopPropagation(); onDelete(); };
      t.appendChild(x);
    }
    return t;
  }
  const mkBtn = (label, onClick, disabled) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "background:#22242a;border:1px solid #444;color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:14px;" + (disabled ? "opacity:0.4;cursor:default;" : "");
    if (!disabled) {
      b.onclick = onClick;
    }
    return b;
  };
  // маленький модал подтверждения; resolve(true) — подтвердил
  const confirmDialog = (text) => {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
      const card = document.createElement("div");
      card.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:320px;display:flex;flex-direction:column;gap:14px;";
      const msg = document.createElement("div");
      msg.textContent = text;
      msg.style.cssText = "color:#eee;font-size:14px;word-break:break-word;";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";
      const mk = (label, danger, fn) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = "background:" + (danger ? "#7a2e2e" : "#22242a") + ";border:1px solid #555;color:#eee;padding:7px 16px;border-radius:6px;cursor:pointer;font-size:13px;";
        b.onclick = fn;
        return b;
      };
      const done = (v) => { box.remove(); resolve(v); };
      row.append(
        mk("Cancel", false, () => done(false)),
        mk("Delete", true, () => done(true))
      );
      card.append(msg, row);
      box.appendChild(card);
      box.onclick = (e) => { if (e.target === box) { done(false); } };
      overlay.appendChild(box);
    });
  };
  const setTileThumb = (t, urlPromise) => {
    urlPromise.then((url) => {
      const im = t.querySelector("img");
      if (im) {
        im.src = url;
      }
    });
  };

  async function renderCatalog() {
    clearBody();
    const g = grid();
    body.appendChild(g);
    const status = document.createElement("div");
    status.style.cssText = "text-align:center;color:#888;font-size:13px;";
    const pager = document.createElement("div");
    pager.style.cssText = "display:flex;gap:14px;align-items:center;justify-content:center;padding:14px;";
    body.appendChild(pager);

    let savedRecs = new Map();
    try {
      savedRecs = new Map((await skinManager.savedSkins()).map((r) => [r.id, r]));
    } catch {
    }
    status.textContent = "Loading...";
    let items = [];
    let totalItems = 0;
    try {
      await catalog._load?.();
      totalItems = catalog.totalItems || 0;
      items = await catalog.getUiPage(uiState.catalogPage, CATALOG_PAGE_SIZE, currentSort(), uiState.query[uiState.tab] || "");
    } catch (e) {
      console.error("SkinGallery: catalog load failed:", e);
      items = [];
    }
    const filteredTotal = catalog.lastTotal ?? totalItems;
    const totalPages = Math.max(1, Math.ceil(filteredTotal / CATALOG_PAGE_SIZE));
    const page = Math.min(Math.max(1, uiState.catalogPage), totalPages);
    uiState.catalogPage = page;
    const rangeFirst = items.length === 0 ? 0 : (page - 1) * CATALOG_PAGE_SIZE + 1;
    const rangeLast = items.length === 0 ? 0 : (page - 1) * CATALOG_PAGE_SIZE + items.length;
    status.textContent = items.length === 0 && page === 1
      ? ((uiState.query[uiState.tab] || "").trim() ? "Nothing found." : "Failed to load catalog (data/skins.* missing?)")
      : `Page ${page}/${totalPages} — ${rangeFirst}–${rangeLast} of ${filteredTotal}`;
    for (const it of items) {
      const savedRec = savedRecs.get(it.id);
      const isCurrent = skinManager.currentId === it.id;
      const t = tile(HELMET_PLACEHOLDER, it.name, it.author, isCurrent, async () => {
        if (busyId !== null) {
          return;
        }
        busyId = it.id;
        renderCatalog();
        let ok = false;
        try {
          if (savedRec) {
            await skinManager.applySaved(savedRec.id);
          } else {
            await skinManager.downloadAndApply(it);
          }
          ok = true;
        } catch {
        }
        busyId = null;
        renderCatalog();
        if (ok) {
          toast(savedRec ? "Skin applied" : "Skin saved and applied");
        }
      }, busyId === it.id ? "Loading..." : "");
      g.appendChild(t);
      setTileThumb(t, catalogThumb(it.id));
    }
    pager.append(
      mkBtn("◀ Prev", () => { if (page > 1) { uiState.catalogPage = page - 1; saveUiState(); renderCatalog(); } }, page <= 1),
      status,
      mkBtn("Next ▶", () => { if (page < totalPages) { uiState.catalogPage = page + 1; saveUiState(); renderCatalog(); } }, page >= totalPages)
    );
  }

  async function renderSaved() {
    clearBody();
    const g = grid();
    body.appendChild(g);
    const sort = currentSort();
    const defTile = tile(HELMET_PLACEHOLDER, "Default", "built-in", skinManager.currentId === "default", async () => {
      await skinManager.applyDefault();
      renderSaved();
    });
    g.appendChild(defTile);
    let saved = [];
    try {
      saved = await skinManager.savedSkins();
    } catch {
    }
    const q = (uiState.query[uiState.tab] || "").trim().toLowerCase();
    if (q) {
      saved = saved.filter((r) => (r.name || "").toLowerCase().includes(q));
    }
    const m = /^(.*)_(asc|desc)$/.exec(sort) || ["", "saved", "desc"];
    const sKey = m[1];
    const sDir = m[2] === "asc" ? 1 : -1;
    const cmpVal = (a, b) => {
      switch (sKey) {
        case "size": return (a.zipBlob?.size || a.zipSize || 0) - (b.zipBlob?.size || b.zipSize || 0);
        case "author": return (a.author || "").localeCompare(b.author || "");
        case "saved": return (a.savedAt || 0) - (b.savedAt || 0);
        default: return (a.name || "").localeCompare(b.name || "");
      }
    };
    saved.sort((a, b) => {
      const d = cmpVal(a, b);
      return (d !== 0 ? d : (a.name || "").localeCompare(b.name || "")) * sDir;
    });
    for (const rec of saved) {
      const t = tile(HELMET_PLACEHOLDER, rec.name, rec.author || "gdmod", skinManager.currentId === rec.id, async () => {
        if (busyId !== null) {
          return;
        }
        busyId = rec.id;
        renderSaved();
        try {
          await skinManager.applySaved(rec.id);
        } catch {
        }
        busyId = null;
        renderSaved();
      }, busyId === rec.id ? "Loading..." : "", async () => {
        if (busyId !== null) {
          return;
        }
        const yes = await confirmDialog(`Delete skin "${rec.name}" from saved?`);
        if (!yes) {
          return;
        }
        let removed = false;
        try {
          await removeSkin(rec.id);
          removed = true;
        } catch (e) {
          console.error("SkinGallery: removeSkin failed, id=" + rec.id, e);
          // запасной путь: перезапись tombstone-ом (put обычно работает там, где delete сломан)
          try {
            await saveSkin({ ...rec, deleted: true });
            removed = true;
          } catch (e2) {
            console.error("SkinGallery: tombstone fallback failed, id=" + rec.id, e2);
            toast("Delete failed: " + (e2 && e2.message ? e2.message : e));
          }
        }
        if (removed) {
          thumbCache.delete("s" + rec.id);
          toast("Skin deleted");
          // удалён текущий скин — сразу переключаемся на дефолт
          if (skinManager.currentId === rec.id) {
            try {
              await skinManager.applyDefault();
            } catch (e) {
              console.error("SkinGallery: applyDefault after delete failed", e);
            }
          }
        }
        renderSaved();
      });
      g.appendChild(t);
      setTileThumb(t, savedThumb(rec));
    }
  }

  const render = () => {
    refreshSortBtns();
    if (uiState.tab === "saved") {
      renderSaved();
    } else {
      renderCatalog();
    }
  };

  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      closeSkinGallery();
    }
  };
  window.addEventListener("keydown", onKey, true);
  const cleanup = () => {
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
  };
  activeSkinGallery = cleanup;
  document.body.appendChild(overlay);
  setTabs();
  render();
}
