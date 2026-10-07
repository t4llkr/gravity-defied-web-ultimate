// Экранные кнопки для тач-устройств (по образцу коммита aad47d0 оригинального
// порта). Видны только на coarse pointer — см. .touch-controls в index.css.
// Стрелки пробрасываются в keyPressed/keyReleased движка, OK — «огонь»,
// Menu/Back — пауза/назад.
export class TouchControls {
  constructor(handlers) {
    this.handlers = handlers;
    this.element = document.createElement("div");
    this.element.className = "touch-controls";
    this.createKeyButton("tc-left", 2);
    this.createKeyButton("tc-right", 5);
    this.createKeyButton("tc-up", 1);
    this.createKeyButton("tc-down", 6);
    this.createActionButton("tc-ok", () => this.handlers.onOk?.());
    this.createActionButton("tc-back", () => this.handlers.onBack?.());
  }
  createKeyButton(cls, keyCode) {
    const bind = (el) => {
      const down = (e) => { e.preventDefault(); this.handlers.onKeyPressed?.(keyCode); };
      const up = (e) => { e.preventDefault(); this.handlers.onKeyReleased?.(keyCode); };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    this.createButton(cls, bind);
  }
  createActionButton(cls, fn) {
    this.createButton(cls, (el) => {
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        fn();
      });
    });
  }
  createButton(cls, bind) {
    const el = document.createElement("div");
    el.className = "tc-btn " + cls;
    el.textContent = cls === "tc-ok" ? "OK" : cls === "tc-back" ? "≡"
      : cls === "tc-left" ? "◀" : cls === "tc-right" ? "▶"
      : cls === "tc-up" ? "▲" : "▼";
    bind(el);
    this.element.appendChild(el);
  }
  update(isInMenu, isBackAvailable) {
    this.element.classList.toggle("in-menu", !!isInMenu);
    this.element.classList.toggle("has-back", !!isBackAvailable);
  }
}
