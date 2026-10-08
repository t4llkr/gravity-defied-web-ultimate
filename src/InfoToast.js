// Информационные тосты для алертов игры (showAlert): показывают в верхней
// части экрана текст, который иначе уходит только в консоль.
let host = null;
let suppressed = false; // тест-драйв: алерты игры не показываем
export function setInfoToastSuppressed(v) {
  suppressed = !!v;
}
const active = new Map(); // key -> { el, count, timer }

function ensureHost() {
  if (host && document.body.contains(host)) {
    return host;
  }
  host = document.createElement("div");
  host.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:640;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:90vw;";
  document.body.appendChild(host);
  return host;
}

export function showInfoToast(title, text) {
  try {
    if (suppressed) {
      return;
    }
    const t = (text ?? "").toString();
    const key = ((title ?? "") + "|" + t);
    const existing = active.get(key);
    if (existing) {
      existing.count++;
      existing.countEl.textContent = "×" + existing.count;
      clearTimeout(existing.timer);
      existing.timer = setTimeout(() => dismiss(key), 4000);
      return;
    }
    while (active.size >= 3) {
      const oldest = active.keys().next().value;
      dismiss(oldest);
    }
    const el = document.createElement("div");
    el.style.cssText = "pointer-events:auto;background:rgba(20,22,26,0.95);border:1px solid #5a5e68;border-radius:8px;padding:8px 14px;max-width:70vw;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,0.4);";
    const titleEl = document.createElement("div");
    titleEl.textContent = title || "";
    titleEl.style.cssText = "font-weight:bold;font-size:13px;color:#fc8;";
    const textEl = document.createElement("div");
    textEl.textContent = t;
    textEl.style.cssText = "font-size:13px;color:#eee;word-break:break-word;";
    const countEl = document.createElement("span");
    countEl.style.cssText = "font-size:11px;color:#999;margin-left:6px;";
    el.appendChild(titleEl);
    el.appendChild(textEl);
    if (title) {
      titleEl.appendChild(countEl);
    } else {
      textEl.appendChild(countEl);
    }
    ensureHost().appendChild(el);
    const rec = { el, count: 1, countEl, timer: null };
    active.set(key, rec);
    rec.timer = setTimeout(() => dismiss(key), 4000);
  } catch {
    // оверлей не должен ничего ломать
  }
}

function dismiss(key) {
  const rec = active.get(key);
  if (!rec) {
    return;
  }
  clearTimeout(rec.timer);
  active.delete(key);
  rec.el.remove();
}
