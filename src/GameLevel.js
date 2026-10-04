import { VisualSettings } from "./VisualSettings.js";
import { abs, divideF16, multiplyF16 } from "./cpp.js";
import { GamePhysics } from "./GamePhysics.js";
import { LevelLoader } from "./LevelLoader.js";
class GameLevel {
  minX = 0;
  maxX = 0;
  shadowStartXF16 = 0;
  shadowEndXF16 = 0;
  shadowProjectionYF16 = 0;
  shadowBlendF16 = 0;
  startPosX = 0;
  startPosY = 0;
  finishPosX = 13107200;
  startFlagPoint = 0;
  finishFlagPoint = 0;
  finishPosY = 0;
  pointsCount = 0;
  unusedLevelFlag = 0;
  pointPositions = [];
  constructor() {
    this.init();
  }
  init() {
    this.startPosX = 0;
    this.startPosY = 0;
    this.finishPosX = 13107200;
    this.pointsCount = 0;
    this.unusedLevelFlag = 0;
  }
  setStartAndFinishPositions(var1, var2, var3, var4) {
    this.startPosX = var1 << 16 >> 3;
    this.startPosY = var2 << 16 >> 3;
    this.finishPosX = var3 << 16 >> 3;
    this.finishPosY = var4 << 16 >> 3;
  }
  getStartPosX() {
    return this.startPosX << 3 >> 16;
  }
  getStartPosY() {
    return this.startPosY << 3 >> 16;
  }
  getFinishPosX() {
    return this.finishPosX << 3 >> 16;
  }
  getFinishPosY() {
    return this.finishPosY << 3 >> 16;
  }
  getPointX(pointNo) {
    return this.pointPositions[pointNo][0] << 3 >> 16;
  }
  getPointY(pointNo) {
    return this.pointPositions[pointNo][1] << 3 >> 16;
  }
  getProgressF16(var1) {
    const var2 = var1 - this.pointPositions[this.startFlagPoint][0];
    const var3 = this.pointPositions[this.finishFlagPoint][0] - this.pointPositions[this.startFlagPoint][0];
    return abs(var3) >= 3 && var2 <= var3 ? divideF16(var2, var3) : 65536;
  }
  setMinMaxX(minX, maxX) {
    this.minX = minX << 16 >> 3;
    this.maxX = maxX << 16 >> 3;
  }
  setShadowProjectionRange(var1, var2) {
    this.shadowStartXF16 = var1 >> 1;
    this.shadowEndXF16 = var2 >> 1;
  }
  setShadowProjectionState(var1, var2, var3) {
    this.shadowStartXF16 = var1;
    this.shadowEndXF16 = var2;
    this.shadowProjectionYF16 = var3;
  }
  renderShadow(gameCanvas, var2, var3) {
    if (var3 <= this.pointsCount - 1) {
      let var4 = this.shadowProjectionYF16 - (this.pointPositions[var2][1] + this.pointPositions[var3 + 1][1] >> 1) < 0 ? 0 : this.shadowProjectionYF16 - (this.pointPositions[var2][1] + this.pointPositions[var3 + 1][1] >> 1);
      if (this.shadowProjectionYF16 <= this.pointPositions[var2][1] || this.shadowProjectionYF16 <= this.pointPositions[var3 + 1][1]) {
        var4 = var4 < 327680 ? var4 : 327680;
      }
      this.shadowBlendF16 = multiplyF16(this.shadowBlendF16, 49152) + multiplyF16(var4, 16384);
      if (this.shadowBlendF16 <= 557056) {
        const var5 = multiplyF16(1638400, this.shadowBlendF16) >> 16;
        gameCanvas.setColor(var5, var5, var5);
        let var6 = this.pointPositions[var2][0] - this.pointPositions[var2 + 1][0];
        let var8 = divideF16(this.pointPositions[var2][1] - this.pointPositions[var2 + 1][1], var6);
        let var9 = this.pointPositions[var2][1] - multiplyF16(this.pointPositions[var2][0], var8);
        const var10 = multiplyF16(this.shadowStartXF16, var8) + var9;
        var6 = this.pointPositions[var3][0] - this.pointPositions[var3 + 1][0];
        var8 = divideF16(this.pointPositions[var3][1] - this.pointPositions[var3 + 1][1], var6);
        var9 = this.pointPositions[var3][1] - multiplyF16(this.pointPositions[var3][0], var8);
        const var11 = multiplyF16(this.shadowEndXF16, var8) + var9;
        if (var2 === var3) {
          gameCanvas.drawLine(this.shadowStartXF16 << 3 >> 16, var10 + 65536 << 3 >> 16, this.shadowEndXF16 << 3 >> 16, var11 + 65536 << 3 >> 16);
          return;
        }
        gameCanvas.drawLine(
          this.shadowStartXF16 << 3 >> 16,
          var10 + 65536 << 3 >> 16,
          this.pointPositions[var2 + 1][0] << 3 >> 16,
          this.pointPositions[var2 + 1][1] + 65536 << 3 >> 16
        );
        for (let i = var2 + 1; i < var3; ++i) {
          gameCanvas.drawLine(
            this.pointPositions[i][0] << 3 >> 16,
            this.pointPositions[i][1] + 65536 << 3 >> 16,
            this.pointPositions[i + 1][0] << 3 >> 16,
            this.pointPositions[i + 1][1] + 65536 << 3 >> 16
          );
        }
        gameCanvas.drawLine(
          this.pointPositions[var3][0] << 3 >> 16,
          this.pointPositions[var3][1] + 65536 << 3 >> 16,
          this.shadowEndXF16 << 3 >> 16,
          var11 + 65536 << 3 >> 16
        );
      }
    }
  }
  renderLevel3D(gameCanvas, xF16, yF16) {
    let var7 = 0;
    let var8 = 0;
    let lineNo = 0;
    for (lineNo = 0; lineNo < this.pointsCount - 1 && this.pointPositions[lineNo][0] <= this.minX; ++lineNo) {
    }
    if (lineNo > 0) {
      --lineNo;
    }
    let var9 = xF16 - this.pointPositions[lineNo][0];
    let var10 = yF16 + 3276800 - this.pointPositions[lineNo][1];
    let var11 = GamePhysics.getSmthLikeMaxAbs(var9, var10);
    var9 = divideF16(var9, var11 >> 1 >> 1);
    var10 = divideF16(var10, var11 >> 1 >> 1);
    gameCanvas.setColor(...VisualSettings.lineRGB());
    this.renderTrackEffects(gameCanvas, xF16, yF16);
    while (lineNo < this.pointsCount - 1) {
      const var4 = var9;
      const var5 = var10;
      var9 = xF16 - this.pointPositions[lineNo + 1][0];
      var10 = yF16 + 3276800 - this.pointPositions[lineNo + 1][1];
      var11 = GamePhysics.getSmthLikeMaxAbs(var9, var10);
      var9 = divideF16(var9, var11 >> 1 >> 1);
      var10 = divideF16(var10, var11 >> 1 >> 1);
      // нижняя (дальняя) линия стены — тёмный производный (верхняя — основной)
      gameCanvas.setColor(...VisualSettings.lineRGBDark());
      gameCanvas.drawLine(
        this.pointPositions[lineNo][0] + var4 << 3 >> 16,
        this.pointPositions[lineNo][1] + var5 << 3 >> 16,
        this.pointPositions[lineNo + 1][0] + var9 << 3 >> 16,
        this.pointPositions[lineNo + 1][1] + var10 << 3 >> 16
      );
      // коннектор поверхность→стена — тёмный производный оттенок
      gameCanvas.setColor(...VisualSettings.lineRGBDark());
      gameCanvas.drawLine(
        this.pointPositions[lineNo][0] << 3 >> 16,
        this.pointPositions[lineNo][1] << 3 >> 16,
        this.pointPositions[lineNo][0] + var4 << 3 >> 16,
        this.pointPositions[lineNo][1] + var5 << 3 >> 16
      );
      if (lineNo > 1) {
        if (this.pointPositions[lineNo][0] > this.shadowStartXF16 && var7 === 0) {
          var7 = lineNo - 1;
        }
        if (this.pointPositions[lineNo][0] > this.shadowEndXF16 && var8 === 0) {
          var8 = lineNo - 1;
        }
      }
      if (this.startFlagPoint === lineNo) {
        gameCanvas.renderStartFlag(
          this.pointPositions[this.startFlagPoint][0] + var4 << 3 >> 16,
          this.pointPositions[this.startFlagPoint][1] + var5 << 3 >> 16
        );
        gameCanvas.setColor(...VisualSettings.lineRGB());
      }
      if (this.finishFlagPoint === lineNo) {
        gameCanvas.renderFinishFlag(
          this.pointPositions[this.finishFlagPoint][0] + var4 << 3 >> 16,
          this.pointPositions[this.finishFlagPoint][1] + var5 << 3 >> 16
        );
        gameCanvas.setColor(...VisualSettings.lineRGB());
      }
      if (this.pointPositions[lineNo][0] > this.maxX) {
        break;
      }
      ++lineNo;
    }
    gameCanvas.setColor(...VisualSettings.lineRGBDark());
    gameCanvas.drawLine(
      this.pointPositions[this.pointsCount - 1][0] << 3 >> 16,
      this.pointPositions[this.pointsCount - 1][1] << 3 >> 16,
      this.pointPositions[this.pointsCount - 1][0] + var9 << 3 >> 16,
      this.pointPositions[this.pointsCount - 1][1] + var10 << 3 >> 16
    );
    gameCanvas.setColor(...VisualSettings.lineRGB());
    if (LevelLoader.isEnabledShadows) {
      this.renderShadow(gameCanvas, var7, var8);
    }
  }

