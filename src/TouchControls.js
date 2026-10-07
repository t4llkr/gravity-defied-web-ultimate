// Экранные кнопки для тач-устройств — транспорт коммита aad47d0 оригинального
// порта. Видны только на coarse pointer (см. .touch-controls в index.css).
export class TouchControls {
  constructor(root, handlers) {
    this.container = document.createElement("div");
    this.container.className = "touch-controls";
    this.container.addEventListener("contextmenu", (event) => event.preventDefault());

    const keys = [
      ["touch-left", "Lean backward", 2],
      ["touch-right", "Lean forward", 5],
      ["touch-up", "Accelerate", 1],
      ["touch-down", "Brake", 6],
      ["touch-ok", "Select", 8],
    ];

    for (const [className, label, keyCode] of keys) {
      const button = this.addButton(className, label);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        button.classList.add("pressed");
        handlers.keyPressed(keyCode);
      });

      const release = () => {
        button.classList.remove("pressed");
        handlers.keyReleased(keyCode);
      };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
    }

    this.addButton("touch-back", "Menu or back").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handlers.back();
    });

    root.append(this.container);
  }

  update(isInMenu, isBackAvailable) {
    const className = "touch-controls" + (isInMenu ? " in-menu" : "") + (isBackAvailable ? " has-back" : "");
    if (this.container.className !== className) {
      this.container.className = className;
    }
  }

  addButton(className, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    this.container.append(button);
    return button;
  }
}
