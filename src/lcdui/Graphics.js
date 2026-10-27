import { Font } from "./Font.js";
class Graphics {
  static HCENTER = 1;
  static VCENTER = 2;
  static LEFT = 4;
  static RIGHT = 8;
  static TOP = 16;
  static BOTTOM = 32;
  static BASELINE = 64;
  ctx;
  font = new Font(Font.STYLE_PLAIN, Font.SIZE_MEDIUM);
  currentColor = "rgb(0 0 0)";
  clipRect = null;
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.lineWidth = 1;
    this.ctx.textRendering = "geometricPrecision";
    this.ctx.imageSmoothingEnabled = false;
  }
  drawString(s, x, y, anchor) {
    this.ctx.font = this.font.getCssFont();
    this.ctx.fillStyle = this.currentColor;
    const metrics = this.ctx.measureText(s);
    const width = Math.ceil(metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || 12);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || 4);
    const drawX = Graphics.getAnchorX(x, width, anchor);
    const baselineY = Graphics.getAnchorTextY(y, ascent, descent, anchor);
    this.withClip(() => {
      this.ctx.fillText(s, drawX, baselineY);
    });
  }
  setColor(r, g, b) {
    this.currentColor = `rgb(${r} ${g} ${b})`;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.strokeStyle = this.currentColor;
  }
  setFont(font) {
    this.font = font;
  }
  getFont() {
    return this.font;
  }
  drawChar(c, x, y, anchor) {
    this.drawString(c.slice(0, 1), x, y, anchor);
  }
  setClip(x, y, w, h) {
    this.clipRect = { x, y, w, h };
  }
  fillRect(x, y, w, h) {
    this.withClip(() => {
      this.ctx.fillRect(x, y, w, h);
    });
  }
  drawLine(x1, y1, x2, y2) {
    this.withClip(() => {
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    });
  }
  drawArc(x, y, width, heigth, startAngle, arcAngle) {
    const xradius = Math.trunc(width / 2);
    const yradius = Math.trunc(heigth / 2);
    x += xradius;
    y += yradius;
    if (xradius === 0 && yradius === 0) {
      return;
    }
    this.withClip(() => {
      for (let angle = startAngle; angle < startAngle + arcAngle; ++angle) {
        this.drawLine(
          x + Math.trunc(xradius * Math.cos(angle * Math.PI / 180)),
          y - Math.trunc(yradius * Math.sin(angle * Math.PI / 180)),
          x + Math.trunc(xradius * Math.cos((angle + 1) * Math.PI / 180)),
          y - Math.trunc(yradius * Math.sin((angle + 1) * Math.PI / 180))
        );
      }
    });
  }
  // прямой блит готового канваса (офскрин-кэши растровых замощений и т.п.)
  drawCanvas(canvas, x, y) {
    this.ctx.drawImage(canvas, x, y);
  }

  drawImage(image, x, y, anchor) {
    const width = image.getWidth();
    const height = image.getHeight();
    const drawX = Graphics.getAnchorX(x, width, anchor);
    const drawY = Graphics.getAnchorY(y, height, anchor);
    this.withClip(() => {
      this.ctx.drawImage(image.getElement(), drawX, drawY);
    });
  }

  // source-rect вариант (J2ME drawRegion): кадр спрайта из листа БЕЗ ctx.clip —
  // паттерн save+clip+restore на каждый спрайт душил Chrome (рост памяти
  // вне V8-хипа).
  drawRegion(image, sx, sy, w, h, x, y, anchor) {
    const drawX = Graphics.getAnchorX(x, w, anchor);
    const drawY = Graphics.getAnchorY(y, h, anchor);
    this.withClip(() => {
      this.ctx.drawImage(image.getElement(), sx, sy, w, h, drawX, drawY, w, h);
    });
  }
  withClip(draw) {
    if (this.clipRect === null) {
      draw();
      return;
    }
    // быстрый путь: клип покрывает весь канвас — семантический no-op.
    // Без него каждый примитив меню (~950/кадр) идёт через save+clip+restore,
    // и Chrome копит ресурсы вне V8-хипа (+100-200 МБ/с, скрыто от снапшотов).
    const cv = this.ctx.canvas;
    if (this.clipRect.x <= 0 && this.clipRect.y <= 0 &&
        this.clipRect.x + this.clipRect.w >= cv.width &&
        this.clipRect.y + this.clipRect.h >= cv.height) {
      draw();
      return;
    }
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(this.clipRect.x, this.clipRect.y, this.clipRect.w, this.clipRect.h);
    this.ctx.clip();
    draw();
    this.ctx.restore();
  }
  static getAnchorX(x, size, anchor) {
    if ((anchor & Graphics.LEFT) !== 0) {
      return x;
    }
    if ((anchor & Graphics.RIGHT) !== 0) {
      return x - size;
    }
    if ((anchor & Graphics.HCENTER) !== 0) {
      return x - (size >> 1);
    }
    throw new Error(`unknown xanchor = ${anchor}`);
  }
  static getAnchorY(y, size, anchor) {
    if ((anchor & Graphics.TOP) !== 0) {
      return y;
    }
    if ((anchor & Graphics.BOTTOM) !== 0) {
      return y - size;
    }
    if ((anchor & Graphics.VCENTER) !== 0) {
      return y - (size >> 1);
    }
    if ((anchor & Graphics.BASELINE) !== 0) {
      return y - size;
    }
    throw new Error(`unknown yanchor = ${anchor}`);
  }
  static getAnchorTextY(y, ascent, descent, anchor) {
    if ((anchor & Graphics.TOP) !== 0) {
      return y + ascent;
    }
    if ((anchor & Graphics.BOTTOM) !== 0) {
      return y - descent;
    }
    if ((anchor & Graphics.VCENTER) !== 0) {
      return y + (ascent - descent >> 1);
    }
    if ((anchor & Graphics.BASELINE) !== 0) {
      return y;
    }
    throw new Error(`unknown yanchor = ${anchor}`);
  }
}
export {
  Graphics
};