  renderTrackEffects(gameCanvas, xF16, yF16, withFill = true) {
    let lineNo = 0;
    for (lineNo = 0; lineNo < this.pointsCount - 1 && this.pointPositions[lineNo][0] <= this.minX; ++lineNo) {
    }
    if (lineNo > 0) {
      --lineNo;
    }
  const fillOn = withFill && VisualSettings.settings.fillEnabled;
    const curtainOn = VisualSettings.settings.curtainEnabled;
    if (fillOn || curtainOn) {
      // Кэш готовых путей: при неподвижном байке геометрия и камера не меняются,
      // иначе каждый кадр пересоздавались бы тысячи массивов квадов + Path2D
      // (утечка/нагрузка на GC и Skia). Ключ — всё, от чего зависит результат.
      if (!(gameCanvas.width > 0) || !(gameCanvas.height2 > 0)) {
        // канвас ещё не отлейаутился (размер 0/NaN) — рисовать слой некуда
        gameCanvas.setColor(...VisualSettings.lineRGB());
        return;
      }
      const cbRGB = VisualSettings.fillRGB();
      // квантование поглощает микродрожание камеры/байка (меньше клиентской геометрии -> тот же результат)
      const key = [
        xF16 >> 6, yF16 >> 6, lineNo, this.pointsCount,
        this.pointPositions[0][0], this.pointPositions[0][1],
        gameCanvas.dx >> 6, gameCanvas.dy >> 6, gameCanvas.width, gameCanvas.height2,
        fillOn ? 1 : 0, curtainOn ? 1 : 0,
        cbRGB[0], cbRGB[1], cbRGB[2],
        VisualSettings.settings.fillMode,
      ].join("|");
      if (this._fillCache && this._fillCache.key === key) {
        // один блит готового слоя вместо растеризации всех путей заново
        if (this._fillCache.canvas.width > 0 && this._fillCache.canvas.height > 0) {
          gameCanvas.graphics.ctx.drawImage(this._fillCache.canvas, 0, 0);
        }
        gameCanvas.setColor(...VisualSettings.lineRGB());
        return;
      }
      const builtPaths = [];
      const bottomY = gameCanvas.addDy(0) - (gameCanvas.height2 + 100);
      const curtainQuads = [];
      const fillBuckets = new Map();
      const trackOffset = (idx) => {
        let ox = xF16 - this.pointPositions[idx][0];
        let oy = yF16 + 3276800 - this.pointPositions[idx][1];
        const len = GamePhysics.getSmthLikeMaxAbs(ox, oy);
        ox = divideF16(ox, len >> 1 >> 1);
        oy = divideF16(oy, len >> 1 >> 1);
        return [ox, oy];
      };
      let prevOff = trackOffset(lineNo);
      for (let seg = lineNo; seg < this.pointsCount - 1; seg++) {
        const xi = this.pointPositions[seg][0] << 3 >> 16;
        const yi = this.pointPositions[seg][1] << 3 >> 16;
        const xj = this.pointPositions[seg + 1][0] << 3 >> 16;
        const yj = this.pointPositions[seg + 1][1] << 3 >> 16;
        if (curtainOn) {
          curtainQuads.push([[xi, yi], [xj, yj], [xj, bottomY], [xi, bottomY]]);
        }
        if (fillOn) {
          const off = trackOffset(seg + 1);
          const shade = VisualSettings.shadeFactor(this.pointPositions[seg + 1][0] - this.pointPositions[seg][0], this.pointPositions[seg + 1][1] - this.pointPositions[seg][1]);
          const key = Math.round(shade * 16);
          let bucket = fillBuckets.get(key);
          if (bucket === undefined) {
            bucket = { shade, quads: [] };
            fillBuckets.set(key, bucket);
          }
          bucket.quads.push([
            [xi, yi],
            [xj, yj],
            [this.pointPositions[seg + 1][0] + off[0] << 3 >> 16, this.pointPositions[seg + 1][1] + off[1] << 3 >> 16],
            [this.pointPositions[seg][0] + prevOff[0] << 3 >> 16, this.pointPositions[seg][1] + prevOff[1] << 3 >> 16]
          ]);
          prevOff = off;
        }
        if (this.pointPositions[seg][0] > this.maxX) {
          break;
        }
      }
      const off = document.createElement("canvas");
      off.width = gameCanvas.width;
      off.height = gameCanvas.height2;
      const offCtx = off.getContext("2d");
      if (curtainQuads.length !== 0) {
        const cb = VisualSettings.fillRGB();
        const path = gameCanvas.buildPolygonPath(curtainQuads);
        offCtx.fillStyle = "rgb(" + cb[0] + "," + cb[1] + "," + cb[2] + ")";
        offCtx.fill(path);
        builtPaths.push({ rgb: cb, path });
      }
      for (const bucket of fillBuckets.values()) {
        const fb = VisualSettings.fillRGB();
        const rgb = [Math.min(255, fb[0] * bucket.shade | 0), Math.min(255, fb[1] * bucket.shade | 0), Math.min(255, fb[2] * bucket.shade | 0)];
        const path = gameCanvas.buildPolygonPath(bucket.quads);
        offCtx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
        offCtx.fill(path);
        builtPaths.push({ rgb, path });
      }
      gameCanvas.graphics.ctx.drawImage(off, 0, 0);
      this._fillCache = { key, canvas: off, paths: builtPaths };
      gameCanvas.setColor(...VisualSettings.lineRGB());
    }
  }

