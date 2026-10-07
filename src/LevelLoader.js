import { VisualSettings } from "./VisualSettings.js";
import { INT_MAX, INT_MIN, abs, divideF16, multiplyF16 } from "./cpp.js";
import { GameLevel } from "./GameLevel.js";
import { GamePhysics } from "./GamePhysics.js";
import { FileStream } from "./utils/FileStream.js";
class LevelLoader {
  static shapeIndex0 = 0;
  static shapeIndex1 = 1;
  static shapeIndex2 = 2;
  static collisionResult0 = 0;
  static collisionResult1 = 1;
  static isEnabledPerspective = true;
  static isEnabledShadows = true;
  edgeNormalsF16 = [];
  outerCollisionRadiusSqByShape = [0, 0, 0];
  innerCollisionRadiusSqByShape = [0, 0, 0];
  levelOffsetInFile = [[], [], []];
  edgeNormalsCapacity = 0;
  static visibleStartPointIndex = 0;
  static visibleEndPointIndex = 0;
  static visibleStartPointX = 0;
  static visibleEndPointX = 0;
  levelFileStream;
  gameLevel = null;
  currentLeagueIndex = 0;
  currentTrackIndex = -1;
  levelNames = [[], [], []];
  startPosXF16 = 0;
  startPosYF16 = 0;
  maxTrackPointX = 0;
  collisionNormalXF16 = 0;
  collisionNormalYF16 = 0;
  static async create(levelsMrgUrl) {
    const levelFileStream = await FileStream.fromUrl(levelsMrgUrl);
    return new LevelLoader(levelFileStream);
  }
  constructor(levelFileStream) {
    for (let i = 0; i < 3; ++i) {
      const var1 = GamePhysics.const175_1_half[i] + 19660 >> 1;
      const var2 = GamePhysics.const175_1_half[i] - 19660 >> 1;
      this.outerCollisionRadiusSqByShape[i] = multiplyF16(var1, var1);
      this.innerCollisionRadiusSqByShape[i] = multiplyF16(var2, var2);
    }
    this.levelFileStream = levelFileStream;
    this.loadLevels();
    this.loadNextLevel();
  }
  loadLevels() {
    const var4 = [0, 0, 0];
    const decoder = new TextDecoder("ascii");
    for (let league = 0; league < 3; ++league) {
      var4[league] = this.levelFileStream.readInt32(true);
      this.levelOffsetInFile[league] = new Array(var4[league]);
      this.levelNames[league] = new Array(var4[league]);
      for (let levelNo = 0; levelNo < var4[league]; ++levelNo) {
        const var7 = this.levelFileStream.readInt32(true);
        this.levelOffsetInFile[league][levelNo] = var7;
        const raw = new Uint8Array(40);
        let zeroIndex = 40;
        for (let var8 = 0; var8 < 40; ++var8) {
          raw[var8] = this.levelFileStream.readInt8();
          if (raw[var8] === 0) {
            zeroIndex = var8;
            break;
          }
        }
        const s = decoder.decode(raw.slice(0, zeroIndex)).replaceAll("_", " ");
        this.levelNames[league][levelNo] = s;
      }
    }
  }
  getName(league, level) {
    return league < 3 && level < this.levelNames[league].length ? this.levelNames[league][level] : "---";
  }
  loadNextLevel() {
    this.loadLevel(this.currentLeagueIndex, this.currentTrackIndex + 1);
  }
  loadLevel(var1, var2) {
    this.currentLeagueIndex = var1;
    this.currentTrackIndex = var2;
    if (this.currentTrackIndex >= this.levelNames[this.currentLeagueIndex].length) {
      this.currentTrackIndex = 0;
    }
    this.readLevelFromArchive(this.currentLeagueIndex + 1, this.currentTrackIndex + 1);
    return this.currentTrackIndex;
  }
  readLevelFromArchive(var1, var2) {
    this.levelFileStream.setPos(this.levelOffsetInFile[var1 - 1][var2 - 1]);
    if (this.gameLevel === null) {
      this.gameLevel = new GameLevel();
    }
    this.gameLevel.load(this.levelFileStream);
    this.prepareLevelGeometry(this.gameLevel);
  }
  cacheStartPosition(var1) {
    void var1;
    if (this.gameLevel === null) {
      return;
    }
    this.startPosXF16 = this.gameLevel.startPosX << 1;
    this.startPosYF16 = this.gameLevel.startPosY << 1;
  }
  getFinishX() {
    if (this.gameLevel === null) {
      return 0;
    }
    return this.gameLevel.pointPositions[this.gameLevel.finishFlagPoint][0] << 1;
  }
  getStartX() {
    if (this.gameLevel === null) {
      return 0;
    }
    return this.gameLevel.pointPositions[this.gameLevel.startFlagPoint][0] << 1;
  }
  getStartPosX() {
    return this.gameLevel === null ? 0 : this.gameLevel.startPosX << 1;
  }
  getStartPosY() {
    return this.gameLevel === null ? 0 : this.gameLevel.startPosY << 1;
  }
  getProgressF16(var1) {
    return this.gameLevel === null ? 0 : this.gameLevel.getProgressF16(var1 >> 1);
  }
  prepareLevelGeometry(gameLevel) {
    this.maxTrackPointX = INT_MIN;
    this.gameLevel = gameLevel;
    const var2 = gameLevel.pointsCount;
    if (this.edgeNormalsF16.length === 0 || this.edgeNormalsCapacity < var2) {
      this.edgeNormalsCapacity = var2 < 100 ? 100 : var2;
      this.edgeNormalsF16 = new Array(this.edgeNormalsCapacity);
      for (let i = 0; i < this.edgeNormalsCapacity; ++i) {
        this.edgeNormalsF16[i] = [0, 0];
      }
    }
    LevelLoader.visibleStartPointIndex = 0;
    LevelLoader.visibleEndPointIndex = 0;
    LevelLoader.visibleStartPointX = gameLevel.pointPositions[LevelLoader.visibleStartPointIndex][0];
    LevelLoader.visibleEndPointX = gameLevel.pointPositions[LevelLoader.visibleEndPointIndex][0];
    for (let var3 = 0; var3 < var2; ++var3) {
      const var4 = gameLevel.pointPositions[(var3 + 1) % var2][0] - gameLevel.pointPositions[var3][0];
      const var5 = gameLevel.pointPositions[(var3 + 1) % var2][1] - gameLevel.pointPositions[var3][1];
      if (var3 !== 0 && var3 !== var2 - 1) {
        this.maxTrackPointX = this.maxTrackPointX < gameLevel.pointPositions[var3][0] ? gameLevel.pointPositions[var3][0] : this.maxTrackPointX;
      }
      const var6 = -var5;
      const var8 = GamePhysics.getSmthLikeMaxAbs(var6, var4);
      this.edgeNormalsF16[var3][0] = divideF16(var6, var8);
      this.edgeNormalsF16[var3][1] = divideF16(var4, var8);
      if (gameLevel.startFlagPoint === 0 && gameLevel.pointPositions[var3][0] > gameLevel.startPosX) {
        gameLevel.startFlagPoint = var3 + 1;
      }
      if (gameLevel.finishFlagPoint === 0 && gameLevel.pointPositions[var3][0] > gameLevel.finishPosX) {
        gameLevel.finishFlagPoint = var3;
      }
    }
    LevelLoader.visibleStartPointIndex = 0;
    LevelLoader.visibleEndPointIndex = 0;
    LevelLoader.visibleStartPointX = 0;
    LevelLoader.visibleEndPointX = 0;
  }
  setMinMaxX(minX, maxX) {
    this.gameLevel?.setMinMaxX(minX, maxX);
  }
  renderLevel3D(gameCanvas, xF16, yF16) {
    if (this.gameLevel === null) {
      return;
    }
    gameCanvas.setColor(...VisualSettings.lineRGB());
    xF16 >>= 1;
    yF16 >>= 1;
    this.gameLevel.renderLevel3D(gameCanvas, xF16, yF16);
  }
  renderTrackEffects(gameCanvas, xF16, yF16, withFill = true) {
    if (this.gameLevel === null) {
      return;
    }
    this.gameLevel.renderTrackEffects(gameCanvas, xF16 >> 1, yF16 >> 1, withFill);
  }
  renderTrackNearestLine(canvas) {
    if (this.gameLevel === null) {
      return;
    }
    // скрытие линий (при fill) убирает и поверхность — иначе остаётся
    // «тёмная линия трассы» поверх заливки
    if (LevelLoader.isEnabledPerspective
        && VisualSettings.settings.hideLines === true
        && VisualSettings.settings.fillEnabled === true) {
      return;
    }
    // линия поверхности — основной цвет линий (в обоих режимах)
    const rgb = VisualSettings.lineRGB();
    canvas.setColor(...rgb);
    this.gameLevel.renderTrackNearestGreenLine(canvas, rgb);
  }
  updateVisiblePointRange(var1, var2, var3) {
    if (this.gameLevel === null) {
      return;
    }
    this.gameLevel.setShadowProjectionState(var1 + 98304 >> 1, var2 - 98304 >> 1, var3 >> 1);
    var2 >>= 1;
    var1 >>= 1;
    LevelLoader.visibleEndPointIndex = LevelLoader.visibleEndPointIndex < this.gameLevel.pointsCount - 1 ? LevelLoader.visibleEndPointIndex : this.gameLevel.pointsCount - 1;
    LevelLoader.visibleStartPointIndex = LevelLoader.visibleStartPointIndex < 0 ? 0 : LevelLoader.visibleStartPointIndex;
    if (var2 > LevelLoader.visibleEndPointX) {
      while (LevelLoader.visibleEndPointIndex < this.gameLevel.pointsCount - 1 && var2 > this.gameLevel.pointPositions[++LevelLoader.visibleEndPointIndex][0]) {
      }
    } else if (var1 < LevelLoader.visibleStartPointX) {
      while (LevelLoader.visibleStartPointIndex > 0 && var1 < this.gameLevel.pointPositions[--LevelLoader.visibleStartPointIndex][0]) {
      }
    } else {
      while (LevelLoader.visibleStartPointIndex < this.gameLevel.pointsCount && var1 > this.gameLevel.pointPositions[++LevelLoader.visibleStartPointIndex][0]) {
      }
      if (LevelLoader.visibleStartPointIndex > 0) {
        --LevelLoader.visibleStartPointIndex;
      }
      while (LevelLoader.visibleEndPointIndex > 0 && var2 < this.gameLevel.pointPositions[--LevelLoader.visibleEndPointIndex][0]) {
      }
      LevelLoader.visibleEndPointIndex = LevelLoader.visibleEndPointIndex + 1 < this.gameLevel.pointsCount - 1 ? LevelLoader.visibleEndPointIndex + 1 : this.gameLevel.pointsCount - 1;
    }
    LevelLoader.visibleStartPointX = this.gameLevel.pointPositions[LevelLoader.visibleStartPointIndex][0];
    LevelLoader.visibleEndPointX = this.gameLevel.pointPositions[LevelLoader.visibleEndPointIndex][0];
  }
  detectCollision(var1, var2) {
    if (this.gameLevel === null) {
      return 2;
    }
    let var16 = 0;
    let var17 = 2;
    const var18 = var1.xF16 >> 1;
    let var19 = var1.yF16 >> 1;
    if (LevelLoader.isEnabledPerspective) {
      var19 -= 65536;
    }
    let var20 = 0;
    let var21 = 0;
    for (let var22 = LevelLoader.visibleStartPointIndex; var22 < LevelLoader.visibleEndPointIndex; ++var22) {
      let var4 = this.gameLevel.pointPositions[var22][0];
      let var5 = this.gameLevel.pointPositions[var22][1];
      let var6 = this.gameLevel.pointPositions[var22 + 1][0];
      const var7 = this.gameLevel.pointPositions[var22 + 1][1];
      if (var18 - this.outerCollisionRadiusSqByShape[var2] <= var6 && var18 + this.outerCollisionRadiusSqByShape[var2] >= var4) {
        let var8 = var4 - var6;
        let var9 = var5 - var7;
        const var10 = multiplyF16(var8, var8) + multiplyF16(var9, var9);
        const var11 = multiplyF16(var18 - var4, -var8) + multiplyF16(var19 - var5, -var9);
        let var12;
        if (abs(var10) >= 3) {
          var12 = divideF16(var11, var10);
        } else {
          var12 = (var11 > 0 ? 1 : -1) * (var10 > 0 ? 1 : -1) * INT_MAX;
        }
        if (var12 < 0) {
          var12 = 0;
        }
        if (var12 > 65536) {
          var12 = 65536;
        }
        const var13 = var4 + multiplyF16(var12, -var8);
        const var14 = var5 + multiplyF16(var12, -var9);
        var8 = var18 - var13;
        var9 = var19 - var14;
        let var3;
        const var23 = BigInt(multiplyF16(var8, var8)) + BigInt(multiplyF16(var9, var9));
        if (var23 < BigInt(this.outerCollisionRadiusSqByShape[var2])) {
          if (var23 >= BigInt(this.innerCollisionRadiusSqByShape[var2])) {
            var3 = 1;
          } else {
            var3 = 0;
          }
        } else {
          var3 = 2;
        }
        if (var3 === 0 && multiplyF16(this.edgeNormalsF16[var22][0], var1.velocityXF16) + multiplyF16(this.edgeNormalsF16[var22][1], var1.velocityYF16) < 0) {
          this.collisionNormalXF16 = this.edgeNormalsF16[var22][0];
          this.collisionNormalYF16 = this.edgeNormalsF16[var22][1];
          return 0;
        }
        if (var3 === 1 && multiplyF16(this.edgeNormalsF16[var22][0], var1.velocityXF16) + multiplyF16(this.edgeNormalsF16[var22][1], var1.velocityYF16) < 0) {
          ++var16;
          var17 = 1;
          if (var16 === 1) {
            var20 = this.edgeNormalsF16[var22][0];
            var21 = this.edgeNormalsF16[var22][1];
          } else {
            var20 += this.edgeNormalsF16[var22][0];
            var21 += this.edgeNormalsF16[var22][1];
          }
        }
      }
    }
    if (var17 === 1) {
      if (multiplyF16(var20, var1.velocityXF16) + multiplyF16(var21, var1.velocityYF16) >= 0) {
        return 2;
      }
      this.collisionNormalXF16 = var20;
      this.collisionNormalYF16 = var21;
    }
    return var17;
  }
}
export {
  LevelLoader
};
