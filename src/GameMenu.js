import { TextRender } from "./TextRender.js";
import { Font } from "./lcdui/Font.js";
import { FontStorage } from "./lcdui/FontStorage.js";
import { Graphics } from "./lcdui/Graphics.js";
import { GameCanvas } from "./GameCanvas.js";
class GameMenu {
  parentMenu;
  title;
  selectedIndex;
  vector = [];
  micro;
  font;
  font2;
  font3;
  topPadding;
  rowSpacing = 0;
  contentX;
  firstVisibleIndex = 0;
  lastVisibleIndex = 0;
  visibleItemCount;
  canvasWidth;
  canvasHeight;
  cursorAnimationFrame;
  isNameEntryMenu;
  nameCursorPos = 0;
  strArr;
  xPos;
  constructor(var1, micro, var3, inputString) {
    this.title = var1;
    this.selectedIndex = -1;
    this.micro = micro;
    this.parentMenu = var3;
    this.canvasWidth = micro.gameCanvas?.getWidth() ?? 0;
    this.canvasHeight = micro.gameCanvas?.getHeight() ?? 0;
    this.font = FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_LARGE);
    this.font3 = FontStorage.getFont(Font.STYLE_PLAIN, Font.SIZE_SMALL);
    if (this.canvasWidth >= 128) {
      this.font2 = FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_MEDIUM);
    } else {
      this.font2 = this.font3;
    }
    TextRender.setDefaultFont(this.font3);
    TextRender.setMaxArea(this.canvasWidth, this.canvasHeight);
    this.topPadding = 1;
    this.xPos = this.canvasWidth <= 100 ? 6 : 9;
    if (this.canvasHeight <= 100) {
      this.title = "";
    }
    this.contentX = this.xPos + 7;
    this.rowSpacing = 2;
    this.cursorAnimationFrame = 0;
    if (this.title !== "") {
      this.visibleItemCount = Math.trunc((this.canvasHeight - (this.topPadding << 1) - 10 - this.font.getBaselinePosition()) / (this.font2.getBaselinePosition() + this.rowSpacing));
    } else {
      this.visibleItemCount = Math.trunc((this.canvasHeight - (this.topPadding << 1) - 10) / (this.font2.getBaselinePosition() + this.rowSpacing));
    }
    if (inputString !== void 0 && inputString !== null) {
      this.isNameEntryMenu = true;
      this.nameCursorPos = 0;
      this.xPos = 8;
      this.strArr = inputString;
    } else {
      this.isNameEntryMenu = false;
      this.strArr = null;
    }
    if (this.visibleItemCount > 20) {
      this.visibleItemCount = 20;
    }
  }
  setRowSpacing(var1) {
    this.rowSpacing = var1;
  }
  setTitle(var1) {
    this.title = var1;
  }
  selectFirstMenuItem() {
    if (this.isNameEntryMenu) {
      this.nameCursorPos = 0;
    } else if (this.vector.length !== 0) {
      this.selectedIndex = 0;
      for (let var1 = 0; var1 < this.vector.length && var1 < this.visibleItemCount; ++var1) {
        if (this.vector[var1].isNotTextRender()) {
          this.selectedIndex = var1;
          break;
        }
      }
      this.firstVisibleIndex = 0;
      this.lastVisibleIndex = this.vector.length - 1;
      if (this.lastVisibleIndex > this.visibleItemCount - 1) {
        this.lastVisibleIndex = this.visibleItemCount - 1;
      }
    }
  }
  selectLastMenuItem() {
    this.selectedIndex = this.vector.length - 1;
    for (let var1 = this.vector.length - 1; var1 > 0; --var1) {
      if (this.vector[var1].isNotTextRender()) {
        this.selectedIndex = var1;
        break;
      }
    }
    this.firstVisibleIndex = this.vector.length - this.visibleItemCount;
    if (this.firstVisibleIndex < 0) {
      this.firstVisibleIndex = 0;
    }
    this.lastVisibleIndex = this.vector.length - 1;
    if (this.lastVisibleIndex > this.selectedIndex + this.visibleItemCount) {
      this.lastVisibleIndex = this.selectedIndex + this.visibleItemCount;
    }
  }
  addMenuElement(var1) {
    let var2 = this.topPadding;
    this.visibleItemCount = 1;
    this.vector.push(var1);
    if (this.title !== "") {
      var2 = this.font.getBaselinePosition() + 2;
    }
    if (this.canvasHeight < 100) {
      ++var2;
    } else {
      var2 += 4;
    }
    for (let var3 = 0; var3 < this.vector.length - 1; ++var3) {
      if (this.vector[var3].isNotTextRender()) {
        var2 += this.font2.getBaselinePosition() + this.rowSpacing;
      } else {
        var2 += (TextRender.getBaselinePosition() < GameCanvas.spriteSizeY[5] ? GameCanvas.spriteSizeY[5] : TextRender.getBaselinePosition()) + this.rowSpacing;
      }
      if (var2 > this.canvasHeight - (this.topPadding << 1) - 10) {
        break;
      }
      ++this.visibleItemCount;
    }
    if (this.visibleItemCount > 20) {
      this.visibleItemCount = 20;
    }
    this.selectFirstMenuItem();
  }
  processGameActionDown() {
    if (this.isNameEntryMenu && this.strArr !== null) {
      if (this.strArr[this.nameCursorPos] === 32) {
        this.strArr[this.nameCursorPos] = 90;
        return;
      }
      --this.strArr[this.nameCursorPos];
      if (this.strArr[this.nameCursorPos] < 65) {
        this.strArr[this.nameCursorPos] = 32;
      }
      return;
    }
    if (this.vector.length === 0) {
      return;
    }
    if (!this.vector[this.selectedIndex].isNotTextRender()) {
      ++this.lastVisibleIndex;
      this.selectedIndex = this.lastVisibleIndex;
      ++this.firstVisibleIndex;
      return;
    }
    ++this.selectedIndex;
    if (this.selectedIndex > this.vector.length - 1) {
      this.selectFirstMenuItem();
      return;
    }
    let var3 = false;
    let var2 = this.selectedIndex;
    for (var2 = this.selectedIndex; var2 <= this.lastVisibleIndex + 1 && var2 < this.vector.length; ++var2) {
      if (this.vector[var2].isNotTextRender()) {
        var3 = true;
        break;
      }
    }
    if (var3) {
      this.selectedIndex = var2;
    } else if (this.lastVisibleIndex < this.vector.length - 1) {
      ++this.lastVisibleIndex;
      ++this.firstVisibleIndex;
    } else {
      --this.selectedIndex;
    }
    if (this.selectedIndex > this.lastVisibleIndex) {
      ++this.firstVisibleIndex;
      ++this.lastVisibleIndex;
      if (this.lastVisibleIndex > this.vector.length - 1) {
        this.lastVisibleIndex = this.vector.length - 1;
      }
      this.selectedIndex = this.lastVisibleIndex;
    }
  }
  processGameActionUp() {
    if (this.isNameEntryMenu && this.strArr !== null) {
      if (this.strArr[this.nameCursorPos] === 32) {
        this.strArr[this.nameCursorPos] = 65;
        return;
      }
      ++this.strArr[this.nameCursorPos];
      if (this.strArr[this.nameCursorPos] > 90) {
        this.strArr[this.nameCursorPos] = 32;
      }
      return;
    }
    if (this.vector.length === 0) {
      return;
    }
    --this.selectedIndex;
    if (this.selectedIndex < 0) {
      this.selectLastMenuItem();
      return;
    }
    let var3 = false;
    let var2 = this.selectedIndex;
    for (var2 = this.selectedIndex; var2 >= this.firstVisibleIndex; --var2) {
      if (this.vector[var2].isNotTextRender()) {
        var3 = true;
        break;
      }
    }
    if (!var3) {
      if (this.firstVisibleIndex > 0) {
        --this.firstVisibleIndex;
        if (this.vector.length > this.visibleItemCount - 1) {
          --this.lastVisibleIndex;
          return;
        }
      } else {
        this.selectLastMenuItem();
      }
      return;
    }
    this.selectedIndex = var2;
    if (this.selectedIndex < this.firstVisibleIndex) {
      --this.firstVisibleIndex;
      if (this.firstVisibleIndex < 0) {
        this.selectedIndex = 0;
        this.firstVisibleIndex = 0;
      }
      if (this.vector.length > this.visibleItemCount - 1) {
        --this.lastVisibleIndex;
      }
    }
  }
  processGameActionUpd(var1) {
    if (this.isNameEntryMenu) {
      switch (var1) {
        case 1:
          if (this.nameCursorPos === 2) {
            ;
            this.micro.menuManager?.openMenu(this.parentMenu, false);
            return;
          }
          ++this.nameCursorPos;
          return;
        case 2:
          ++this.nameCursorPos;
          if (this.nameCursorPos > 2) {
            this.nameCursorPos = 2;
          }
          return;
        case 3:
          --this.nameCursorPos;
          if (this.nameCursorPos < 0) {
            this.nameCursorPos = 0;
          }
          return;
        default:
          return;
      }
    }
    if (this.selectedIndex !== -1) {
      for (let var2 = this.selectedIndex; var2 < this.vector.length; ++var2) {
        const var3 = this.vector[var2];
        if (var3 !== null && var3.isNotTextRender()) {
          var3.menuElemMethod(var1);
          return;
        }
      }
    }
  }
  render(graphics) {
    if (this.isNameEntryMenu && this.strArr !== null) {
      graphics.setColor(0, 0, 20);
      graphics.setFont(this.font);
      const var7 = 1;
      graphics.drawString("Enter Name", this.xPos, var7, Graphics.LEFT | Graphics.TOP);
      const var22 = var7 + this.font.getHeight() + (this.rowSpacing << 2);
      graphics.setFont(this.font2);
      for (let i = 0; i < 3; ++i) {
        graphics.drawChar(String.fromCharCode(this.strArr[i]), this.xPos + i * this.font2.charWidth("W") + 1, var22, Graphics.HCENTER | Graphics.TOP);
        if (i === this.nameCursorPos) {
          graphics.drawChar("^", this.xPos + i * this.font2.charWidth("W") + 1, var22 + this.font2.getHeight(), Graphics.HCENTER | Graphics.TOP);
        }
      }
      return;
    }
    graphics.setColor(0, 0, 0);
    let var2 = this.topPadding;
    if (this.title !== "") {
      graphics.setFont(this.font);
      graphics.drawString(this.title, this.xPos, var2, Graphics.LEFT | Graphics.TOP);
      var2 += this.font.getBaselinePosition() + 2;
    }
    if (this.firstVisibleIndex > 0 && this.micro.gameCanvas !== null) {
      this.micro.gameCanvas.drawSprite(graphics, 2, this.xPos - 3, var2);
    }
    if (this.canvasHeight < 100) {
      ++var2;
    } else {
      var2 += 4;
    }
    graphics.setFont(this.font2);
    for (let i = this.firstVisibleIndex; i < this.lastVisibleIndex + 1; ++i) {
      const var4 = this.vector[i];
      graphics.setColor(0, 0, 0);
      var4.render(graphics, var2, this.contentX);
      if (i === this.selectedIndex && var4.isNotTextRender() && this.micro.gameCanvas !== null) {
        const var5 = this.xPos - Math.trunc(this.micro.gameCanvas.helmetSpriteWidth / 2);
        const var6 = var2 + Math.trunc(this.font2.getBaselinePosition() / 2) - Math.trunc(this.micro.gameCanvas.helmetSpriteHeight / 2);
        // source-rect вместо setClip+drawImage: без save/clip/restore на каждый кадр
        graphics.drawRegion(
          this.micro.gameCanvas.helmetImage,
          this.micro.gameCanvas.helmetSpriteWidth * (this.cursorAnimationFrame % 6),
          this.micro.gameCanvas.helmetSpriteHeight * Math.trunc(this.cursorAnimationFrame / 6),
          this.micro.gameCanvas.helmetSpriteWidth,
          this.micro.gameCanvas.helmetSpriteHeight,
          var5, var6,
          Graphics.LEFT | Graphics.TOP
        );
        ++this.cursorAnimationFrame;
        if (this.cursorAnimationFrame > 30) {
          this.cursorAnimationFrame = 0;
        }
      }
      if (var4.isNotTextRender()) {
        var2 += this.font2.getBaselinePosition() + this.rowSpacing;
      } else {
        var2 += (TextRender.getBaselinePosition() < GameCanvas.spriteSizeY[5] ? GameCanvas.spriteSizeY[5] : TextRender.getBaselinePosition()) + this.rowSpacing;
      }
    }
    if (this.vector.length > this.lastVisibleIndex && this.lastVisibleIndex !== this.vector.length - 1 && this.micro.gameCanvas !== null) {
      if (GameCanvas.spriteSizeY[3] + var2 > this.canvasHeight) {
        this.micro.gameCanvas.drawSprite(graphics, 3, this.xPos - 3, this.canvasHeight - GameCanvas.spriteSizeY[3]);
        return;
      }
      this.micro.gameCanvas.drawSprite(graphics, 3, this.xPos - 3, var2 - 2);
    }
  }
  setParentMenu(gameMenu) {
    this.parentMenu = gameMenu;
  }
  getParentMenu() {
    return this.parentMenu;
  }
  getSelectedIndex() {
    return this.selectedIndex;
  }
  clearVector() {
    this.vector.length = 0;
    this.firstVisibleIndex = 0;
    this.lastVisibleIndex = 0;
    this.selectedIndex = -1;
  }
  makeString() {
    return this.strArr === null ? "" : String.fromCharCode(...this.strArr);
  }
  getStrArr() {
    return this.strArr;
  }
  scrollToSelection(var1) {
    this.selectedIndex = var1;
    this.firstVisibleIndex = var1 - Math.trunc(this.visibleItemCount / 2);
    if (this.firstVisibleIndex < 0) {
      this.firstVisibleIndex = 0;
    }
    this.lastVisibleIndex = this.firstVisibleIndex + this.visibleItemCount - 1;
    if (this.lastVisibleIndex > this.vector.length - 1) {
      this.lastVisibleIndex = this.vector.length - 1;
      this.firstVisibleIndex = this.lastVisibleIndex - this.visibleItemCount + 1;
      if (this.firstVisibleIndex < 0) {
        this.firstVisibleIndex = 0;
      }
    }
  }
}
export {
  GameMenu
};