  renderTrackNearestGreenLine(gameCanvas, lineRGB = null) {
    const restoreRGB = lineRGB || VisualSettings.lineRGB();
    let pointNo = 0;
    for (pointNo = 0; pointNo < this.pointsCount - 1 && this.pointPositions[pointNo][0] <= this.minX; ++pointNo) {
    }
    if (pointNo > 0) {
      --pointNo;
    }
    while (pointNo < this.pointsCount - 1) {
      gameCanvas.drawLine(
        this.pointPositions[pointNo][0] << 3 >> 16,
        this.pointPositions[pointNo][1] << 3 >> 16,
        this.pointPositions[pointNo + 1][0] << 3 >> 16,
        this.pointPositions[pointNo + 1][1] << 3 >> 16
      );
      if (this.startFlagPoint === pointNo) {
        gameCanvas.renderStartFlag(
          this.pointPositions[this.startFlagPoint][0] << 3 >> 16,
          this.pointPositions[this.startFlagPoint][1] << 3 >> 16
        );
        gameCanvas.setColor(...restoreRGB);
      }
      if (this.finishFlagPoint === pointNo) {
        gameCanvas.renderFinishFlag(
          this.pointPositions[this.finishFlagPoint][0] << 3 >> 16,
          this.pointPositions[this.finishFlagPoint][1] << 3 >> 16
        );
        gameCanvas.setColor(...restoreRGB);
      }
      if (this.pointPositions[pointNo][0] > this.maxX) {
        break;
      }
      ++pointNo;
    }
  }
  addPointSimple(var1, var2) {
    this.addPoint(var1 << 16 >> 3, var2 << 16 >> 3);
  }
  addPoint(x, y) {
    if (this.pointPositions.length === 0 || this.pointPositions.length <= this.pointsCount) {
      let var3 = 100;
      if (this.pointPositions.length !== 0) {
        var3 = var3 < this.pointPositions.length + 30 ? this.pointPositions.length + 30 : var3;
      }
      const resized = new Array(var3);
      for (let i = 0; i < var3; ++i) {
        resized[i] = i < this.pointPositions.length ? this.pointPositions[i] : [0, 0];
      }
      this.pointPositions = resized;
    }
    if (this.pointsCount === 0 || this.pointPositions[this.pointsCount - 1][0] < x) {
      this.pointPositions[this.pointsCount][0] = x;
      this.pointPositions[this.pointsCount][1] = y;
      ++this.pointsCount;
    }
  }
  load(inStream) {
    this._fillCache = null;
    this.init();
    const c = inStream.readInt8();
    if (c === 50) {
      inStream.readBytes(20);
    }
    this.finishFlagPoint = 0;
    this.startFlagPoint = 0;
    this.startPosX = inStream.readInt32(true);
    this.startPosY = inStream.readInt32(true);
    this.finishPosX = inStream.readInt32(true);
    this.finishPosY = inStream.readInt32(true);
    const pointsCount = inStream.readInt16(true);
    let pointX = inStream.readInt32(true);
    let pointY = inStream.readInt32(true);
    let offsetX = pointX;
    let offsetY = pointY;
    this.addPointSimple(pointX, pointY);
    for (let i = 1; i < pointsCount; ++i) {
      const modeOrDx = inStream.readInt8();
      if (modeOrDx === -1) {
        offsetY = 0;
        offsetX = 0;
        pointX = inStream.readInt32(true);
        pointY = inStream.readInt32(true);
      } else {
        pointX = modeOrDx;
        pointY = inStream.readInt8();
      }
      offsetX += pointX;
      offsetY += pointY;
      this.addPointSimple(offsetX, offsetY);
    }
  }
}
export {
  GameLevel
};
