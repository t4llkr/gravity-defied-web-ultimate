// Пресеты визуала: хранение в localStorage + полупрозрачный DOM-оверлей.
// Фоновая картинка в пресеты НЕ входит (живёт в IndexedDB, в settings её нет).
// Слот возврата (gd-visual-last): заполняется при первом переходе
// "кастомное состояние -> пресет/дефолт", переходы пресет->пресет его не трогают;
// "вернуться к последнему" применяет слот и очищает его.
import { VisualSettings } from "./VisualSettings.js";

const PRESETS_KEY = "gd-visual-presets";
const LAST_KEY = "gd-visual-last";

const clone = (o) => JSON.parse(JSON.stringify(o));

export function loadPresets() {
  try {
    const a = JSON.parse(window.localStorage.getItem(PRESETS_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function writePresets(list) {
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
  }
}
export function savePreset(name, settings = null) {
  const list = loadPresets();
  const snap = settings !== null ? clone(settings) : clone(VisualSettings.settings);
  const i = list.findIndex((p) => p.name === name);
  if (i >= 0) {
    list[i] = { name, settings: snap };
  } else {
    list.push({ name, settings: snap });
  }
  writePresets(list);
}
export function deletePreset(name) {
  writePresets(loadPresets().filter((p) => p.name !== name));
}
export function renamePreset(oldName, newName) {
  const list = loadPresets();
  const p = list.find((x) => x.name === oldName);
  if (p && !list.some((x) => x.name === newName)) {
    p.name = newName;
    writePresets(list);
    return true;
  }
  return false;
}

export function hasLast() {
  try {
    return window.localStorage.getItem(LAST_KEY) !== null;
  } catch {
    return false;
  }
}
function fillLastIfEmpty() {
  if (!hasLast()) {
    try {
      window.localStorage.setItem(LAST_KEY, JSON.stringify(clone(VisualSettings.settings)));
    } catch {
    }
  }
}
function applySnapshot(snap) {
  Object.assign(VisualSettings.settings, clone(snap));
  VisualSettings.save();
}
export function applyPreset(name) {
  const p = loadPresets().find((x) => x.name === name);
  if (!p) {
    return false;
  }
  fillLastIfEmpty();
  applySnapshot(p.settings);
  return true;
}
export function backToLast() {
  let snap = null;
  try {
    snap = window.localStorage.getItem(LAST_KEY);
  } catch {
  }
  if (snap === null) {
    return false;
  }
  applySnapshot(JSON.parse(snap));
  try {
    window.localStorage.removeItem(LAST_KEY);
  } catch {
  }
  return true;
}
export function resetToDefaults() {
  fillLastIfEmpty();
  applySnapshot(VisualSettings.defaultSettings());
}

// ---- экспорт/импорт ----

// файл = один пресет: {meta:{type,version}, name, settings}
export function exportPresetData(name) {
  const p = loadPresets().find((x) => x.name === name);
  if (!p) {
    return null;
  }
  return {
    meta: { type: "gd-visual-preset", version: 1 },
    name: p.name,
    settings: clone(p.settings),
  };
}

// из файла: null — файл битый; {name, settings} — ок
export function parsePresetFile(text) {
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  const settings = sanitizeSettings(data.settings);
  if (!settings) {
    return null;
  }
  let name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 40) : "Imported preset";
  return { name, settings };
}

// только известные ключи и типы из VISUAL_DEFAULTS
function sanitizeSettings(s) {
  if (!s || typeof s !== "object") {
    return null;
  }
  const out = {};
  for (const k of Object.keys(VisualSettings.VISUAL_DEFAULTS)) {
    const v = s[k];
    if (v !== null && typeof v === typeof VisualSettings.VISUAL_DEFAULTS[k]) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ---------------- импорт / экспорт (один пресет = один JSON-файл) ----------------

export function exportPresetToJson(p) {
  return JSON.stringify({
    meta: { type: "gd-visual-preset", schema: 1, exportedAt: new Date().toISOString() },
    name: p.name,
    settings: p.settings
  }, null, 2);
}

// валидация файла: только известные ключи настроек, недостающее — из дефолтов
export function parsePresetJson(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    return null;
  }
  if (!d || typeof d.name !== "string" || !d.name.trim() || typeof d.settings !== "object" || d.settings === null) {
    return null;
  }
  const clean = {};
  for (const k of Object.keys(VisualSettings.VISUAL_DEFAULTS)) {
    if (k in d.settings) {
      clean[k] = d.settings[k];
    }
  }
  if (Object.keys(clean).length === 0) {
    return null;
  }
  return { name: d.name.trim(), settings: Object.assign(VisualSettings.defaultSettings(), clean) };
}

// ---------------- DOM-оверлей ----------------

let activeOverlay = null;

export function presetsOverlayOpen() {
  return activeOverlay !== null;
}
export function closePresetsOverlay() {
  if (activeOverlay) {
    activeOverlay();
    activeOverlay = null;
  }
}

// флаг для GameCanvas.paint: пока оверлей открыт, рисуем игровой кадр вместо меню
function setPaintThrough(on) {
  try {
    window.__gdPresetsOpen = on;
  } catch {
  }
}

const btnCss = "background:#22242a;border:1px solid #444;color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;";

export function openPresetsOverlay() {
  if (activeOverlay) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "gd-presets-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:520;background:transparent;display:flex;";
  // клик мимо панели закрывает (фон прозрачный — игровой кадр полностью виден)
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closePresetsOverlay();
    }
  };

  const panel = document.createElement("div");
  panel.style.cssText = "width:320px;height:100%;box-sizing:border-box;background:#14161a;border-right:1px solid #333;display:flex;flex-direction:column;gap:10px;padding:16px;overflow:auto;";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
  const title = document.createElement("div");
  title.textContent = "Visual presets";
  title.style.cssText = "font-weight:bold;font-size:15px;color:#eee;";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = btnCss;
  closeBtn.onclick = () => closePresetsOverlay();
  header.append(title, closeBtn);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;flex-direction:column;gap:8px;";
  const mkAction = (label, fn, disabled) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = btnCss + (disabled ? "opacity:0.4;cursor:default;" : "");
    if (!disabled) {
      b.onclick = fn;
    }
    return b;
  };

  const listEl = document.createElement("div");
  listEl.style.cssText = "display:flex;flex-direction:column;gap:6px;";

  // маленький модал с текстовым вводом (сохранение/переименование)
  const namePrompt = (titleText, initial) => {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
      const card = document.createElement("div");
      card.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;width:280px;display:flex;flex-direction:column;gap:12px;";
      const lbl = document.createElement("div");
      lbl.textContent = titleText;
      lbl.style.cssText = "color:#eee;font-size:14px;";
      const input = document.createElement("input");
      input.type = "text";
      input.value = initial || "";
      input.maxLength = 40;
      input.style.cssText = "background:#101216;border:1px solid #3a3d45;color:#eee;padding:8px;border-radius:6px;font-size:13px;";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
      const done = (v) => { box.remove(); resolve(v); };
      const okBtn = document.createElement("button");
      okBtn.textContent = "OK";
      okBtn.style.cssText = btnCss + "background:#274;";
      okBtn.onclick = () => done(input.value.trim() || null);
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = btnCss;
      cancelBtn.onclick = () => done(null);
      row.append(cancelBtn, okBtn);
      card.append(lbl, input, row);
      box.appendChild(card);
      overlay.appendChild(box);
      input.focus();
      input.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          done(input.value.trim() || null);
        } else if (e.key === "Escape") {
          done(null);
        }
      };
    });
  };

  // выбор JSON-файла (null — отмена/закрытие диалога)
  const confirmDialog = (text) => {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
      const card = document.createElement("div");
      card.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:300px;display:flex;flex-direction:column;gap:14px;";
      const msg = document.createElement("div");
      msg.textContent = text;
      msg.style.cssText = "color:#eee;font-size:14px;word-break:break-word;";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";
      const done = (v) => { box.remove(); resolve(v); };
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = btnCss;
      cancelBtn.onclick = () => done(false);
      const okBtn = document.createElement("button");
      okBtn.textContent = "Delete";
      okBtn.style.cssText = btnCss + "background:#7a2e2e;border-color:#a55;";
      okBtn.onclick = () => done(true);
      row.append(cancelBtn, okBtn);
      card.append(msg, row);
      box.appendChild(card);
      box.onclick = (e) => { if (e.target === box) { done(false); } };
      overlay.appendChild(box);
    });
  };

  // модал с одной кнопкой OK (информация/ошибка)
  const infoDialog = (text) => {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
      const card = document.createElement("div");
      card.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:300px;display:flex;flex-direction:column;gap:14px;";
      const msg = document.createElement("div");
      msg.textContent = text;
      msg.style.cssText = "color:#eee;font-size:14px;word-break:break-word;";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:flex-end;";
      const okBtn = document.createElement("button");
      okBtn.textContent = "OK";
      okBtn.style.cssText = btnCss;
      okBtn.onclick = () => { box.remove(); resolve(); };
      row.appendChild(okBtn);
      card.append(msg, row);
      box.appendChild(card);
      box.onclick = (e) => { if (e.target === box) { box.remove(); resolve(); } };
      overlay.appendChild(box);
    });
  };

  // модал коллизии имён: "overwrite" | "rename" | null (отмена)
  const collisionDialog = (name) => {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
      const card = document.createElement("div");
      card.style.cssText = "background:#1d1f24;border:1px solid #444;border-radius:10px;padding:18px 20px;max-width:320px;display:flex;flex-direction:column;gap:14px;";
      const msg = document.createElement("div");
      msg.textContent = `A preset named "${name}" already exists.`;
      msg.style.cssText = "color:#eee;font-size:14px;word-break:break-word;";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;flex-direction:column;gap:8px;";
      const done = (v) => { box.remove(); resolve(v); };
      const mkBtn = (label, danger, v) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = "width:100%;box-sizing:border-box;background:" + (danger ? "#7a2e2e" : "#22242a") + ";border:1px solid #555;color:#eee;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;";
        b.onclick = () => done(v);
        return b;
      };
      row.append(
        mkBtn("Overwrite existing", true, "overwrite"),
        mkBtn("Rename imported", false, "rename"),
        mkBtn("Cancel import", false, null)
      );
      card.append(msg, row);
      box.appendChild(card);
      overlay.appendChild(box);
    });
  };

  // экспорт одного пресета в JSON-файл
  const exportPreset = (name) => {
    const data = exportPresetData(name);
    if (!data) {
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (data.name.replace(/[^\w\- ]+/g, "_").slice(0, 40) || "preset") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  // импорт пресета из JSON-файла
  const importPreset = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) {
        return;
      }
      const parsed = parsePresetFile(await file.text());
      if (!parsed) {
        await infoDialog("Not a valid preset file.");
        return;
      }
      let name = parsed.name;
      if (loadPresets().some((p) => p.name === name)) {
        const choice = await collisionDialog(name);
        if (choice === null) {
          return;
        }
        if (choice === "rename") {
          const nn = await namePrompt("Import as:", name + " (imported)");
          if (!nn) {
            return;
          }
          name = nn;
          if (loadPresets().some((p) => p.name === name)
              && !await confirmDialog(`Preset "${name}" already exists. Overwrite it?`)) {
            return;
          }
        }
      }
      savePreset(name, parsed.settings);
      refresh();
    };
    input.click();
  };

  const refresh = () => {
    // кнопки
    actions.innerHTML = "";
    actions.append(
      mkAction("Save current as...", async () => {
        const name = await namePrompt("Preset name:", "");
        if (!name) {
          return;
        }
        if (loadPresets().some((p) => p.name === name)) {
          if (!await confirmDialog(`Preset "${name}" already exists. Overwrite it?`)) {
            return;
          }
        }
        savePreset(name);
        refresh();
      }),
      mkAction("Import...", () => {
        importPreset();
      }),
      mkAction("Back to last", () => {
        backToLast();
        refresh();
      }, !hasLast()),
      mkAction("Reset to default", () => {
        resetToDefaults();
        refresh();
      })
    );
    // список
    listEl.innerHTML = "";
    const presets = loadPresets();
    if (presets.length === 0) {
      const hint = document.createElement("div");
      hint.textContent = "No presets yet — tune the visual, then 'Save current as...'.";
      hint.style.cssText = "color:#888;font-size:12px;padding:8px 2px;";
      listEl.appendChild(hint);
    }
    for (const p of presets) {
      const row = document.createElement("div");
      row.style.cssText = "position:relative;display:flex;align-items:center;gap:6px;background:#1b1d22;border:1px solid #3a3d45;border-radius:6px;padding:8px 10px;";
      const nameBtn = document.createElement("button");
      nameBtn.textContent = p.name;
      nameBtn.title = "Apply preset";
      nameBtn.style.cssText = "flex:1;text-align:left;background:none;border:none;color:#eee;padding:0;cursor:pointer;font-size:13px;word-break:break-word;";
      nameBtn.onclick = () => {
        applyPreset(p.name);
        refresh();
      };
      const renBtn = document.createElement("button");
      renBtn.textContent = "✎";
      renBtn.title = "Rename";
      renBtn.style.cssText = "background:none;border:none;color:#999;cursor:pointer;font-size:13px;";
      renBtn.onclick = async () => {
        const name = await namePrompt("Rename preset:", p.name);
        if (name && name !== p.name) {
          renamePreset(p.name, name);
          refresh();
        }
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.title = "Delete";
      delBtn.style.cssText = "background:none;border:none;color:#c66;cursor:pointer;font-size:13px;";
      delBtn.onclick = async () => {
        if (await confirmDialog(`Delete preset "${p.name}"?`)) {
          deletePreset(p.name);
          refresh();
        }
      };
      const expBtn = document.createElement("button");
      expBtn.textContent = "⬇";
      expBtn.title = "Export to file";
      expBtn.style.cssText = "background:none;border:none;color:#9c9;cursor:pointer;font-size:13px;";
      expBtn.onclick = () => exportPreset(p.name);
      row.append(nameBtn, renBtn, expBtn, delBtn);
      listEl.appendChild(row);
    }
  };

  overlay.appendChild(panel);
  panel.append(header, actions, listEl);
  document.body.appendChild(overlay);
  refresh();

  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      closePresetsOverlay();
    }
  };
  window.addEventListener("keydown", onKey, true);
  const cleanup = () => {
    window.removeEventListener("keydown", onKey, true);
    setPaintThrough(false);
    overlay.remove();
  };
  activeOverlay = cleanup;
  setPaintThrough(true);
}
