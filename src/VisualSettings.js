// Настройки визуала (глобальные). Хранение: localStorage, ключ "gd-visual".
export class VisualSettings {
  // дефолтный визуал (для сброса и пресетов) — источник истины один
  static VISUAL_DEFAULTS = {
    lineColor: "#00ff00",
    bgColor: "#ffffff",
    fillEnabled: false,
    fillColor: "#008800",
    fillMode: "gradient",
    hideLines: false,
    textColor: "#000000",
    curtainEnabled: false,
    bgImageMode: "fill",
    showBgImage: true
  };
  static settings = JSON.parse(JSON.stringify(VisualSettings.VISUAL_DEFAULTS));
  static defaultSettings() {
    return JSON.parse(JSON.stringify(VisualSettings.VISUAL_DEFAULTS));
  }
  static bgImage = null;
  static bgImageUrl = null;
  static bgImageEl = null;
  static bgGif = null;
  static currentGifFrame() {
    const gif = this.bgGif;
    if (gif === null || gif.frames.length === 0) {
      return null;
    }
    const total = gif.frames.reduce((acc, f) => acc + f.delay, 0);
    let t = (performance.now() - gif.started) % total;
    if (t < 0) {
      t = 0;
    }
    for (let i = 0; i < gif.frames.length; i++) {
      t -= gif.frames[i].delay;
      if (t < 0) {
        return gif.frames[i].canvas;
      }
    }
    return gif.frames[gif.frames.length - 1].canvas;
  }
  static async loadBgImageFromStorage() {
    try {
      const blob = await loadBgImage();
      if (blob === null || blob === undefined) {
        this.bgImage = null;
        return;
      }
      if (isGifBlob(blob)) {
        const head = new Uint8Array(await blob.slice(0, 6).arrayBuffer());
        if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) {
          // GIF: браузеры не анимируют drawImage — декодируем кадры сами
          this.bgGif = await decodeGif(blob);
          this.bgGif.started = performance.now();
          this.bgImage = null;
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const img = new Image();
      // изображение держим В DOM (скрыто): ряд движков продвигает кадры GIF
      // только для присоединённых к документу элементов
      img.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none;";
      document.body.appendChild(img);
      // ждём реальной готовности картинки: вызывающий код (напр. пересборка
      // меню Visuals) полагается, что bgImage уже установлен при resolve
      await new Promise((resolve) => {
        img.onload = () => {
          // URL НЕ отзываем: revoke "морозит" анимацию GIF у живого изображения
          if (this.bgImageUrl !== null) {
            URL.revokeObjectURL(this.bgImageUrl);
          }
          if (this.bgImageEl !== null && this.bgImageEl !== img) {
            this.bgImageEl.remove();
          }
          this.bgImage = img;
          this.bgImageUrl = url;
          this.bgImageEl = img;
          resolve();
        };
        img.onerror = () => {
          this.bgImage = null;
          resolve();
        };
        img.src = url;
      });
    } catch {
      this.bgImage = null;
    }
  }
  static load() {
    try {
      const raw = window.localStorage.getItem("gd-visual");
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object") {
          Object.assign(this.settings, parsed);
        }
      }
    } catch {
    }
  }
  static save() {
    try {
      window.localStorage.setItem("gd-visual", JSON.stringify(this.settings));
    } catch {
    }
  }
  static rgb(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  static lineRGB() {
    return this.rgb(this.settings.lineColor);
  }

  // тёмный производный оттесок линий (стена/коннекторы в 3D): lineRGB × 0.667 —
  // отношение (0,170,0)/(0,255,0) из оригинального порта
  static lineRGBDark() {
    const c = VisualSettings.lineRGB();
    const k = 0.667;
    return [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
  }
  static bgRGB() {
    return this.rgb(this.settings.bgColor);
  }
  static fillRGB() {
    return this.rgb(this.settings.fillColor);
  }
  static textRGB() {
    return this.rgb(this.settings.textColor);
  }
  // Яркостной множитель по наклону сегмента (dx, dy — любая шкала, важен угол).
  // gradient: плавно 0.6..1.3; steps: 3 ступени (0.78 / 1.0 / 1.22).
  static shadeFactor(dx, dy) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      return 1;
    }
    const slope = dy / len;
    if (this.settings.fillMode === "steps") {
      if (slope < -0.34) {
        return 0.78;
      }
      if (slope > 0.34) {
        return 1.22;
      }
      return 1;
    }
    return Math.max(0.6, Math.min(1.3, 1 + 0.35 * slope));
  }
}

// Модальный DOM-оверлей нативного color-picker: live-применение через onChange,
// сохранение при закрытии. Один экземпляр; клавиши глушатся (игра глуха);
// открытие НЕ из keydown-контекста (setTimeout 0); без blur-обработчика —
// удаление DOM в момент открытого нативного диалога ломает его в ряде браузеров.
let activePicker = null;

export function closePicker() {
  if (activePicker !== null) {
    activePicker();
  }
}

export function pickColor(initial, onChange) {
  closePicker();
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;";
  const input = document.createElement("input");
  input.type = "color";
  input.value = /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : "#00aa00";
  input.style.cssText = "width:120px;height:64px;border:2px solid #fff;padding:0;background:transparent;cursor:pointer;";
  overlay.appendChild(input);
  document.body.appendChild(overlay);
  let finished = false;
  const cleanup = () => {
    if (finished) {
      return;
    }
    finished = true;
    activePicker = null;
    overlay.remove();
    window.removeEventListener("keydown", onKey, true);
  };
  activePicker = cleanup;
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      cleanup();
    }
  };
  window.addEventListener("keydown", onKey, true);
  input.addEventListener("input", () => {
    try {
      onChange(input.value);
    } catch {
    }
  });
  input.addEventListener("change", () => {
    try {
      onChange(input.value);
      VisualSettings.save();
    } catch {
    }
    cleanup();
  });
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) {
      try {
        VisualSettings.save();
      } catch {
      }
      cleanup();
    }
  });
  setTimeout(() => {
    try {
      input.click();
    } catch {
      // диалог не открылся — свотч всё равно кликабелен
    }
  }, 0);
}

// === Хранилище фона-изображения (IndexedDB) ===
function bgImageDb() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open("gdvisual", 2);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
      if (!db.objectStoreNames.contains("skins")) {
        db.createObjectStore("skins", { keyPath: "id" });
      }
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function bgImageStoreRun(mode, key, value) {
  const db = await bgImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    let request;
    if (mode === "get") {
      request = store.get(key);
    } else if (mode === "set") {
      request = store.put(value, key);
    } else {
      request = store.delete(key);
    }
    tx.oncomplete = () => resolve(mode === "get" ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export function saveBgImage(blob) {
  return bgImageStoreRun("set", "bgImage", blob);
}
export function loadBgImage() {
  return bgImageStoreRun("get", "bgImage");
}
export function clearBgImage() {
  return bgImageStoreRun("del", "bgImage");
}

// Выбор файла с компьютера (оверлей вне keydown-контекста).
export function pickFile(onFile) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,.gif";
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", () => {
    const file = input.files !== null && input.files.length > 0 ? input.files[0] : null;
    input.remove();
    if (file !== null) {
      onFile(file);
    }
  });
  setTimeout(() => {
    try {
      input.click();
    } catch {
    }
  }, 0);
}import { decodeGif, isGifBlob } from "./GifDecoder.js";

