// Оверлей редактора уровней: холст (пан/зум), точки/старт/финиш drag,
// импорт/экспорт .mrg, валидация, undo/redo. Вход: главное меню -> Level editor.
import { EditorState, clampPointX, surfaceY } from "./EditorState.js";
import { parsePack, serializePack } from "../TrackCodec.js";
import { VisualSettings } from "../VisualSettings.js";
import { Micro } from "../Micro.js";
import { loadDraft, scheduleDraftSave, clearDraft } from "./EditorStore.js";
import { scheduleCustomSave } from "../CustomStore.js";
import { setInfoToastSuppressed } from "../InfoToast.js";

let activeEditor = null;

export function closeEditor() {
  if (activeEditor) {
    activeEditor();
    activeEditor = null;
  }
}

const TEST_PACK_ID = 9000001; // резервный keyId: не пересекается с gdmod/gdtr/custom

export async function openEditorOverlay(initialLeagues = null, ctx = null, opts = null) {
  if (activeEditor) {
    return;
  }
  // customId: редактор открыт из вкладки Custom (T3.4) — автосейв идёт в пак, не в черновик
  const customId = opts && opts.customId != null ? opts.customId : null;
  let state;
  if (initialLeagues) {
    state = EditorState.fromParsed(initialLeagues, (opts && opts.packName) || "Imported pack");
    if (opts && opts.author) {
      state.author = opts.author;
    }
  } else if (customId != null) {
    state = new EditorState();
  } else {
    const draft = await loadDraft();
    if (draft && Array.isArray(draft.leagues) && draft.leagues.length === 3) {
      state = new EditorState(draft.leagues);
      state.packName = draft.packName || "New pack";
      state.author = draft.author || "";
      const dl = Math.min(draft.league || 0, 2);
      state.select(dl, Math.max(0, Math.min(draft.track || 0, (draft.leagues[dl] || []).length - 1)));
    } else {
      state = new EditorState();
    }
  }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:530;background:#0e1013;display:flex;color:#eee;font-size:13px;";

  // левая панель: пак/лиги/треки + импорт/экспорт
  const side = document.createElement("div");
  side.style.cssText = "width:230px;min-width:230px;border-right:1px solid #333;padding:12px;display:flex;flex-direction:column;gap:8px;overflow:auto;";

  const title = document.createElement("div");
  title.textContent = "Level editor";
  title.style.cssText = "font-weight:bold;font-size:15px;";

  const savedInd = document.createElement("div");
  savedInd.style.cssText = "color:#6a8;font-size:11px;min-height:14px;";
  const scheduleSave = () => {
    if (customId != null) {
      scheduleCustomSave(state, customId, (ts) => {
        savedInd.textContent = "Saved " + new Date(ts).toLocaleTimeString();
      });
    } else {
      scheduleDraftSave(state, (ts) => {
        savedInd.textContent = "Draft saved " + new Date(ts).toLocaleTimeString();
      });
    }
  };

  const nameInput = document.createElement("input");
  nameInput.value = state.packName;
  nameInput.placeholder = "Pack name";
  nameInput.style.cssText = "background:#17191d;border:1px solid #3a3d45;color:#eee;padding:6px;border-radius:6px;";
  nameInput.onchange = () => { state.packName = nameInput.value; scheduleSave(); };

  const authorInput = document.createElement("input");
  authorInput.value = state.author || "";
  authorInput.placeholder = "Author (optional)";
  authorInput.style.cssText = "background:#17191d;border:1px solid #3a3d45;color:#eee;padding:6px;border-radius:6px;";
  authorInput.onchange = () => { state.author = authorInput.value; scheduleSave(); };

  const trackList = document.createElement("div");
  trackList.style.cssText = "flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;";

  const btnCss = "background:#22242a;border:1px solid #444;color:#eee;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;";

  const issues = document.createElement("div");
  issues.style.cssText = "color:#f88;font-size:12px;white-space:pre-wrap;";

  // перенос трека: (sl,si) -> вставка перед позицией (tl,ti); ti === -1 = в конец лиги
  const moveTrack = (sl, si, tl, ti) => {
    if (sl === tl && (si === ti || si === ti - 1)) {
      return; // тот же слот или уже сразу перед целью
    }
    const tr = state.leagues[sl] && state.leagues[sl][si];
    if (!tr) {
      return;
    }
    state.leagues[sl].splice(si, 1);
    if (sl === tl && si < ti) {
      ti -= 1;
    }
    if (ti === -1 || ti > state.leagues[tl].length) {
      ti = state.leagues[tl].length;
    }
    state.leagues[tl].splice(ti, 0, tr);
    state.select(tl, ti);
    rebuildTrackList();
    refresh();
  };

  const rebuildTrackList = () => {
    trackList.innerHTML = "";
    for (let l = 0; l < 3; l++) {
      const hdr = document.createElement("div");
      hdr.textContent = ["Easy", "Medium", "Hard"][l] + ` (${state.leagues[l].length})`;
      hdr.style.cssText = "color:#9ab;font-weight:bold;margin-top:6px;border-radius:4px;";
      hdr.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        hdr.style.background = "#2a4a6a";
      });
      hdr.addEventListener("dragleave", () => { hdr.style.background = ""; });
      hdr.addEventListener("drop", (e) => {
        e.preventDefault();
        hdr.style.background = "";
        const src = (e.dataTransfer.getData("text/plain") || "").split(":");
        if (src.length !== 2) {
          return;
        }
        moveTrack(+src[0], +src[1], l, -1);
      });
      trackList.appendChild(hdr);
      state.leagues[l].forEach((tr, i) => {
        const rowEl = document.createElement("div");
        rowEl.style.cssText = "display:flex;gap:2px;align-items:center;border-radius:4px;";
        rowEl.draggable = true;
        if (l === state.league && i === state.track) {
          rowEl.dataset.active = "1"; // для автоскролла
        }
        const b = document.createElement("button");
        b.draggable = false;
        b.textContent = `${"EMH"[l]}${i + 1} ${tr.name || "Track"}`;
        b.style.cssText = btnCss + "flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" + (l === state.league && i === state.track ? "border-color:#6af;color:#fff;" : "");
        b.onclick = () => { state.select(l, i); selSet.clear(); fit(); rebuildTrackList(); refresh(); };
        rowEl.appendChild(b);
        const op = (label, title, fn, disabled) => {
          const o = document.createElement("button");
          o.textContent = label;
          o.title = title;
          o.style.cssText = "background:#22242a;border:1px solid #444;color:#bbb;width:22px;height:22px;padding:0;border-radius:4px;cursor:pointer;font-size:11px;flex:none;" + (disabled ? "opacity:0.25;cursor:default;" : "");
          if (!disabled) {
            o.onclick = (e) => { e.stopPropagation(); fn(); };
          }
          return o;
        };
        rowEl.appendChild(op("⧉", "Duplicate track", () => {
          const copy = JSON.parse(JSON.stringify(tr));
          copy.name = (tr.name || "Track") + " copy";
          state.leagues[l].splice(i + 1, 0, copy);
          state.select(l, i + 1);
          fit();
          rebuildTrackList();
          refresh();
        }));
        rowEl.appendChild(op("✕", "Delete track", () => {
          const total = state.leagues.reduce((s, lg) => s + lg.length, 0);
          if (total <= 1) {
            issues.textContent = "Pack must keep at least one track";
            return;
          }
          if (!window.confirm(`Delete "${tr.name || "Track"}" (league ${l + 1}, #${i + 1})?`)) {
            return;
          }
          state.leagues[l].splice(i, 1);
          state.select(l, Math.max(0, Math.min(i, state.leagues[l].length - 1)));
          rebuildTrackList();
          refresh();
        }));
        // drag-and-drop: перетащить трек на строку = вставить перед ней
        rowEl.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", l + ":" + i);
          e.dataTransfer.effectAllowed = "move";
        });
        rowEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          rowEl.style.background = "#2a4a6a";
        });
        rowEl.addEventListener("dragleave", () => { rowEl.style.background = ""; });
        rowEl.addEventListener("drop", (e) => {
          e.preventDefault();
          rowEl.style.background = "";
          const src = (e.dataTransfer.getData("text/plain") || "").split(":");
          if (src.length !== 2) {
            return;
          }
          moveTrack(+src[0], +src[1], l, i);
        });
        trackList.appendChild(rowEl);
      });
      const add = document.createElement("button");
      add.textContent = "+ add track";
      add.style.cssText = btnCss + "opacity:0.8;";
      add.onclick = () => {
        state.leagues[l].push(EditorState.blankTrack());
        state.select(l, state.leagues[l].length - 1);
        fit();
        rebuildTrackList();
        refresh();
      };
      trackList.appendChild(add);
      // T4.3 шаблоны старта
      const tplRow = document.createElement("div");
      tplRow.style.cssText = "display:flex;gap:2px;padding-left:10px;";
      const tplBtn = (label, title, kind) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.title = title;
        b.style.cssText = btnCss + "flex:1;opacity:0.7;font-size:11px;padding:3px 4px;";
        b.onclick = () => {
          state.leagues[l].push(EditorState.templateTrack(kind));
          state.select(l, state.leagues[l].length - 1);
          fit();
          rebuildTrackList();
          refresh();
        };
        return b;
      };
      tplRow.append(
        tplBtn("▬ flat", "New flat-line track", "flat"),
        tplBtn("⛰ hills", "New gentle-hills track", "hills"),
        tplBtn("∿ sine", "New sine-wave track", "sine"),
      );
      trackList.appendChild(tplRow);
    }
  };

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;";
  const mkBtn = (label, fn, disabled) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = btnCss + (disabled ? "opacity:0.4;" : "");
    if (!disabled) {
      b.onclick = fn;
    }
    return b;
  };

  const doExport = () => {
    // не-UI предупреждение о zero-length сегментах (движок на них падает)
    state.leagues.forEach((lg) => lg.forEach((tr) => {
      for (let i = 1; i < tr.points.length; i++) {
        if (tr.points[i].x === tr.points[i - 1].x && tr.points[i].y === tr.points[i - 1].y) {
          console.warn(`[editor] "${tr.name || "track"}" point ${i + 1} duplicates previous (zero-length segment)`);
        }
      }
    }));
    const data = serializePack(state.leagues.map((lg) => lg.map((tr, i) => ({ ...tr, name: tr.name || "Track " + (i + 1) }))));
    const blob = new Blob([data], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (state.packName.replace(/[^\w\- ]+/g, "_").trim() || "pack") + ".mrg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const doImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mrg";
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) {
        return;
      }
      try {
        const leagues = parsePack(new Uint8Array(await f.arrayBuffer()));
        const st = EditorState.fromParsed(leagues, f.name.replace(/\.mrg$/i, ""));
        st.select(0, 0);
        // подменим состояние на месте, чтобы не пересоздавать оверлей
        state.leagues = st.leagues;
        state.packName = st.packName;
        nameInput.value = st.packName;
        state.select(0, 0);
        rebuildTrackList();
        refresh();
      } catch (e) {
        issues.textContent = "Import failed: " + (e && e.message ? e.message : e);
      }
    };
    input.click();
  };

  row.append(
    mkBtn("Export .mrg", doExport),
    mkBtn("Import .mrg", doImport),
  );
  const row2 = document.createElement("div");
  row2.style.cssText = "display:flex;gap:6px;";
  row2.append(
    mkBtn("Undo", () => { state.undo(); refresh(); }),
    mkBtn("Redo", () => { state.redo(); refresh(); }),
  );
  if (customId == null) {
    row2.appendChild(mkBtn("New pack", async () => {
      if (!window.confirm("Discard the current draft and start a new pack?")) {
        return;
      }
      await clearDraft();
      state.leagues = [[], [], []];
      state.packName = "New pack";
      state.author = "";
      nameInput.value = state.packName;
      authorInput.value = "";
      state.select(0, 0);
      selSet.clear();
      rebuildTrackList();
      refresh();
    }));
  }

  // ---- T2.1 test drive: полноценный заезд через родной пайплайн игры ----
  let testCtx = null;
  let testWatch = null;
  const endTestDrive = () => {
    if (testWatch) {
      clearInterval(testWatch);
      testWatch = null;
    }
    if (!testCtx) {
      return;
    }
    try {
      ctx.packMenu.applyLoader(testCtx.prev.loader, testCtx.prev.id);
    } catch (e) {
      console.error("test drive restore failed", e);
    }
    URL.revokeObjectURL(testCtx.url);
    testCtx = null;
    keysActive = true;
    setInfoToastSuppressed(false);
    // заезд мог сохранить рекорды/прогресс тест-пака — чистим
    try {
      const recPrefix = "gravity_defied_record_store:p" + TEST_PACK_ID + "_";
      const progKey = "gd-progress-" + TEST_PACK_ID;
      const dead = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith(recPrefix) || k === progKey)) {
          dead.push(k);
        }
      }
      dead.forEach((k) => window.localStorage.removeItem(k));
    } catch {
    }
    overlay.style.display = "flex";
    fit();
    refresh();
  };
  const watchTest = () => {
    const mm = ctx.menuManager;
    // конец теста = выход из заезда в меню (Play или Main)
    if (Micro.isInGameMenu && (mm.currentGameMenu === mm.gameMenuPlay || mm.currentGameMenu === mm.gameMenuMain)) {
      const backAtMain = mm.currentGameMenu === mm.gameMenuMain;
      endTestDrive();
      if (backAtMain) {
        // выход из заезда падает в main — показываем Play-меню реального пака
        mm.openMenu(mm.gameMenuPlay, false);
      }
    }
  };
  const runTestDrive = async () => {
    const tr = state.cur();
    if (!tr || !ctx) {
      return;
    }
    // ошибки валидации не блокируют тест-драйв — едем как есть (по запросу)
    try {
      // у лиг разные параметры мотоцикла — едем в копии исходной лиги.
      // ВАЖНО: копии во все 3 лиги — конструктор LevelLoader безусловно грузит
      // трек 1 лиги 0 (loadNextLevel), пустая лига 0 = чтение с битого офсета
      // → "BigInt division by zero".
      const lg = state.league;
      const testTr = { ...tr, name: "Test track" };
      const tmpLeagues = [[testTr], [{ ...testTr }], [{ ...testTr }]];
      const bytes = serializePack(tmpLeagues);
      const url = URL.createObjectURL(new Blob([bytes]));
      const { LevelLoader } = await import("../LevelLoader.js");
      const newLoader = await LevelLoader.create(url);
      testCtx = {
        url,
        prev: { loader: ctx.menuManager.micro.levelLoader, id: ctx.menuManager.currentPackId },
      };
      ctx.packMenu.applyLoader(newLoader, TEST_PACK_ID);
      // прямой старт (как "Start>", но без guard'а разблокировок — лиги
      // тест-пака закрыты и Start> для medium/hard отклоняется меню)
      const mm = ctx.menuManager;
      // селекторы Play-меню в позицию трека — иначе ручной рестарт
      // в заезде читает их дефолты и сбрасывает лигу до 100сс
      mm.settingStringLevel?.setCurrentOptionPos(lg);
      mm.settingsStringTrack?.setCurrentOptionPos(0);
      mm.settingsStringLeague?.setCurrentOptionPos(lg);
      mm.micro.gamePhysics?.disableGenerateInputAI();
      mm.micro.levelLoader?.loadLevel(lg, 0);
      mm.micro.gamePhysics?.setMotoLeague(lg);
      mm.restartRequested = true;
      mm.micro.menuToGame();
      overlay.style.display = "none";
      keysActive = false;
      setInfoToastSuppressed(true);
      testWatch = setInterval(watchTest, 400);
    } catch (e) {
      issues.textContent = "Test drive failed: " + (e && e.message ? e.message : e);
      if (testCtx) {
        URL.revokeObjectURL(testCtx.url);
        testCtx = null;
      }
    }
  };
  const testBtn = mkBtn("Test drive", runTestDrive, !ctx);
  testBtn.style.cssText += "background:#274;";

  // ---- T4.2 пакетная валидация: все трассы пака, клик по строке — переход ----
  const checkBtn = mkBtn("Check pack", () => {
    const problems = [];
    for (let l = 0; l < 3; l++) {
      state.leagues[l].forEach((tr, i) => {
        const iss = state.validate(tr);
        if (iss.length) {
          problems.push({ l, i, name: tr.name || "Track", issues: iss });
        }
      });
    }
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
    const cardEl = document.createElement("div");
    cardEl.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:440px;max-height:70vh;overflow:auto;display:flex;flex-direction:column;gap:10px;";
    const msg = document.createElement("div");
    msg.textContent = problems.length === 0 ? "✔ All tracks are valid" : problems.length + " track(s) with issues:";
    msg.style.cssText = "color:#eee;font-size:14px;font-weight:bold;";
    cardEl.appendChild(msg);
    for (const pr of problems) {
      const rowEl = document.createElement("div");
      rowEl.style.cssText = "border:1px solid #533;border-radius:6px;padding:8px 10px;cursor:pointer;";
      const head = document.createElement("div");
      head.textContent = ["Easy", "Medium", "Hard"][pr.l] + " " + (pr.i + 1) + ". " + pr.name;
      head.style.cssText = "color:#fc6;font-size:13px;";
      const bodyEl = document.createElement("div");
      bodyEl.textContent = pr.issues.join("; ");
      bodyEl.style.cssText = "color:#f88;font-size:12px;white-space:pre-wrap;";
      rowEl.append(head, bodyEl);
      rowEl.onmouseenter = () => { rowEl.style.background = "#262a31"; };
      rowEl.onmouseleave = () => { rowEl.style.background = ""; };
      rowEl.onclick = () => {
        box.remove();
        state.select(pr.l, pr.i);
        rebuildTrackList();
        refresh();
        fit();
        const activeRow = trackList.querySelector("[data-active='1']");
        if (activeRow) {
          activeRow.scrollIntoView({ block: "nearest" });
        }
      };
      cardEl.appendChild(rowEl);
    }
    const closeRow = document.createElement("button");
    closeRow.textContent = "Close";
    closeRow.style.cssText = btnCss;
    closeRow.onclick = () => box.remove();
    cardEl.appendChild(closeRow);
    box.appendChild(cardEl);
    box.onclick = (e) => {
      if (e.target === box) {
        box.remove();
      }
    };
    overlay.appendChild(box);
  });

  side.append(title, savedInd, nameInput, authorInput, trackList, row, row2, testBtn, checkBtn, issues);

  // центр: холст
  const main = document.createElement("div");
  main.style.cssText = "flex:1;display:flex;flex-direction:column;";
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid #333;flex-wrap:wrap;";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "flex:1;width:100%;cursor:crosshair;";
  const minimap = document.createElement("canvas");
  minimap.style.cssText = "width:100%;height:56px;flex:none;border-top:1px solid #333;cursor:pointer;";
  main.append(toolbar, canvas, minimap);
  overlay.append(side, main);

  const propLabel = document.createElement("span");
  propLabel.style.cssText = "color:#aaa;";
  const mkInput = (w) => {
    const i = document.createElement("input");
    i.style.cssText = `width:${w}px;background:#17191d;border:1px solid #3a3d45;color:#eee;padding:4px;border-radius:4px;font-size:12px;`;
    return i;
  };
  const pxInput = mkInput(64);
  const pyInput = mkInput(64);
  const snapChk = document.createElement("input");
  snapChk.type = "checkbox";
  const snapLbl = document.createElement("label");
  snapLbl.style.cssText = "display:flex;align-items:center;gap:4px;color:#aaa;";
  snapLbl.append(snapChk, document.createTextNode("Snap to grid (8px)"));
  const hint = document.createElement("span");
  hint.style.cssText = "color:#667;margin-left:auto;";
  hint.textContent = "click: add point | drag: move | wheel: zoom | right/middle-drag: pan | Del: remove | F: fit | H: help";
  toolbar.append(propLabel, pxInput, pyInput, snapLbl, hint);

  // ---- viewport ----
  const view = { x: 0, y: 0, zoom: 1 }; // world px -> screen
  const toScreen = (p) => ({ x: (p.x - view.x) * view.zoom + canvas.clientWidth / 2, y: canvas.clientHeight / 2 - (p.y - view.y) * view.zoom });
  const toWorld = (s) => ({ x: (s.x - canvas.clientWidth / 2) / view.zoom + view.x, y: (canvas.clientHeight / 2 - s.y) / view.zoom + view.y });

  const fit = () => {
    const t = state.cur() || EditorState.blankTrack();
    const xs = t.points.map((p) => p.x);
    const minX = Math.min(...xs, t.start.x, t.finish.x) - 40;
    const maxX = Math.max(...xs, t.start.x, t.finish.x) + 40;
    const minY = Math.min(...t.points.map((p) => p.y), t.start.y, t.finish.y) - 60;
    const maxY = Math.max(...t.points.map((p) => p.y), t.start.y, t.finish.y) + 60;
    view.x = (minX + maxX) / 2;
    view.y = (minY + maxY) / 2;
    view.zoom = Math.min(canvas.clientWidth / (maxX - minX), canvas.clientHeight / (maxY - minY)) * 0.9 || 1;
  };

  // индексы флаговых точек — как в LevelLoader.initPoints
  const flagIndices = (tr) => {
    let sfp = 0, ffp = 0;
    for (let i = 0; i < tr.points.length; i++) {
      if (sfp === 0 && tr.points[i].x > tr.start.x) sfp = i + 1;
      if (ffp === 0 && tr.points[i].x > tr.finish.x) ffp = i;
    }
    return { sfp, ffp };
  };

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0e1013";
    ctx.fillRect(0, 0, w, h);
    const t = state.cur();
    if (!t) {
      ctx.fillStyle = "#667";
      ctx.fillText("Select or add a track", 20, 30);
      return;
    }
    // фиксированные цвета редактора — не зависят от Visuals игры
    const line = [232, 235, 242];
    const dark = [110, 116, 130];
    const P = t.points.map(toScreen);
    // grid (только при включённом снапе)
    if (snapChk.checked) {
      const step = 8;
      const tl = toWorld({ x: 0, y: 0 });
      const br = toWorld({ x: w, y: h });
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      for (let gx = Math.floor(tl.x / step) * step; gx < br.x; gx += step) {
        const s = toScreen({ x: gx, y: 0 }).x;
        ctx.moveTo(s, 0); ctx.lineTo(s, h);
      }
      for (let gy = Math.floor(br.y / step) * step; gy < tl.y; gy += step) {
        const s = toScreen({ x: 0, y: gy }).y;
        ctx.moveTo(0, s); ctx.lineTo(w, s);
      }
      ctx.stroke();
    }
    // трасса
    ctx.lineWidth = Math.max(1.5, view.zoom);
    ctx.strokeStyle = `rgb(${line[0]},${line[1]},${line[2]})`;
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgb(${dark[0]},${dark[1]},${dark[2]})`;
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + 2) : ctx.moveTo(p.x, p.y + 2)));
    ctx.stroke();
    // флаги на трассе (старт/финиш — пороги: флажки на выбранных точках)
    const { sfp, ffp } = flagIndices(t);
    const flagAt = (idx, color) => {
      if (idx <= 0 || idx >= t.points.length) return;
      const p = toScreen(t.points[idx]);
      const kk = view.zoom; // пропорционально зуму, база крупнее прежнего (было 26px фикс)
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 2.2 * kk);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 34 * kk);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 34 * kk);
      ctx.lineTo(p.x + 18 * kk, p.y - 28 * kk);
      ctx.lineTo(p.x, p.y - 22 * kk);
      ctx.fill();
    };
    flagAt(sfp, sel === "startflag" ? "#fa4" : "#4af");
    flagAt(ffp, sel === "finflag" ? "#fa4" : "#4a6");
    // точки
    P.forEach((p, i) => {
      const inSet = selSet.has(i);
      const active = i === sel || inSet;
      ctx.fillStyle = active ? (i === sel ? "#fa4" : "#fc6") : "#dde";
      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    // рамка выделения (Shift+drag)
    if (drag && drag.kind === "marquee") {
      const rx = Math.min(drag.sx, drag.cx), ry = Math.min(drag.sy, drag.cy);
      const rw = Math.abs(drag.cx - drag.sx), rh = Math.abs(drag.cy - drag.sy);
      ctx.fillStyle = "rgba(120,190,255,0.10)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "rgba(120,190,255,0.9)";
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }
    // старт: байк с байкером, габариты 1:1 со спрайтами игры
    // (колесо Ø15 → r7.5, база 28, шлем 8×8, суммарно ~38×35 мир. px;
    //  центры колёс на уровне точки спавна → нижний край = +7.5 ниже неё)
    const s = toScreen(t.start);
    const k = view.zoom;
    const X = (dx) => s.x + dx * k;
    const Y = (dy) => s.y + dy * k;
    const bikeCol = sel === "start" ? "#fa4" : "#4af";
    const riderCol = "rgba(232,240,255,0.95)";
    ctx.globalAlpha = 0.95;
    // колёса
    ctx.strokeStyle = bikeCol;
    ctx.lineWidth = Math.max(1, 1.5 * k);
    for (const wx of [-14, 14]) {
      ctx.beginPath();
      ctx.arc(X(wx), Y(0), Math.max(7.5 * k, 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    // рама
    ctx.lineWidth = Math.max(1, 1.2 * k);
    ctx.beginPath();
    ctx.moveTo(X(-14), Y(0));    // задняя втулка → седло
    ctx.lineTo(X(-4), Y(-9));
    ctx.lineTo(X(10), Y(-7));    // → рулевая колонка
    ctx.moveTo(X(-4), Y(-9));    // седло → каретка → задняя втулка
    ctx.lineTo(X(0), Y(2));
    ctx.lineTo(X(-14), Y(0));
    ctx.moveTo(X(0), Y(2));      // каретка → рулевая колонка
    ctx.lineTo(X(10), Y(-7));
    ctx.moveTo(X(10), Y(-7));    // вилка → передняя втулка
    ctx.lineTo(X(14), Y(0));
    ctx.moveTo(X(10), Y(-7));    // руль
    ctx.lineTo(X(14), Y(-11));
    ctx.stroke();
    // байкер в нейтральной позе: корпус вертикально
    ctx.strokeStyle = riderCol;
    ctx.lineWidth = Math.max(1, 1.3 * k);
    ctx.beginPath();
    ctx.moveTo(X(-3), Y(-9));    // бёдра на седле → плечи строго вверх
    ctx.lineTo(X(-1), Y(-19));
    ctx.moveTo(X(-1), Y(-19));   // руки на руль
    ctx.lineTo(X(13), Y(-11));
    ctx.moveTo(X(-3), Y(-9));    // нога на каретку
    ctx.lineTo(X(0), Y(2));
    ctx.stroke();
    // шлем (спрайт 8×8) над плечами
    ctx.fillStyle = riderCol;
    ctx.beginPath();
    ctx.arc(X(0), Y(-22.5), Math.max(4 * k, 1.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    // issues on canvas markers
    state.validate(t).slice(0, 3).forEach((msg, i) => {
      ctx.fillStyle = "#f88";
      ctx.fillText(msg, 12, 20 + i * 14);
    });
    drawMinimap();
  };

  // ---- T4.1 миникарта: вся трасса + рамка вьюпорта; клик — прыжок к месту ----
  let mmap = null; // последний маппинг мировых->миникарта координат
  const drawMinimap = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = minimap.clientWidth;
    const h = 56;
    if (minimap.width !== Math.round(w * dpr) || minimap.height !== Math.round(h * dpr)) {
      minimap.width = Math.round(w * dpr);
      minimap.height = Math.round(h * dpr);
    }
    const mctx = minimap.getContext("2d");
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.fillStyle = "#121418";
    mctx.fillRect(0, 0, w, h);
    const t = state.cur();
    if (!t || t.points.length === 0) {
      mmap = null;
      return;
    }
    const xs = t.points.map((p) => p.x).concat([t.start.x, t.finish.x]);
    const ys = t.points.map((p) => p.y).concat([t.start.y, t.finish.y]);
    const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30;
    const minY = Math.min(...ys) - 30, maxY = Math.max(...ys) + 30;
    const s = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1)) * 0.9;
    const ox = (w - (maxX - minX) * s) / 2;
    const oy = (h - (maxY - minY) * s) / 2;
    mmap = { minX, minY, s, ox, oy, w, h };
    const M = (p) => ({ x: ox + (p.x - minX) * s, y: h - oy - (p.y - minY) * s });
    // трасса — фиксированный цвет редактора
    mctx.strokeStyle = "rgb(232,235,242)";
    mctx.lineWidth = 1.2;
    mctx.beginPath();
    t.points.forEach((p, i) => {
      const q = M(p);
      i ? mctx.lineTo(q.x, q.y) : mctx.moveTo(q.x, q.y);
    });
    mctx.stroke();
    // старт (точка) и финиш (шток)
    const sp = M(t.start);
    mctx.fillStyle = "#4af";
    mctx.beginPath();
    mctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
    mctx.fill();
    const fp = M({ x: t.finish.x, y: surfaceY(t, t.finish.x) });
    mctx.strokeStyle = "#4a6";
    mctx.beginPath();
    mctx.moveTo(fp.x, fp.y);
    mctx.lineTo(fp.x, fp.y - 10);
    mctx.stroke();
    // рамка вьюпорта
    const tl = toWorld({ x: 0, y: 0 });
    const br = toWorld({ x: canvas.clientWidth, y: canvas.clientHeight });
    const a = M(tl), b = M(br);
    mctx.strokeStyle = "rgba(255,255,255,0.35)";
    mctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  };

  minimap.addEventListener("mousedown", (e) => {
    const t = state.cur();
    if (!t || !mmap) {
      return;
    }
    const rect = minimap.getBoundingClientRect();
    view.x = mmap.minX + (e.clientX - rect.left - mmap.ox) / mmap.s;
    view.y = mmap.minY + (mmap.h - mmap.oy - (e.clientY - rect.top)) / mmap.s;
    draw();
  });

  const refresh = () => {
    scheduleSave();
    issues.textContent = state.validate().join("\n");
    rebuildProps();
    draw();
  };

  // ---- selection & props ----
  let sel = -1; // index точки; "start"/"finish"/"startflag"/"finflag" — маркеры
  let selIdx = -1; // index точки для флажков
  let selSet = new Set(); // мультивыделение точек (Ctrl/Shift + ЛКМ)
  let drag = null; // {kind:"point"|"start"|"finish"|"pan", ...}
  const rebuildProps = () => {
    const t = state.cur();
    if (!t) {
      propLabel.textContent = "no track";
      return;
    }
    let target = null;
    if (sel === "start") { target = t.start; propLabel.textContent = "start:"; }
    else if (sel === "finish") { target = t.finish; propLabel.textContent = "finish:"; }
    else if ((sel === "startflag" || sel === "finflag") && t.points[selIdx]) {
      target = t.points[selIdx];
      propLabel.textContent = `${sel === "startflag" ? "start" : "finish"} flag (point ${selIdx + 1}):`;
    }
    else if (selSet.size > 1) { propLabel.textContent = selSet.size + " points selected"; pxInput.value = ""; pyInput.value = ""; return; }
    else if (sel >= 0 && t.points[sel]) { target = t.points[sel]; propLabel.textContent = `point ${sel + 1}:`; }
    else { propLabel.textContent = "—"; pxInput.value = ""; pyInput.value = ""; return; }
    pxInput.value = target.x.toFixed(1);
    pyInput.value = target.y.toFixed(1);
  };
  const commitProp = () => {
    const t = state.cur();
    if (!t) return;
    let target = null;
    if (sel === "start") target = t.start;
    else if (sel === "finish") target = t.finish;
    else if (sel >= 0) target = t.points[sel];
    if (!target) return;
    const nx = parseFloat(pxInput.value);
    const ny = parseFloat(pyInput.value);
    if (isNaN(nx) || isNaN(ny)) return;
    state.snapshot();
    const spanLo = t.points[0] ? t.points[0].x : -Infinity;
    const spanHi = t.points.length ? t.points[t.points.length - 1].x : Infinity;
    if (sel === "start") {
      target.x = Math.min(Math.max(nx, spanLo + 0.001), Math.min(spanHi - 0.001, t.finish.x - 0.001));
      target.y = ny;
    } else if (sel === "finish") {
      target.x = Math.min(Math.max(nx, Math.max(spanLo + 0.001, t.start.x + 0.001)), spanHi - 0.001);
      target.y = 0;
    } else {
      target.x = clampPointX(t, sel, nx);
      target.y = ny;
    }
    refresh();
  };
  pxInput.onchange = commitProp;
  pyInput.onchange = commitProp;

  // ---- mouse ----
  const evPos = (e) => ({ x: e.offsetX, y: e.offsetY });
  const hit = (sp, pointsFirst = false) => {
    const t = state.cur();
    if (!t) return null;
    // сначала маркеры/флажки (иначе точки трассы перехватывают клики по ним);
    // pointsFirst — для Ctrl/Shift+клика мультивыделения точки важнее флажков
    const s = toScreen(t.start);
    if (Math.abs(sp.x - s.x) < Math.max(22 * view.zoom, 10) && sp.y > s.y - 28 * view.zoom - 3 && sp.y < s.y + 8.5 * view.zoom + 2) return { kind: "start" };
    const { sfp, ffp } = flagIndices(t);
    // хит-тест по всему древку с полотнищем, а не только по базовой точке
    const segDist = (a, b) => {
      const vx = b.x - a.x, vy = b.y - a.y;
      const len2 = vx * vx + vy * vy || 1;
      const k = Math.min(1, Math.max(0, ((sp.x - a.x) * vx + (sp.y - a.y) * vy) / len2));
      return Math.hypot(sp.x - (a.x + k * vx), sp.y - (a.y + k * vy));
    };
    const flagHit = (idx) => {
      if (idx <= 0 || idx >= t.points.length) return false;
      const bp = toScreen(t.points[idx]);
      const kk = view.zoom;
      const top = { x: bp.x, y: bp.y - 34 * kk };
      if (segDist(bp, top) < Math.max(6, 10 * kk)) return true;
      // полотнище: треугольник примерно (0,-34)-(18,-28)-(0,-22)
      return sp.x >= bp.x - 2 * kk && sp.x <= bp.x + 20 * kk && sp.y >= bp.y - 36 * kk && sp.y <= bp.y - 20 * kk;
    };
    const flagCheck = () => {
      if (flagHit(sfp)) return { kind: "startflag", idx: sfp };
      if (flagHit(ffp)) return { kind: "finflag", idx: ffp };
      return null;
    };
    const pointCheck = () => {
      for (let i = 0; i < t.points.length; i++) {
        const p = toScreen(t.points[i]);
        if (Math.hypot(p.x - sp.x, p.y - sp.y) < 8) return { kind: "point", idx: i };
      }
      return null;
    };
    if (pointsFirst) {
      return pointCheck() || flagCheck();
    }
    return flagCheck() || pointCheck();
  };
  const snapIf = (wp) => {
    if (!snapChk.checked) return wp;
    return { x: Math.round(wp.x / 8) * 8, y: Math.round(wp.y / 8) * 8 };
  };
  canvas.addEventListener("mousedown", (e) => {
    const sp = evPos(e);
    if (e.button === 1 || e.button === 2) {
      drag = { kind: "pan", sx: sp.x, sy: sp.y, vx: view.x, vy: view.y };
      e.preventDefault();
      return;
    }
    const h = hit(sp, e.ctrlKey || e.metaKey);
    const t = state.ensureTrack();
    if (e.shiftKey) {
      // Shift+ЛКМ (зажим) — рамочное выделение; Ctrl+Shift — добавить к выделенному
      drag = { kind: "marquee", sx: sp.x, sy: sp.y, cx: sp.x, cy: sp.y, add: e.ctrlKey || e.metaKey };
      refresh();
      return;
    }
    if (h && h.kind === "point" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+ЛКМ — тоггл точки в мультивыделении
      if (selSet.has(h.idx)) {
        selSet.delete(h.idx);
      } else {
        selSet.add(h.idx);
      }
      sel = selSet.size ? h.idx : -1;
      drag = null;
      refresh();
      return;
    }
    if (h) {
      sel = h.kind === "point" ? h.idx : h.kind;
      selIdx = h.idx ?? -1;
      if (h.kind === "point" && selSet.has(h.idx) && selSet.size > 1) {
        // тащим любую выделенную — двигается вся группа
        drag = {
          kind: "point", idx: h.idx, multi: true,
          ox: t.points[h.idx].x, oy: t.points[h.idx].y,
          orig: new Map([...selSet].map((i) => [i, { x: t.points[i].x, y: t.points[i].y }])),
        };
      } else {
        if (h.kind === "point") {
          selSet = new Set([h.idx]);
        } else {
          selSet.clear();
        }
        drag = { kind: h.kind, idx: h.idx };
      }
    } else {
      // вставка в конец или в сегмент по двойному клику; одиночный клик — селект
      sel = -1;
      selSet.clear();
      drag = { kind: "maybe", sx: sp.x, sy: sp.y, moved: false, wx: toWorld(sp).x, wy: toWorld(sp).y, ctrl: e.ctrlKey || e.metaKey };
    }
    refresh();
  });
  // ONECLICK_INSERT: single left click anywhere inserts a point
  const insertPointAt = (wp) => {
    const tr = state.ensureTrack();
    state.snapshot();
    let idx = tr.points.findIndex((pt) => pt.x > wp.x);
    if (idx === -1) { idx = tr.points.length; }
    const prevX = idx > 0 ? tr.points[idx - 1].x : -Infinity;
    const nextX = idx < tr.points.length ? tr.points[idx].x : Infinity;
    const nx = Math.min(Math.max(wp.x, prevX + 0.001), nextX - 0.001);
    tr.points.splice(idx, 0, { x: nx, y: wp.y });
    sel = idx;
    selIdx = -1;
    selSet = new Set([idx]);
    refresh();
  };

  const onMove = (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (drag.kind === "pan") {
      view.x = drag.vx - (sp.x - drag.sx) / view.zoom;
      view.y = drag.vy + (sp.y - drag.sy) / view.zoom;
      draw();
      return;
    }
    const t = state.cur();
    if (!t) return;
    if (drag.kind === "marquee") {
      drag.cx = sp.x;
      drag.cy = sp.y;
      draw();
      return;
    }
    if (drag.kind === "maybe") {
      if (Math.hypot(sp.x - drag.sx, sp.y - drag.sy) > 4) drag.moved = true;
      return;
    }
    if (!drag.snapped) { state.snapshot(); drag.snapped = true; }
    const wp = snapIf(toWorld(sp));
    const spanLo = t.points[0] ? t.points[0].x : -Infinity;
    const spanHi = t.points.length ? t.points[t.points.length - 1].x : Infinity;
    if (drag.kind === "point" && drag.multi) {
      const dx = wp.x - drag.ox, dy = wp.y - drag.oy;
      // ascending-фиксап: ранее сдвинутые точки становятся соседями для последующих
      [...selSet].sort((a, b) => a - b).forEach((idx) => {
        const o = drag.orig.get(idx);
        if (!o) {
          return;
        }
        t.points[idx].x = clampPointX(t, idx, o.x + dx);
        t.points[idx].y = o.y + dy;
      });
    } else if (drag.kind === "point") {
      t.points[drag.idx].x = clampPointX(t, drag.idx, wp.x);
      t.points[drag.idx].y = wp.y;
    } else if (drag.kind === "start") {
      t.start.x = Math.min(Math.max(wp.x, spanLo + 0.001), Math.min(spanHi - 0.001, t.finish.x - 0.001));
      t.start.y = wp.y;
    } else if (drag.kind === "finish") {
      t.finish.x = Math.min(Math.max(wp.x, Math.max(spanLo + 0.001, t.start.x + 0.001)), spanHi - 0.001);
      t.finish.y = 0;
    } else if (drag.kind === "startflag" || drag.kind === "finflag") {
      // ближайшая по X точка — флаг встанет на неё
      let best = drag.idx, bestD = Infinity;
      t.points.forEach((pt, i) => {
        const d = Math.abs(pt.x - wp.x);
        if (d < bestD) { bestD = d; best = i; }
      });
      const prevX = best > 0 ? t.points[best - 1].x : spanLo;
      if (drag.kind === "startflag") {
        // только порог X; Y точки спавна сохраняется
        t.start.x = Math.min(prevX + 0.001, t.finish.x - 0.001);
      } else {
        t.finish.x = Math.min(Math.max(prevX + 0.001, t.start.x + 0.001), spanHi - 0.001);
        t.finish.y = 0;
      }
    }
    refresh();
  };

  window.addEventListener("mousemove", onMove);
  const onUp = (e) => {
    if (drag && drag.kind === "marquee") {
      const x0 = Math.min(drag.sx, drag.cx), x1 = Math.max(drag.sx, drag.cx);
      const y0 = Math.min(drag.sy, drag.cy), y1 = Math.max(drag.sy, drag.cy);
      const t = state.cur();
      const next = drag.add ? new Set(selSet) : new Set();
      let last = -1;
      if (t) {
        t.points.forEach((p, i) => {
          const q = toScreen(p);
          if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) {
            next.add(i);
            last = i;
          }
        });
      }
      const prevSel = sel;
      selSet = next;
      sel = last !== -1 ? last : (drag.add ? prevSel : -1);
      drag = null;
      refresh();
      return;
    }
    if (drag && drag.kind === "maybe" && !drag.moved && !drag.ctrl && e.target === canvas) {
      const rect = canvas.getBoundingClientRect();
      const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (Math.hypot(sp.x - drag.sx, sp.y - drag.sy) <= 4) {
        insertPointAt(snapIf({ x: drag.wx, y: drag.wy }));
      }
    }
    drag = null;
  };
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const before = toWorld(sp);
    view.zoom = Math.min(8, Math.max(0.05, view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const after = toWorld(sp);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    draw();
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  let keysActive = true;
  // ---- T4.4 help-оверлей со списком горячих клавиш ----
  let helpBox = null;
  const toggleHelp = () => {
    if (helpBox) {
      helpBox.remove();
      helpBox = null;
      return;
    }
    helpBox = document.createElement("div");
    helpBox.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
    const cardEl = document.createElement("div");
    cardEl.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 22px;max-width:420px;display:flex;flex-direction:column;gap:6px;";
    const head = document.createElement("div");
    head.textContent = "Level editor — controls";
    head.style.cssText = "color:#eee;font-size:14px;font-weight:bold;margin-bottom:4px;";
    cardEl.appendChild(head);
    const lines = [
      "Left click empty space — add point",
      "Drag point / start / finish / flags — move",
      "Right or middle drag — pan",
      "Wheel — zoom to cursor",
      "Ctrl+click point — toggle it in the selection",
      "Shift+drag — box-select points (rect)",
      "Ctrl+Shift+drag — add box-selected points to current",
      "Drag a selected point — move whole selection",
      "Delete — remove selected point(s)",
      "Ctrl+Z / Ctrl+Y — undo / redo",
      "F — fit track to view",
      "H or ? — this help",
      "Esc — close editor",
    ];
    for (const ln of lines) {
      const d = document.createElement("div");
      d.textContent = ln;
      d.style.cssText = "color:#aab;font-size:13px;";
      cardEl.appendChild(d);
    }
    const closeRow = document.createElement("button");
    closeRow.textContent = "Close";
    closeRow.style.cssText = btnCss + "margin-top:8px;";
    closeRow.onclick = () => toggleHelp();
    cardEl.appendChild(closeRow);
    helpBox.appendChild(cardEl);
    helpBox.onclick = (e) => {
      if (e.target === helpBox) {
        toggleHelp();
      }
    };
    overlay.appendChild(helpBox);
  };

  const onKey = (e) => {
    if (!keysActive) {
      return; // во время test drive клавиши принадлежат игре
    }
    e.stopPropagation();
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
      return; // печатаем в полях свойств/имени
    }
    if (e.key === "Escape") {
      if (helpBox) {
        toggleHelp();
      } else {
        closeEditor();
      }
      return;
    }
    if (e.code === "KeyT" && ctx) {
      void runTestDrive();
      return;
    }
    // e.code — не зависит от раскладки (KeyH вместо "h"/"р")
    if (e.code === "KeyH" || e.key === "?") {
      toggleHelp();
      return;
    }
    if (e.code === "KeyF") {
      fit();
      draw();
      return;
    }
    if (e.code === "Delete" && (selSet.size > 0 || sel >= 0)) {
      const t = state.cur();
      const idxs = selSet.size > 0
        ? [...selSet].sort((a, b) => b - a)
        : (typeof sel === "number" && sel >= 0 ? [sel] : []);
      if (t && idxs.length && t.points.length - idxs.length >= 3) {
        state.snapshot();
        for (const i of idxs) {
          t.points.splice(i, 1);
        }
        sel = -1;
        selSet.clear();
        refresh();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
      selSet.clear();
      state.undo();
      refresh();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
      selSet.clear();
      state.redo();
      refresh();
    }
  };
  window.addEventListener("keydown", onKey, true);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Close";
  closeBtn.style.cssText = btnCss;
  closeBtn.onclick = () => closeEditor();
  toolbar.appendChild(closeBtn);

  document.body.appendChild(overlay);
  fit();
  rebuildTrackList();
  refresh();

  const onResize = () => draw();
  window.addEventListener("resize", onResize);
  const cleanup = () => {
    if (testWatch) {
      clearInterval(testWatch);
      testWatch = null;
    }
    if (testCtx) {
      try { ctx.packMenu.applyLoader(testCtx.prev.loader, testCtx.prev.id); } catch {}
      URL.revokeObjectURL(testCtx.url);
      testCtx = null;
    }
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("resize", onResize);
    overlay.remove();
  };
  activeEditor = cleanup;
}
