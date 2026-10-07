// Галерея левелпаков: вкладки gdmods / GDTR / Saved. Полностью локально —
// метаданные из data/*.json, файлы из data/*.zip (LocalArchive через PackManager).
// Синяя рамка карточки = 100% прохождения (все треки пройдены по рекордам).
import { PACK_SOURCES, countCompletedPerDifficulty } from "./PackManager.js";

const LETTERS = ["E", "M", "H"];
const PAGE = 50;
const UI_KEY = "gd-catalog-ui";

const wrapCss = "position:fixed;inset:0;z-index:500;background:rgba(10,10,12,0.94);overflow:auto;";
// подсветка карточки, выбранной через "Random"
{
  const st = document.createElement("style");
  st.textContent = "@keyframes gdRandomFlash{0%,100%{box-shadow:none}50%{box-shadow:0 0 0 3px #fa4,0 0 18px #fa4}}.gd-random-flash{animation:gdRandomFlash 0.6s ease-in-out 4}";
  document.head.appendChild(st);
}
const btnCss = "background:#22242a;border:1px solid #444;color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:14px;";
const tabCss = "background:#1b1d22;border:1px solid #3a3d45;color:#ccc;padding:8px 18px;border-radius:8px 8px 0 0;cursor:pointer;font-size:14px;";
const tabActiveCss = "background:#262a31;border-color:#5a5e68;color:#fff;font-weight:bold;";
const inputCss = "background:#1b1d22;border:1px solid #3a3d45;color:#ccc;padding:6px 8px;border-radius:6px;font-size:13px;";

let activePackGallery = null;

export function closePackGallery() {
  if (activePackGallery) {
    activePackGallery();
    activePackGallery = null;
  }
}

function recordHasData(packId) {
  const storagePrefix = "gravity_defied_record_store:";
  const packPrefix = "p" + packId + "_";
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(storagePrefix)) {
        continue;
      }
      const key = k.slice(storagePrefix.length);
      if (packId === 0 ? /^[0-9]{2,}$/.test(key) : key.startsWith(packPrefix)) {
        return true;
      }
    }
  } catch {
  }
  return false;
}

