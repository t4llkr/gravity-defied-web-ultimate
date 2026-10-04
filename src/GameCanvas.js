import { VisualSettings } from "./VisualSettings.js";
import { MathF16 } from "./MathF16.js";
import { Micro } from "./Micro.js";
import { Timer } from "./Timer.js";
import { toInt } from "./cpp.js";
import { Font } from "./lcdui/Font.js";
import { FontStorage } from "./lcdui/FontStorage.js";
import { Graphics } from "./lcdui/Graphics.js";
import { Image } from "./lcdui/Image.js";
const SPLASH_URL = new URL("./assets/splash.png", import.meta.url).href
const LOGO_URL = new URL("./assets/logo.png", import.meta.url).href
const HELMET_URL = new URL("./assets/helmet.png", import.meta.url).href
const SPRITES_URL = new URL("./assets/sprites.png", import.meta.url).href
const BLUEARM_URL = new URL("./assets/bluearm.png", import.meta.url).href
const BLUELEG_URL = new URL("./assets/blueleg.png", import.meta.url).href
const BLUEBODY_URL = new URL("./assets/bluebody.png", import.meta.url).href
const ENGINE_URL = new URL("./assets/engine.png", import.meta.url).href
const FENDER_URL = new URL("./assets/fender.png", import.meta.url).href
class GameCanvas {
  static spriteOffsetX = [0, 0, 15, 15, 15, 0, 6, 12, 18, 18, 25, 25, 25, 37, 37, 37, 15, 32];
  static spriteOffsetY = [10, 25, 16, 20, 10, 0, 0, 0, 8, 0, 0, 6, 12, 0, 6, 12, 29, 18];
  static spriteSizeX = [15, 15, 8, 8, 3, 6, 6, 6, 7, 7, 12, 12, 12, 12, 12, 12, 16, 17];
  static spriteSizeY = [15, 15, 4, 4, 3, 10, 10, 10, 8, 8, 6, 6, 6, 6, 6, 6, 11, 22];
  canvas;
  ctx;
  graphics;
  bgPattern = null;
  bgPatternImg = null;
  micro;
  assetCaches;
  menuManager = null;
  dx = 0;
  dy = 0;
  engineSpriteWidth = 0;
  engineSpriteHeight = 0;
  fenderSpriteWidth = 0;
  fenderSpriteHeight = 0;
  gamePhysics = null;
  cameraOffsetX = 0;
  cameraOffsetY = 0;
  loadingScreenMode = 1;
  bodyPartsSpriteWidth = [0, 0, 0];
  bodyPartsSpriteHeight = [0, 0, 0];
  static defaultFontWidth00 = 25;
  timerTriggered = false;
  screenFont = FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_MEDIUM);
  isUiOverlayEnabled = true;
  timerMessage = "";
  timerId = 0;
  timers = [];
  isMenuButtonVisible = false;
  isBackButtonVisible = false;
  repaintHandler = null;
  static stringWithTime = "";
  time10MsToStringCache = new Array(100).fill("");
  timeInSeconds = -1;
  static flagAnimationTime = 0;
  static flagAnimationPhase = 0;
  startFlagAnimationTimeToSpriteNo = [12, 10, 11, 10];
  finishFlagAnumationTimeToSpriteNo = [14, 13, 15, 13];
  actionInputDelta = [[0, 0], [1, 0], [0, -1], [0, 0], [0, 0], [0, 1], [-1, 0]];
  keyInputDeltaByMode = [
    [[0, 0], [1, -1], [1, 0], [1, 1], [0, -1], [-1, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]],
    [[0, 0], [1, 0], [0, 0], [0, 0], [-1, 0], [0, -1], [0, 1], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [1, 0], [0, -1], [0, 1], [-1, 0], [0, 0], [0, 0], [0, 0]]
  ];
  inputMode = 2;
  activeActions = new Array(7).fill(false);
  activeKeys = new Array(10).fill(false);
  width;
  height2;
  height;
  helmetImage;
  helmetSpriteWidth;
  helmetSpriteHeight;
  isDrawingTime = true;
  splashImage;
  logoImage;
  bodyPartsImages = [null, null, null];
  engineImage = null;
  fenderImage = null;
  spritesImage;
  static async create(canvas, micro) {
    const [
      splashImage,
      logoImage,
      helmetImage,
      spritesImage,
      bluearmImage,
      bluelegImage,
      bluebodyImage,
      engineImage,
      fenderImage
    ] = await Promise.all([
      Image.load(SPLASH_URL),
      Image.load(LOGO_URL),
      Image.load(HELMET_URL),
      Image.load(SPRITES_URL),
      Image.load(BLUEARM_URL),
      Image.load(BLUELEG_URL),
      Image.load(BLUEBODY_URL),
      Image.load(ENGINE_URL),
      Image.load(FENDER_URL)
    ]);
    return new GameCanvas(canvas, micro, {
      splashImage,
      logoImage,
      helmetImage,
      spritesImage,
      bluearmImage,
      bluelegImage,
      bluebodyImage,
      engineImage,
      fenderImage
    });
  }
  constructor(canvas, micro, assetCaches) {
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      throw new Error("Canvas 2D context is not available");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.graphics = new Graphics(ctx);
    this.micro = micro;
    this.assetCaches = assetCaches;
    this.splashImage = assetCaches.splashImage;
    this.logoImage = assetCaches.logoImage;
    this.helmetImage = assetCaches.helmetImage;
    this.spritesImage = assetCaches.spritesImage;
    this.helmetSpriteWidth = this.helmetImage.getWidth() / 6;
    this.helmetSpriteHeight = this.helmetImage.getHeight() / 6;
    this.width = canvas.width;
    this.height = canvas.height;
    this.height2 = canvas.height;
    this.dy = this.height2;
    GameCanvas.defaultFontWidth00 = 25;
  }
  // Повторная привязка спрайтов после замены assetCaches (смена скина):
  // зеркало присваиваний конструктора + пересборка производных спрайтов.
  rebindSpriteImages() {
    this.helmetImage = this.assetCaches.helmetImage;
    this.spritesImage = this.assetCaches.spritesImage;
    this.helmetSpriteWidth = this.helmetImage.getWidth() / 6;
    this.helmetSpriteHeight = this.helmetImage.getHeight() / 6;
    if (this.loadedSpriteFlags !== null && this.loadedSpriteFlags !== undefined) {
      void this.loadSprites(this.loadedSpriteFlags);
    }
  }
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.height2 = height;
  }
  getWidth() {
    return this.width;
  }
  getHeight() {
    return this.height2;
  }
  getGraphics() {
    return this.graphics;
  }
  beginFrame() {
    void this.micro;
    void this.cameraOffsetX;
    void this.cameraOffsetY;
    void this.loadingScreenMode;
    this.graphics.clipRect = null;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.processTimers();
  }
  drawSprite(g, spriteNo, x, y) {
    g.setClip(x, y, GameCanvas.spriteSizeX[spriteNo], GameCanvas.spriteSizeY[spriteNo]);
    g.drawImage(
      this.spritesImage,
      x - GameCanvas.spriteOffsetX[spriteNo],
      y - GameCanvas.spriteOffsetY[spriteNo],
      Graphics.LEFT | Graphics.TOP
    );
    g.setClip(0, 0, this.getWidth(), this.getHeight());
  }
  requestRepaint(var1) {
    this.loadingScreenMode = var1;
    if (var1 === 0) {
      this.splashImage = null;
      this.logoImage = null;
    } else {
      this.repaint();
      this.serviceRepaints();
    }
  }
  setUiOverlayEnabled(var1) {
    this.isUiOverlayEnabled = var1;
    void this.isUiOverlayEnabled;
    this.repaint();
  }
  init(gamePhysics) {
    this.gamePhysics = gamePhysics;
    gamePhysics.setMinimalScreenWH(this.width < this.height2 ? this.width : this.height2);
  }
  async loadSprites(flags) {
    if ((flags & 1) !== 0) {
      this.fenderImage = this.assetCaches.fenderImage;
      this.engineImage = this.assetCaches.engineImage;
      this.fenderSpriteWidth = this.fenderImage.getWidth() / 6;
      this.fenderSpriteHeight = this.fenderImage.getHeight() / 6;
      this.engineSpriteWidth = this.engineImage.getWidth() / 6;
      this.engineSpriteHeight = this.engineImage.getHeight() / 6;
    } else {
      this.fenderImage = null;
      this.engineImage = null;
    }
    if ((flags & 2) !== 0) {
      this.bodyPartsImages[1] = this.assetCaches.bluelegImage;
      this.bodyPartsSpriteWidth[1] = this.bodyPartsImages[1].getWidth() / 6;
      this.bodyPartsSpriteHeight[1] = this.bodyPartsImages[1].getHeight() / 3;
      this.bodyPartsImages[0] = this.assetCaches.bluearmImage;
      this.bodyPartsSpriteWidth[0] = this.bodyPartsImages[0].getWidth() / 6;
      this.bodyPartsSpriteHeight[0] = this.bodyPartsImages[0].getHeight() / 3;
      this.bodyPartsImages[2] = this.assetCaches.bluebodyImage;
      this.bodyPartsSpriteWidth[2] = this.bodyPartsImages[2].getWidth() / 6;
      this.bodyPartsSpriteHeight[2] = this.bodyPartsImages[2].getHeight() / 3;
    } else {
      this.bodyPartsImages[0] = null;
      this.bodyPartsImages[1] = null;
      this.bodyPartsImages[2] = null;
    }
    return flags;
  }
  resetInputState() {
    this.clearActiveInputs();
  }
  setViewPosition(dx, dy) {
    this.dx = dx;
    this.dy = dy;
    this.gamePhysics?.setRenderMinMaxX(-dx, -dx + this.width);
  }
  getDx() {
    return this.dx;
  }
  addDx(x) {
    return x + this.dx;
  }
  addDy(y) {
    return -y + this.dy;
  }
  buildPolygonPath(quads) {
    const path = new Path2D();
    for (let q = 0; q < quads.length; q++) {
      const quad = quads[q];
      path.moveTo(this.addDx(quad[0][0]), this.addDy(quad[0][1]));
      for (let i = 1; i < quad.length; i++) {
        path.lineTo(this.addDx(quad[i][0]), this.addDy(quad[i][1]));
      }
      path.closePath();
    }
    return path;
  }
  fillPolygonPath(path) {
    this.graphics.withClip(() => {
      this.graphics.ctx.fill(path);
    });
  }
  fillPolygon(points) {
    this.graphics.withClip(() => {
      const ctx = this.graphics.ctx;
      ctx.beginPath();
      ctx.moveTo(this.addDx(points[0][0]), this.addDy(points[0][1]));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(this.addDx(points[i][0]), this.addDy(points[i][1]));
      }
      ctx.closePath();
      ctx.fill();
    });
  }
  drawLine(x, y, x2, y2) {
    this.graphics.drawLine(this.addDx(x), this.addDy(y), this.addDx(x2), this.addDy(y2));
  }
  drawLineF16(x, y, x2, y2) {
    this.graphics.drawLine(this.addDx(x << 2 >> 16), this.addDy(y << 2 >> 16), this.addDx(x2 << 2 >> 16), this.addDy(y2 << 2 >> 16));
  }
  renderBodyPart(x1F16, y1F16, x2F16, y2F16, bodyPartNo, tF16 = 32768) {
    const x = this.addDx(toInt(BigInt(x2F16) * BigInt(tF16) >> 16n) + toInt(BigInt(x1F16) * BigInt(65536 - tF16) >> 16n) >> 16);
    const y = this.addDy(toInt(BigInt(y2F16) * BigInt(tF16) >> 16n) + toInt(BigInt(y1F16) * BigInt(65536 - tF16) >> 16n) >> 16);
    const angleFP16 = MathF16.atan2F16(x2F16 - x1F16, y2F16 - y1F16);
    const spriteNo = this.calcSpriteNo(angleFP16, 0, 205887, 16, false);
    if (this.bodyPartsImages[bodyPartNo] !== null) {
      let drawX = x - Math.trunc(this.bodyPartsSpriteWidth[bodyPartNo] / 2);
      let drawY = y - Math.trunc(this.bodyPartsSpriteHeight[bodyPartNo] / 2);
      this.graphics.setClip(drawX, drawY, this.bodyPartsSpriteWidth[bodyPartNo], this.bodyPartsSpriteHeight[bodyPartNo]);
      this.graphics.drawImage(
        this.bodyPartsImages[bodyPartNo],
        drawX - this.bodyPartsSpriteWidth[bodyPartNo] * (spriteNo % 6),
        drawY - this.bodyPartsSpriteHeight[bodyPartNo] * Math.trunc(spriteNo / 6),
        Graphics.LEFT | Graphics.TOP
      );
      this.graphics.setClip(0, 0, this.width, this.getHeight());
      drawX = drawX;
      drawY = drawY;
    }
  }
  drawWheelArc(var1, var2, var3, var4) {
    ++var3;
    const var5 = this.addDx(var1 - var3);
    const var6 = this.addDy(var2 + var3);
    const var7 = var3 << 1;
    let angle = -toInt((BigInt(toInt(BigInt(var4) * 11796480n >> 16n)) << 32n) / 205887n >> 16n);
    if (angle < 0) {
      angle += 360;
    }
    this.graphics.drawArc(var5, var6, var7, var7, (angle >> 16) + 170, 90);
  }
  drawCircle(x, y, size) {
    const radius = Math.trunc(size / 2);
    const localX = this.addDx(x - radius);
    const localY = this.addDy(y + radius);
    this.graphics.drawArc(localX, localY, size, size, 0, 360);
  }
  fillRect(x, y, w, h) {
    this.graphics.fillRect(this.addDx(x), this.addDy(y), w, h);
  }
  drawForthSpriteByCenter(centerX, centerY) {
    const halfSizeX = Math.trunc(GameCanvas.spriteSizeX[4] / 2);
    const halfSizeY = Math.trunc(GameCanvas.spriteSizeY[4] / 2);
    this.drawSprite(this.graphics, 4, this.addDx(centerX - halfSizeX), this.addDy(centerY + halfSizeY));
  }
  drawHelmet(x, y, angleF16) {
    const var4 = this.calcSpriteNo(angleF16, -102943, 411774, 32, true);
    const var5 = this.addDx(x) - Math.trunc(this.helmetSpriteWidth / 2);
    const var6 = this.addDy(y) - Math.trunc(this.helmetSpriteHeight / 2);
    this.graphics.setClip(var5, var6, this.helmetSpriteWidth, this.helmetSpriteHeight);
    this.graphics.drawImage(
      this.helmetImage,
      var5 - this.helmetSpriteWidth * (var4 % 6),
      var6 - this.helmetSpriteHeight * Math.trunc(var4 / 6),
      Graphics.LEFT | Graphics.TOP
    );
    this.graphics.setClip(0, 0, this.width, this.getHeight());
  }
  drawTime(time10Ms) {
    const seconds = Math.trunc(time10Ms / 100);
    const time10MsPart = Math.trunc(time10Ms % 100);
    if (this.timeInSeconds !== seconds || GameCanvas.stringWithTime.length === 0) {
      const zeroPadding = seconds % 60 >= 10 ? "" : "0";
      GameCanvas.stringWithTime = `${Math.trunc(seconds / 60)}:${zeroPadding}${seconds % 60}.`;
      this.timeInSeconds = seconds;
    }
    if (this.time10MsToStringCache[time10MsPart].length === 0) {
      const zeroPadding = time10MsPart >= 10 ? "" : "0";
      this.time10MsToStringCache[time10MsPart] = `${zeroPadding}${time10Ms % 100}`;
    }
    this.setColor(...VisualSettings.textRGB());
    this.graphics.setFont(FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_MEDIUM));
    if (time10Ms > 36e5) {
      this.graphics.drawString("0:00.", this.width - GameCanvas.defaultFontWidth00, this.height2 - 20, Graphics.RIGHT | Graphics.TOP);
      this.graphics.drawString("00", this.width - GameCanvas.defaultFontWidth00, this.height2 - 20, Graphics.LEFT | Graphics.TOP);
    } else {
      this.graphics.drawString(GameCanvas.stringWithTime, this.width - GameCanvas.defaultFontWidth00, this.height2 - 20, Graphics.RIGHT | Graphics.TOP);
      this.graphics.drawString(this.time10MsToStringCache[time10MsPart], this.width - GameCanvas.defaultFontWidth00, this.height2 - 20, Graphics.LEFT | Graphics.TOP);
    }
  }
  handleTimerFired(var1) {
    if (this.timerId === var1) {
      this.timerTriggered = true;
    }
  }
  static advanceFlagAnimation() {
    GameCanvas.flagAnimationPhase += 655;
    const sinVal = MathF16.sinF16(GameCanvas.flagAnimationPhase);
    const var0 = 32768 + ((sinVal < 0 ? -sinVal : sinVal) >> 1);
    GameCanvas.flagAnimationTime += 6553 * var0 >> 16;
  }
  renderStartFlag(x, y) {
    if (GameCanvas.flagAnimationTime > 229376) {
      GameCanvas.flagAnimationTime = 0;
    }
    // стойка — чёрная, как в оригинале (не цвет текста)
    this.setColor(0, 0, 0);
    this.drawLine(x, y, x, y + 32);
    this.drawSprite(this.graphics, this.startFlagAnimationTimeToSpriteNo[GameCanvas.flagAnimationTime >> 16], this.addDx(x), this.addDy(y) - 32);
  }
  renderFinishFlag(x, y) {
    if (GameCanvas.flagAnimationTime > 229376) {
      GameCanvas.flagAnimationTime = 0;
    }
    // стойка — чёрная, как в оригинале (не цвет текста)
    this.setColor(0, 0, 0);
    this.drawLine(x, y, x, y + 32);
    this.drawSprite(this.graphics, this.finishFlagAnumationTimeToSpriteNo[GameCanvas.flagAnimationTime >> 16], this.addDx(x), this.addDy(y) - 32);
  }
  drawWheelTires(x, y, wheelIsThin) {
    const spriteNo = wheelIsThin === 1 ? 0 : 1;
    const spriteHalfX = Math.trunc(GameCanvas.spriteSizeX[spriteNo] / 2);
    const spriteHalfY = Math.trunc(GameCanvas.spriteSizeY[spriteNo] / 2);
    this.drawSprite(this.graphics, spriteNo, this.addDx(x - spriteHalfX), this.addDy(y + spriteHalfY));
  }
  calcSpriteNo(angleF16, var2, var3, var4, var5) {
    for (angleF16 += var2; angleF16 < 0; angleF16 += var3) {
    }
    while (angleF16 >= var3) {
      angleF16 -= var3;
    }
    if (var5) {
      angleF16 = var3 - angleF16;
    }
    const var6 = toInt(BigInt(toInt((BigInt(angleF16) << 32n) / BigInt(var3) >> 16n)) * BigInt(var4 << 16) >> 16n);
    return var6 >> 16 < var4 - 1 ? var6 >> 16 : var4 - 1;
  }
  renderEngine(x, y, angleF16) {
    if (this.engineImage === null) {
      return;
    }
    const spriteNo = this.calcSpriteNo(angleF16, -247063, 411774, 32, true);
    const centerX = this.addDx(x) - Math.trunc(this.engineSpriteWidth / 2);
    const centerY = this.addDy(y) - Math.trunc(this.engineSpriteHeight / 2);
    this.graphics.setClip(centerX, centerY, this.engineSpriteWidth, this.engineSpriteHeight);
    this.graphics.drawImage(
      this.engineImage,
      centerX - this.engineSpriteWidth * (spriteNo % 6),
      centerY - this.engineSpriteHeight * Math.trunc(spriteNo / 6),
      Graphics.LEFT | Graphics.TOP
    );
    this.graphics.setClip(0, 0, this.width, this.getHeight());
  }
  renderFender(x, y, angleF16) {
    if (this.fenderImage === null) {
      return;
    }
    const spriteNo = this.calcSpriteNo(angleF16, -185297, 411774, 32, true);
    const centerX = this.addDx(x) - Math.trunc(this.fenderSpriteWidth / 2);
    const centerY = this.addDy(y) - Math.trunc(this.fenderSpriteHeight / 2);
    this.graphics.setClip(centerX, centerY, this.fenderSpriteWidth, this.fenderSpriteHeight);
    this.graphics.drawImage(
      this.fenderImage,
      centerX - this.fenderSpriteWidth * (spriteNo % 6),
      centerY - this.fenderSpriteHeight * Math.trunc(spriteNo / 6),
      Graphics.LEFT | Graphics.TOP
    );
    this.graphics.setClip(0, 0, this.width, this.getHeight());
  }
  clearScreenWithWhite() {
    let img = VisualSettings.settings.showBgImage ? VisualSettings.bgImage : null;
    let gifFrame = null;
    if (img === null && VisualSettings.settings.showBgImage) {
      gifFrame = VisualSettings.currentGifFrame();
      if (gifFrame !== null) {
        img = gifFrame;
      }
    }
    if (img !== null && (gifFrame !== null || img.complete && img.naturalWidth > 0)) {
      this.graphics.withClip(() => {
        const ctx = this.graphics.ctx;
        const w = this.width;
        const h = this.height2;
        // подложка цветом фона — единообразное поведение альфа-канала во всех режимах
        this.graphics.setColor(...VisualSettings.bgRGB());
        this.graphics.fillRect(0, 0, w, h);
        const mode = VisualSettings.settings.bgImageMode;
        if (mode === "tile") {
          if (this.bgPattern === null || this.bgPatternImg !== img) {
            this.bgPattern = ctx.createPattern(img, "repeat");
            this.bgPatternImg = img;
          }
          if (this.bgPattern !== null) {
            ctx.save();
            ctx.fillStyle = this.bgPattern;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }
        } else {
          if (mode === "fit") {
            const iw = img.naturalWidth > 0 ? img.naturalWidth : img.width;
            const ih = img.naturalHeight > 0 ? img.naturalHeight : img.height;
            const scale = Math.min(w / iw, h / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
          } else {
            ctx.drawImage(img, 0, 0, w, h);
          }
        }
      });
      return;
    }
    this.graphics.setColor(...VisualSettings.bgRGB());
    this.graphics.fillRect(0, 0, this.width, this.height2);
  }
  setColor(red, green, blue) {
    if (Micro.isInGameMenu) {
      red += 128;
      green += 128;
      blue += 128;
      if (red > 240) {
        red = 240;
      }
      if (green > 240) {
        green = 240;
      }
      if (blue > 240) {
        blue = 240;
      }
    }
    this.graphics.setColor(red, green, blue);
  }
  drawProgressBar(var1, mode) {
    const h = mode ? this.height : this.height2;
    this.setColor(0, 0, 0);
    this.graphics.fillRect(1, h - 4, this.width - 2, 3);
    this.setColor(255, 255, 255);
    this.graphics.fillRect(2, h - 3, toInt(BigInt(this.width - 4 << 16) * BigInt(var1) >> 16n) >> 16, 1);
  }
  drawTimerMessage() {
    if (this.timerMessage.length === 0) {
      return;
    }
    this.setColor(...VisualSettings.textRGB());
    this.graphics.setFont(this.screenFont);
    if (this.height2 <= 128) {
      this.graphics.drawString(this.timerMessage, Math.trunc(this.width / 2), 1, Graphics.HCENTER | Graphics.TOP);
    } else {
      this.graphics.drawString(this.timerMessage, Math.trunc(this.width / 2), Math.trunc(this.height2 / 4), Graphics.HCENTER | Graphics.VCENTER);
    }
    if (this.timerTriggered) {
      this.timerTriggered = false;
      this.timerMessage = "";
    }
  }
  setInputMode(var1) {
    this.inputMode = var1;
  }
  drawGame(g) {
    if (!Micro.isGameVisible || this.micro.isLoadingBlocked || this.gamePhysics === null) {
      return;
    }
    if (this.loadingScreenMode !== 0) {
      g.setColor(255, 255, 255);
      g.fillRect(0, 0, this.getWidth(), this.getHeight());
      if (this.loadingScreenMode === 1) {
        if (this.logoImage !== null) {
          g.drawImage(this.logoImage, this.getWidth() >> 1, this.getHeight() >> 1, Graphics.HCENTER | Graphics.VCENTER);
          this.drawSprite(g, 16, this.getWidth() - GameCanvas.spriteSizeX[16] - 5, this.getHeight() - GameCanvas.spriteSizeY[16] - 7);
          this.drawSprite(
            g,
            17,
            this.getWidth() - GameCanvas.spriteSizeX[17] - 4,
            this.getHeight() - GameCanvas.spriteSizeY[17] - GameCanvas.spriteSizeY[16] - 9
          );
        }
      } else if (this.splashImage !== null) {
        g.drawImage(this.splashImage, this.getWidth() >> 1, this.getHeight() >> 1, Graphics.HCENTER | Graphics.VCENTER);
      }
      const var3 = toInt((BigInt(Micro.gameLoadingStateStage << 16) << 32n) / 655360n >> 16n);
      this.drawProgressBar(var3, true);
      return;
    }
    this.gamePhysics.setMotoComponents();
    this.setViewPosition(-this.gamePhysics.getCamPosX() + this.cameraOffsetX + (this.width >> 1), this.gamePhysics.getCamPosY() + this.cameraOffsetY + (this.height2 >> 1));
    this.gamePhysics.renderGame(this);
    if (this.isDrawingTime) {
      this.drawTime(this.micro.gameTimeMs / 10);
    }
    this.drawTimerMessage();
    this.drawProgressBar(this.gamePhysics.getProgressF16(), false);
  }
  paint(g) {
    this.beginFrame();
    // открыт оверлей пресетов: вместо меню рисуем игровой кадр —
    // изменения визуала видны сразу за полупрозрачной панелью
    const presetsOpen = window.__gdPresetsOpen === true;
    if (Micro.isInGameMenu && this.menuManager !== null && (!presetsOpen || this.menuManager.gameLevel === null)) {
      this.menuManager.renderCurrentMenu(g);
      return;
    }
    this.drawGame(g);
  }
  clearActiveInputs() {
    for (let var1 = 0; var1 < 10; ++var1) {
      this.activeKeys[var1] = false;
    }
    for (let var1 = 0; var1 < 7; ++var1) {
      this.activeActions[var1] = false;
    }
  }
  handleUpdatedInput() {
    let var1 = 0;
    let var2 = 0;
    const var3 = this.inputMode;
    for (let var4 = 0; var4 < 10; ++var4) {
      if (this.activeKeys[var4]) {
        var1 += this.keyInputDeltaByMode[var3][var4][0];
        var2 += this.keyInputDeltaByMode[var3][var4][1];
      }
    }
    for (let var4 = 0; var4 < 7; ++var4) {
      if (this.activeActions[var4]) {
        var1 += this.actionInputDelta[var4][0];
        var2 += this.actionInputDelta[var4][1];
      }
    }
    this.gamePhysics?.setInputDirection(var1, var2);
  }
  processTimers() {
    for (let i = 0; i < this.timers.length; ) {
      if (this.timers[i].ready()) {
        this.handleTimerFired(this.timers[i].getId());
        this.timers.splice(i, 1);
      } else {
        ++i;
      }
    }
  }
  processKeyPressed(keyCode) {
    const action = this.getGameAction(keyCode);
    const numKey = keyCode - 48;
    if (numKey >= 0 && numKey < 10) {
      this.activeKeys[numKey] = true;
    } else if (action >= 0 && action < 7) {
      this.activeActions[action] = true;
    }
    this.handleUpdatedInput();
  }
  processKeyReleased(keyCode) {
    const action = this.getGameAction(keyCode);
    const numKey = keyCode - 48;
    if (numKey >= 0 && numKey < 10) {
      this.activeKeys[numKey] = false;
    } else if (action >= 0 && action < 7) {
      this.activeActions[action] = false;
    }
    this.handleUpdatedInput();
  }
  getGameAction(keyCode) {
    switch (keyCode) {
      case 1:
      case 2:
      case 5:
      case 6:
      case 8:
        return keyCode;
      default:
        return -1;
    }
  }
  scheduleGameTimerTask(timerMessage, delayMs) {
    this.timerTriggered = false;
    ++this.timerId;
    this.timerMessage = timerMessage;
    this.timers.push(new Timer(this.timerId, delayMs));
  }
  setMenuManager(menuManager) {
    this.menuManager = menuManager;
  }
  setRepaintHandler(repaintHandler) {
    this.repaintHandler = repaintHandler;
  }
  openPauseMenu() {
    if (this.menuManager !== null) {
      this.menuManager.isOpeningPauseMenu = true;
      this.micro.gameToMenu();
    }
  }
  handleBackAction() {
    if (Micro.isInGameMenu) {
      this.menuManager?.handleBackAction();
    }
  }
  keyPressed(var1) {
    if (Micro.isInGameMenu && this.menuManager !== null) {
      this.menuManager.processKeyCode(var1);
    }
    this.processKeyPressed(var1);
  }
  keyReleased(var1) {
    this.processKeyReleased(var1);
  }
  showMenuButton() {
    this.isMenuButtonVisible = true;
  }
  hideMenuButton() {
    this.isMenuButtonVisible = false;
  }
  hasMenuButton() {
    return this.isMenuButtonVisible;
  }
  showBackButton() {
    this.isBackButtonVisible = true;
  }
  hideBackButton() {
    this.isBackButtonVisible = false;
  }
  hasBackButton() {
    return this.isBackButtonVisible;
  }
  repaint() {
    this.repaintHandler?.();
  }
  serviceRepaints() {
    this.repaintHandler?.();
  }
}
export {
  GameCanvas
};