export function openPackGallery(menuManager, packMenu) {
  if (activePackGallery) {
    return;
  }
  const pm = packMenu.packManager;

  // ---- состояние UI (вкладка/сортировки/тоггл — персистентно) ----
  let uiState = { tab: "gdmods", sorts: {}, hideDl: {}, hide100: {}, hideImp: {}, pages: {}, query: {} };
  try {
    const s = window.localStorage.getItem(UI_KEY);
    if (s) {
      uiState = { ...uiState, ...JSON.parse(s) };
    }
  } catch {
  }
  if (uiState.tab === "gdtr") {
    uiState.tab = "gdmods";
  }
  const saveUiState = () => {
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify(uiState));
    } catch {
    }
  };
  const TAB_SOURCES = { gdmods: "merged" };
  // [ключ, подпись, направление по умолчанию] — направление переключается кликом
  const SORT_TYPES = {
    gdmods: [
      ["date", "Date", "desc"], ["downloads", "Downloads", "desc"], ["tracks", "Tracks", "desc"],
      ["name", "Name", "asc"], ["author", "Author", "asc"], ["source", "Source", "asc"],
    ],
    saved: [
      ["progress", "% completed", "desc"], ["saved", "Saved date", "desc"],
      ["name", "Name", "asc"], ["tracks", "Tracks", "desc"], ["source", "Source", "asc"],
    ],
  };
  const DEFAULT_SORT = { gdmods: "date_desc", saved: "progress_desc" };
  const currentSort = () => uiState.sorts[uiState.tab] || DEFAULT_SORT[uiState.tab];
  const currentPage = () => uiState.pages[uiState.tab] || 1;
  const setPage = (p) => { uiState.pages[uiState.tab] = p; saveUiState(); };

  let busyId = null;

  // флаги "непроходимый": localStorage gd-pack-flags {keyId: 1}; красная обводка
  const FLAGS_KEY = "gd-pack-flags";
  let packFlags = {};
  try {
    packFlags = JSON.parse(window.localStorage.getItem(FLAGS_KEY) || "{}");
  } catch {
  }
  const isFlagged = (id) => !!packFlags[id];
  const saveFlags = () => {
    try {
      window.localStorage.setItem(FLAGS_KEY, JSON.stringify(packFlags));
    } catch {
    }
  };
  const toggleFlag = (id) => {
    if (packFlags[id]) {
      delete packFlags[id];
    } else {
      packFlags[id] = 1;
    }
    saveFlags();
    render();
  };
  // ленивая чистка: 100%-пак не может быть "непроходимым" — удаляем такую запись
  const purgeFlagIfCompleted = (id, doneAll) => {
    if (doneAll && packFlags[id]) {
      delete packFlags[id];
      saveFlags();
    }
  };

  const overlay = document.createElement("div");
  overlay.style.cssText = wrapCss;

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:flex-end;gap:6px;padding:18px 20px 0;flex-wrap:wrap;";
  overlay.appendChild(header);

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;gap:12px;align-items:center;padding:10px 24px;flex-wrap:wrap;";
  overlay.appendChild(controls);

  const body = document.createElement("div");
  body.style.cssText = "padding:10px 24px 40px;";
  overlay.appendChild(body);

  // вкладки
  const tabs = {};
  for (const [tabId, label] of [["gdmods", "Catalog"], ["saved", "Saved"]]) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = tabCss;
    b.onclick = () => { uiState.tab = tabId; saveUiState(); setTabs(); render(); };
    tabs[tabId] = b;
    header.appendChild(b);
  }
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = btnCss + "margin-left:auto;border-radius:8px;";
  closeBtn.onclick = () => closePackGallery();
  header.appendChild(closeBtn);

  // сортировка
  // ряд кнопок сортировки: клик по типу включает его, повторный клик — меняет направление
  const sortBar = document.createElement("div");
  sortBar.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
  const sortBtns = {};
  const setSort = (val) => {
    uiState.sorts[uiState.tab] = val;
    saveUiState();
    if (uiState.tab !== "saved") {
      setPage(1);
    }
    render();
  };
  for (const tabId of Object.keys(SORT_TYPES)) {
    sortBtns[tabId] = [];
    for (const [key, label, defDir] of SORT_TYPES[tabId]) {
      const b = document.createElement("button");
      b.dataset.key = key;
      b.dataset.def = defDir;
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
        const on = tabId === uiState.tab && b.dataset.key === curKey;
        b.style.display = tabId === uiState.tab ? "" : "none";
        b.style.borderColor = on ? "#6af" : "#3a3d45";
        b.style.color = on ? "#fff" : "#ccc";
        b.textContent = b.dataset.key === curKey && on
          ? SORT_TYPES[tabId].find((s) => s[0] === b.dataset.key)[1] + (curDir === "desc" ? " ↓" : " ↑")
          : SORT_TYPES[tabId].find((s) => s[0] === b.dataset.key)[1];
      }
    }
  };

  // тоггл «скрыть скачанные»
  const hideLabel = document.createElement("label");
  hideLabel.style.cssText = "color:#aaa;font-size:13px;display:flex;align-items:center;gap:6px;";
  const hideChk = document.createElement("input");
  hideChk.type = "checkbox";
  hideChk.onchange = () => {
    uiState.hideDl[uiState.tab] = hideChk.checked;
    saveUiState();
    setPage(1);
    render();
  };
  hideLabel.appendChild(hideChk);
  hideLabel.appendChild(document.createTextNode("Hide downloaded"));

  const mkHideToggle = (key, text) => {
    const label = document.createElement("label");
    label.style.cssText = "color:#aaa;font-size:13px;display:flex;align-items:center;gap:6px;";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.onchange = () => {
      uiState[key][uiState.tab] = chk.checked;
      saveUiState();
      if (uiState.tab !== "saved") {
        setPage(1);
      }
      render();
    };
    label.appendChild(chk);
    label.appendChild(document.createTextNode(text));
    return { label, chk };
  };
  const hide100 = mkHideToggle("hide100", "Hide 100%");
  const hideImp = mkHideToggle("hideImp", "Hide impossible");


  // поисковая строка — во всех вкладках
  // правая группа: Random + поиск — целиком прижата к правому краю;
  // при скрытом Random (вкладка Saved) поиск остаётся на месте
  const rightGroup = document.createElement("div");
  rightGroup.style.cssText = "display:flex;align-items:center;gap:12px;margin-left:auto;";
  const searchWrap = document.createElement("label");
  searchWrap.style.cssText = "display:flex;align-items:center;gap:6px;";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search by name...";
  searchInput.style.cssText = inputCss + "min-width:200px;";
  searchInput.oninput = () => {
    uiState.query[uiState.tab] = searchInput.value;
    saveUiState();
    if (uiState.tab !== "saved") {
      setPage(1);
    }
    render();
  };
  searchWrap.appendChild(searchInput);
  // "Random": показать случайный несохранённый, возможный, непройденный пак
  const randBtn = document.createElement("button");
  randBtn.textContent = "🎲 Random";
  // стиль как у кнопок сортировки; margin-left:auto прижимает связку
  // "кнопка + поиск" к правому краю
  randBtn.style.cssText = "background:#1b1d22;border:1px solid #3a3d45;color:#ccc;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;";
  randBtn.onclick = async () => {
    const source = TAB_SOURCES[uiState.tab];
    const q = uiState.query[uiState.tab] || "";
    const item = await pm.randomPack(source, { query: q });
    if (!item) {
      toast("Nothing to pick — all saved, 100% or impossible");
      return;
    }
    const page = await pm.packPageById(source, item.id, currentSort(), q, PAGE);
    setPage(page);
    await renderCatalog();
    const el = body.querySelector('[data-pack-id="' + item.id + '"]');
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("gd-random-flash");
      setTimeout(() => el.classList.remove("gd-random-flash"), 2600);
    }
  };
  rightGroup.append(randBtn, searchWrap);
  controls.append(sortBar, hideLabel, hide100.label, hideImp.label, rightGroup);

  const setTabs = () => {
    for (const [id, b] of Object.entries(tabs)) {
      b.style.cssText = tabCss;
      if (id === uiState.tab) {
        b.style.background = "#262a31";
        b.style.borderColor = "#5a5e68";
        b.style.color = "#fff";
        b.style.fontWeight = "bold";
      } else {
        b.style.background = "#1b1d22";
        b.style.borderColor = "#3a3d45";
        b.style.color = "#ccc";
        b.style.fontWeight = "normal";
      }
    }
    // набор сортировок под вкладку
    refreshSortBtns();
    searchInput.value = uiState.query[uiState.tab] || "";
    const isCatalog = uiState.tab !== "saved";
    hideLabel.style.display = isCatalog ? "flex" : "none";
    randBtn.style.display = isCatalog ? "" : "none";
    hideChk.checked = !!uiState.hideDl[uiState.tab];
    hide100.label.style.display = "flex";
    hide100.chk.checked = !!uiState.hide100[uiState.tab];
    hideImp.label.style.display = "flex";
    hideImp.chk.checked = !!uiState.hideImp[uiState.tab];
  };

  // ---- рендер helpers (как в прежней версии) ----
  function clearBody() {
    body.innerHTML = "";
  }
  function grid() {
    const g = document.createElement("div");
    g.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,240px);justify-content:center;gap:14px;";
    return g;
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#111;border:1px solid #4a8;color:#ddd;padding:10px 18px;border-radius:8px;z-index:600;";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  // state: "current" (зелёная), "completed" (синяя — 100%), "failed" (красная).
  // metaAtBottom (каталог): всё, кроме названия, прижимается к низу карточки —
  // длинные названия не сдвигают мета-строки соседних блоков.
  function card(name, sub, author, state, onClick, cssExtra = "", statusText = "", rows = null, metaAtBottom = false, onFlag = null, onDelete = null) {
    const t = document.createElement("div");
    t.style.cssText = "position:relative;background:#16181d;border:2px solid #3a3d45;border-radius:10px;padding:12px;cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:120px;" + cssExtra;
    if (state === "current") {
      t.style.borderColor = "#4a8";
    } else if (state === "completed") {
      t.style.borderColor = "#39c";
    } else if (state === "failed") {
      t.style.borderColor = "#a55";
    }
    const n = document.createElement("div");
    n.textContent = name;
    n.style.cssText = "font-weight:bold;font-size:15px;word-break:break-word;color:#eee;";
    t.appendChild(n);
    const metaHolder = metaAtBottom ? (() => {
      const d = document.createElement("div");
      d.style.cssText = "margin-top:auto;display:flex;flex-direction:column;gap:6px;";
      t.appendChild(d);
      return d;
    })() : t;
    if (sub) {
      const s = document.createElement("div");
      s.textContent = sub;
      s.style.cssText = "font-size:12px;color:#999;";
      metaHolder.appendChild(s);
    }
    if (author) {
      const a = document.createElement("div");
      a.textContent = author;
      a.style.cssText = "font-size:12px;color:#777;word-break:break-word;";
      metaHolder.appendChild(a);
    }
    if (statusText) {
      const st = document.createElement("div");
      st.textContent = statusText;
      st.style.cssText = "font-size:12px;color:#fc6;";
      metaHolder.appendChild(st);
    }
    if (rows) {
      const rowsEl = document.createElement("div");
      rowsEl.style.cssText = "margin-top:auto;display:flex;flex-direction:column;gap:4px;";
      (metaAtBottom ? metaHolder : t).appendChild(rowsEl);
      for (const row of rows) {
        const line = document.createElement("div");
        line.style.cssText = "display:flex;align-items:center;gap:6px;";
        const letter = document.createElement("span");
        letter.textContent = row.letter;
        letter.style.cssText = "font-size:11px;color:#bbb;width:14px;";
        const barWrap = document.createElement("div");
        barWrap.style.cssText = "flex:1;height:8px;background:#26282e;border-radius:3px;overflow:hidden;";
        const fill = document.createElement("div");
        const pct = row.total > 0 ? Math.round(row.done / row.total * 100) : 0;
        fill.style.cssText = "height:100%;width:" + pct + "%;background:#4a8;";
        barWrap.appendChild(fill);
        const cnt = document.createElement("span");
        cnt.textContent = row.total > 0 ? row.done + "/" + row.total : String(row.done);
        cnt.style.cssText = "font-size:11px;color:#bbb;width:52px;text-align:right;";
        line.append(letter, barWrap, cnt);
        rowsEl.appendChild(line);
      }
    }
    t.onclick = onClick;
    if (onFlag) {
      const f = document.createElement("button");
      f.textContent = "⚠";
      f.title = "Mark as impossible";
      const active = isFlagged(onFlag.id);
      f.style.cssText = "position:absolute;top:4px;left:4px;width:20px;height:20px;line-height:1;padding:0;background:" + (active ? "#5a2e2e" : "#22242a") + ";border:1px solid " + (active ? "#a55" : "#444") + ";color:" + (active ? "#f88" : "#999") + ";border-radius:4px;cursor:pointer;font-size:11px;opacity:0;transition:opacity 0.15s;";
      t.onmouseenter = () => { f.style.opacity = "1"; };
      t.onmouseleave = () => { f.style.opacity = "0"; };
      f.onclick = (e) => {
        e.stopPropagation();
        toggleFlag(onFlag.id);
      };
      t.appendChild(f);
    }
    if (onDelete) {
      const x = document.createElement("button");
      x.textContent = "✕";
      x.title = "Delete";
      x.style.cssText = "position:absolute;top:4px;right:4px;width:20px;height:20px;line-height:1;padding:0;background:#3a2222;border:1px solid #6a3a3a;color:#e99;border-radius:4px;cursor:pointer;font-size:11px;opacity:0;transition:opacity 0.15s;";
      t.onmouseenter = () => {
        x.style.opacity = "1";
        if (onFlag) {
          const fb = t.querySelector("button[title='Mark as impossible']");
          if (fb) {
            fb.style.opacity = "1";
          }
        }
      };
      t.onmouseleave = () => {
        x.style.opacity = "0";
        if (onFlag) {
          const fb = t.querySelector("button[title='Mark as impossible']");
          if (fb) {
            fb.style.opacity = "0";
          }
        }
      };
      x.onclick = (e) => {
        e.stopPropagation();
        onDelete();
      };
      t.appendChild(x);
    }
    return t;
  }

  // модал удаления пака: "soft" — только пак, "progress" — пак + рекорды, null — отмена
  const confirmDeletePack = (name) => {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
      const cardEl = document.createElement("div");
      cardEl.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:340px;display:flex;flex-direction:column;gap:14px;";
      const msg = document.createElement("div");
      msg.textContent = `Delete pack "${name}"?`;
      msg.style.cssText = "color:#eee;font-size:14px;word-break:break-word;";
      const hint = document.createElement("div");
      hint.textContent = '"Delete pack" keeps records — restored on re-download. "Delete with progress" clears records; the pack starts locked next time.';
      hint.style.cssText = "color:#999;font-size:12px;";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;flex-direction:column;gap:8px;";
      const mk = (label, danger, fn) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = "width:100%;box-sizing:border-box;background:" + (danger ? "#7a2e2e" : "#22242a") + ";border:1px solid " + (danger ? "#a55" : "#555") + ";color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;";
        b.onclick = fn;
        return b;
      };
      const done = (v) => { box.remove(); resolve(v); };
      row.append(
        mk("Delete pack", true, () => done("soft")),
        mk("Delete with progress", true, () => done("progress")),
        mk("Cancel", false, () => done(null))
      );
      cardEl.append(msg, hint, row);
      box.appendChild(cardEl);
      box.onclick = (e) => { if (e.target === box) { done(null); } };
      overlay.appendChild(box);
    });
  };

  // удаление сохранённого пака; mode: "soft" | "progress".
  // Жёсткий режим повторяет игровой "Clear highscore": рекорды выметаются через
  // RecordStore.deleteRecordStore (чистит и кэш RecordStore.opened, и localStorage),
  // gd-progress-<id> удаляется; живое in-memory состояние сбрасывается, чтобы
  // saveProgressToStorage при смене пака не записал старые разблокировки обратно.
  const deleteSavedPack = async (meta, mode) => {
    await pm.deletePack(meta.id);
    if (mode === "progress") {
      try {
        const { RecordStore } = await import("./rms/RecordStore.js");
        const recPrefix = "p" + meta.id + "_";
        for (const name of RecordStore.listRecordStores()) {
          if (name !== "GWTRStates" && name.startsWith(recPrefix)) {
            RecordStore.deleteRecordStore(name);
          }
        }
      } catch (e) {
        console.error("PackGallery: record store cleanup failed, id=" + meta.id, e);
      }
      try {
        window.localStorage.removeItem("gd-progress-" + meta.id);
      } catch {
      }
      if (menuManager.currentPackId === meta.id) {
        menuManager.availableLeagues = 0;
        menuManager.maxAvailableLevel = 1;
        if (menuManager.unlockedTracksByLevel) {
          menuManager.unlockedTracksByLevel[0] = 0;
          menuManager.unlockedTracksByLevel[1] = 0;
          menuManager.unlockedTracksByLevel[2] = -1;
        }
      }
    }
    if (menuManager.currentPackId === meta.id) {
      await packMenu.onCachedPackSelected({ id: 0, name: "Original levels", author: "built-in", levels: "", mrgSize: "", hasGdlvl: false });
    }
    toast(mode === "progress" ? "Pack and progress deleted" : "Pack deleted");
    render();
  };

  const progressOf = (meta) => {
    const done = countCompletedPerDifficulty(meta.id);
    const totals = Array.isArray(meta.levelsBreakdown) ? meta.levelsBreakdown : null;
    const rows = LETTERS.map((letter, i) => ({ letter, done: done[i], total: totals ? totals[i] : 0 }));
    const doneAll = totals !== null && rows.every((r) => r.total > 0 && r.done >= r.total);
    const played = done.reduce((s, n) => s + n, 0);
    const total = totals ? totals.reduce((s, n) => s + n, 0) : 0;
    return { rows, doneAll, pct: total > 0 ? played / total : 0 };
  };

  // Карточка сохранённого пака — используется и во вкладке Saved, и в каталоге
  // для уже скачанных паков (синяя рамка при 100%, кликабельна).
  // showSource — только вкладка Saved: источник строкой мета над автором + удаление
  const savedCard = (meta, currentId, metaAtBottom = false, showSource = false) => {
    const p = progressOf(meta);
    purgeFlagIfCompleted(meta.id, p.doneAll);
    let state = currentId === meta.id ? "current" : p.doneAll ? "completed" : "";
    if (state === "" && isFlagged(meta.id)) {
      state = "failed";
    }
    const srcLabel = PACK_SOURCES[meta.source] || meta.source || "";
    const authorLine = showSource
      ? [meta.author, srcLabel].filter(Boolean).join(" · ")
      : (meta.author || PACK_SOURCES[meta.source || "gdmod"]);
    return card(meta.name, null, authorLine, state, async () => {
      await packMenu.onCachedPackSelected({ id: meta.id, name: meta.name, author: meta.author, levels: "", mrgSize: "", hasGdlvl: false });
      render();
    }, "", "", p.rows, metaAtBottom, p.doneAll ? null : { id: meta.id },
      showSource ? async () => {
        const mode = await confirmDeletePack(meta.name);
        if (mode) {
          await deleteSavedPack(meta, mode);
        }
      } : null);
  };

  const mkBtn = (label, onClick, disabled) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = btnCss + (disabled ? "opacity:0.4;cursor:default;" : "");
    if (!disabled) {
      b.onclick = onClick;
    }
    return b;
  };

  // ---- каталог (gdmods / GDTR) ----
  async function renderCatalog() {
    clearBody();
    const source = TAB_SOURCES[uiState.tab];
    const g = grid();
    body.appendChild(g);
    const status = document.createElement("div");
    status.style.cssText = "text-align:center;color:#888;font-size:13px;";
    const pager = document.createElement("div");
    pager.style.cssText = "display:flex;gap:14px;align-items:center;justify-content:center;padding:14px;";
    body.appendChild(pager);
    status.textContent = "Loading...";
    const currentId = menuManager.currentPackId;
    let data;
    try {
      data = await pm.catalogPage(source, currentPage(), PAGE, {
        sort: currentSort(),
        hideDownloaded: hideChk.checked,
        hideCompleted: hide100.chk.checked,
        hideImpossible: hideImp.chk.checked,
        currentId,
        query: uiState.query[uiState.tab] || "",
      });
    } catch (e) {
      console.error("PackGallery: catalog load failed:", e);
      status.textContent = "Failed to load local catalog (data/" + (source === "gdtr" ? "packs_gdtr" : "packs_gdmod") + ".*): " + (e && e.message ? e.message : e);
      pager.appendChild(status);
      return;
    }
    const { items, totalItems, totalPages, page } = data;
    setPage(page);
    const hiddenCount = hideChk.checked ? 0 : null;
    const rangeFirst = items.length === 0 ? 0 : (page - 1) * PAGE + 1;
    const rangeLast = items.length === 0 ? 0 : (page - 1) * PAGE + items.length;
    status.textContent = items.length === 0
      ? "No packs here yet."
      : `Page ${page}/${totalPages} — ${rangeFirst}–${rangeLast} of ${totalItems}`;
    for (const it of items) {
      if (it.downloaded) {
        // скачанный пак в каталоге = карточка Saved (синяя рамка при 100%)
        const meta = it.cachedMeta
          ? { ...it.cachedMeta, source: it.source, levelsBreakdown: it.cachedMeta.levelsBreakdown || it.levelsBreakdown }
          : { id: it.id, name: it.name, author: it.author, source: it.source, levelsBreakdown: it.levelsBreakdown };
        g.appendChild(savedCard(meta, currentId, true));
        continue;
      }
      const done = countCompletedPerDifficulty(it.id);
      const b = it.levelsBreakdown;
      const doneAll = Array.isArray(b) && b.length === 3 && b.every((n, i) => n > 0 && done[i] >= n);
      purgeFlagIfCompleted(it.id, doneAll);
      // приоритет рамок: текущий (зелёная) > пройден (синяя) > невозможен (красная) —
      // активный пак никогда не выглядит "непроходимым"
      const borderState = currentId === it.id ? "current" : doneAll ? "completed" : isFlagged(it.id) ? "failed" : "";
      const subParts = [it.levels];
      if (it.downloads != null) {
        subParts.push(it.downloads + " dl");
      }
      if (it.addedRaw) {
        subParts.push(it.addedRaw);
      } else if (it.addedTs) {
        subParts.push(new Date(it.addedTs).toISOString().slice(0, 10));
      }
      const sub = subParts.filter(Boolean).join(" · ");
      const busy = busyId === it.id;
      const authorLine = it.author + (it.source === "gdtr" ? " · GDTR" : "");
      const packCardEl = card(it.name, sub, authorLine, borderState, async () => {
        if (busyId !== null) {
          return;
        }
        busyId = it.id;
        renderCatalog();
        let ok = false;
        try {
          await packMenu.downloadAndLoadPack(it);
          ok = true;
        } catch {
        }
        busyId = null;
        renderCatalog();
        if (ok) {
          toast("Saved! Find it in the Saved tab");
        }
      }, "", busy ? "Downloading..." : "", null, true, doneAll ? null : { id: it.id });
      packCardEl.dataset.packId = String(it.id);
      g.appendChild(packCardEl);
    }
    pager.append(
      mkBtn("◀ Prev", () => { if (page > 1) { setPage(page - 1); renderCatalog(); } }, page <= 1),
      status,
      mkBtn("Next ▶", () => { if (page < totalPages) { setPage(page + 1); renderCatalog(); } }, page >= totalPages)
    );
  }

  // ---- Saved ----
  async function renderSaved() {
    clearBody();
    const g = grid();
    body.appendChild(g);
    const currentId = menuManager.currentPackId;
    const sort = currentSort();
    const origTotals = (() => {
      try {
        const lvls = packMenu.originalLoader?.levelNames;
        return lvls ? lvls.map((l) => l.length) : null;
      } catch {
        return null;
      }
    })();
    const origDone = countCompletedPerDifficulty(0);
    const origRows = origTotals
      ? LETTERS.map((letter, i) => ({ letter, done: origDone[i], total: origTotals[i] }))
      : LETTERS.map((letter, i) => ({ letter, done: origDone[i], total: 0 }));
    const origDoneAll = origRows.every((r) => r.total > 0 && r.done >= r.total);
    const origState = currentId === 0 ? "current" : origDoneAll ? "completed" : "";
    const origFlagState = isFlagged(0) ? "failed" : origState;
    g.appendChild(card("Original levels", null, "built-in", origFlagState, async () => {
      await packMenu.onCachedPackSelected({ id: 0, name: "Original levels", author: "built-in", levels: "", mrgSize: "", hasGdlvl: false });
      renderSaved();
    }, "", "", origRows, false, { id: 0 }));
    let saved = [];
    try {
      saved = await pm.savedList();
    } catch {
    }
    const q = (uiState.query[uiState.tab] || "").trim().toLowerCase();
    if (q) {
      saved = saved.filter((m) => (m.name || "").toLowerCase().includes(q));
    }
    const curId = menuManager.currentPackId;
    if (hide100.chk.checked) {
      saved = saved.filter((m) => m.id === curId || !progressOf(m).doneAll);
    }
    if (hideImp.chk.checked) {
      saved = saved.filter((m) => m.id === curId || !isFlagged(m.id));
    }
    // сортировка saved: любой тип в обе стороны
    const m = /^(.*)_(asc|desc)$/.exec(sort) || ["", "saved", "desc"];
    const sKey = m[1];
    const sDir = m[2] === "asc" ? 1 : -1;
    const pcts = new Map(saved.map((x) => [x.id, progressOf(x).pct]));
    const cmpVal = (a, b) => {
      switch (sKey) {
        case "progress": return (pcts.get(a.id) ?? 0) - (pcts.get(b.id) ?? 0);
        case "saved": return (a.savedAt || 0) - (b.savedAt || 0);
        case "tracks": return (a.tracksTotal || 0) - (b.tracksTotal || 0);
        case "source": return ((a.source || "") + (a.name || "")).localeCompare((b.source || "") + (b.name || ""));
        case "author": return (a.author || "").localeCompare(b.author || "");
        default: return (a.name || "").localeCompare(b.name || "");
      }
    };
    saved.sort((a, b) => {
      const d = cmpVal(a, b);
      return (d !== 0 ? d : (a.name || "").localeCompare(b.name || "")) * sDir;
    });
    for (const meta of saved) {
      g.appendChild(savedCard(meta, currentId, false, true));
    }
    if (saved.length === 0) {
      const hint = document.createElement("div");
      hint.textContent = "No saved packs yet — download from the gdmods or GDTR tab.";
      hint.style.cssText = "grid-column:1/-1;text-align:center;color:#888;padding:20px;";
      g.appendChild(hint);
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
      closePackGallery();
    }
  };
  window.addEventListener("keydown", onKey, true);
  const cleanup = () => {
    window.removeEventListener("keydown", onKey, true);
    overlay.remove();
  };
  activePackGallery = cleanup;
  document.body.appendChild(overlay);
  setTabs();
  render();
}
