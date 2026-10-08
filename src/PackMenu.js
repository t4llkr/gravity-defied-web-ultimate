import { GameMenu } from "./GameMenu.js";
import { isCustomId } from "./CustomStore.js";
import { LevelLoader } from "./LevelLoader.js";
import { TextRender } from "./TextRender.js";
import { TimerOrMotoPartOrMenuElem } from "./TimerOrMotoPartOrMenuElem.js";
import { Graphics } from "./lcdui/Graphics.js";
class PackMenu {
  micro;
  menuManager;
  packManager;
  gameMenuPacks;
  gameMenuPackList;
  gameMenuCachedPacks;
  taskBrowsePacks;
  taskCachedPacks;
  taskBack;
  currentPage = 1;
  packList = [];
  statusMessage = "";
  constructor(micro, menuManager, packManager) {
    this.micro = micro;
    this.menuManager = menuManager;
    this.packManager = packManager;
    const mainMenu = menuManager.gameMenuMain;
    this.gameMenuPacks = new GameMenu("Level Packs", this.micro, mainMenu);
    this.gameMenuPackList = new GameMenu("Browse", this.micro, this.gameMenuPacks);
    this.gameMenuCachedPacks = new GameMenu("Cached", this.micro, this.gameMenuPacks);
    this.taskBrowsePacks = new TimerOrMotoPartOrMenuElem(
      "Browse Packs",
      this.gameMenuPackList,
      this.menuManager
    );
    this.taskCachedPacks = new TimerOrMotoPartOrMenuElem(
      "Cached Packs",
      this.gameMenuCachedPacks,
      this.menuManager
    );
    this.taskBack = new BackItem("Back", mainMenu, this.menuManager);
    this.gameMenuPacks.addMenuElement(this.taskBrowsePacks);
    this.gameMenuPacks.addMenuElement(this.taskCachedPacks);
    this.gameMenuPacks.addMenuElement(this.taskBack);
    this.originalLoader = this.micro.levelLoader;
    this.lastRawCount = -1;
  }
  async restoreLastPack() {
    let packId = 0;
    try {
      packId = parseInt(window.localStorage.getItem("gd-last-pack") || "0", 10) || 0;
    } catch {
    }
    if (packId === 0) {
      return;
    }
    try {
      const blobUrl = await this.packManager.getPackBlobUrl(packId);
      const loader = await LevelLoader.create(blobUrl);
      this.applyLoader(loader, packId);
    } catch {
      // пак есть в памяти, но бинарника нет (кэш очищен/повреждён) — откат на оригинал
      try {
        window.localStorage.setItem("gd-last-pack", "0");
      } catch {
      }
      this.menuManager.showAlert("Pack not found", "The saved pack is missing from the cache. Original levels loaded.", null);
    }
  }
  applyLoader(loader, packId) {
    this.micro.levelLoader = loader;
    if (this.micro.gamePhysics !== null) {
      this.micro.gamePhysics.levelLoader = loader;
    }
    this.menuManager.levelNames = loader.levelNames;
    this.menuManager.setCurrentPack(packId);
  }
  getMainMenu() {
    return this.gameMenuPacks;
  }
  getBrowseMenu() {
    return this.gameMenuPackList;
  }
  getCachedMenu() {
    return this.gameMenuCachedPacks;
  }
  async loadPackListPage() {
    this.statusMessage = "Loading...";
    this.rebuildPackListMenu();
    try {
      // Оконная схема: с сервера — по 200 паков за запрос, на UI-странице — по 20.
      // GDLVL-only строки считаются в окне, но скрываются фильтром hasMrg.
      this.packList = await this.packManager.getUiPage(this.currentPage, 20);
      try {
        const cachedIds = new Set((await this.packManager.getCachedPacks()).map((m) => m.id));
        this.packList = this.packList.filter((p) => !cachedIds.has(p.id));
      } catch {
        // кэш недоступен — показываем список как есть
      }
      this.statusMessage = `Page ${this.currentPage}: ${this.packList.length} packs`;
    } catch (err) {
      this.statusMessage = "Error loading packs";
      console.error(err);
    }
    this.rebuildPackListMenu();
  }
  async loadCachedPacksPage() {
    this.statusMessage = "Loading...";
    this.rebuildCachedPacksMenu();
    try {
      const cached = await this.packManager.getCachedPacks();
      this.statusMessage = `${cached.length} cached packs`;
      this.rebuildCachedPacksMenu([
        { id: 0, name: "Original levels", author: "built-in", levels: "", mrgSize: "", hasGdlvl: false },
        ...cached
      ]);
    } catch (err) {
      this.statusMessage = "Error loading cached";
      console.error(err);
      this.rebuildCachedPacksMenu();
    }
  }
  rebuildPackListMenu() {
    this.gameMenuPackList.clearVector();
    this.gameMenuPackList.addMenuElement(new TextRender(this.statusMessage, this.micro));
    for (const pack of this.packList) {
      const item = new PackMenuItem(pack.name, pack, this);
      this.gameMenuPackList.addMenuElement(item);
    }
    if (this.currentPage > 1) {
      const prevItem = new PrevPageItem(this);
      this.gameMenuPackList.addMenuElement(prevItem);
    }
    // Next скрываем, только когда окно подтвержденно короткое (конец каталога)
    // и текущая страница — последняя в этом окне
    const pm = this.packManager;
    const rawTotal = pm.windowStart + pm.windowItems.length;
    const lastUiPage = Math.max(1, Math.ceil(rawTotal / 20));
    if (!pm.shortConfirmed || this.currentPage < lastUiPage) {
      const nextItem = new NextPageItem(this);
      this.gameMenuPackList.addMenuElement(nextItem);
    }
    const back = new BackItem("Back", this.gameMenuPacks, this.menuManager);
    this.gameMenuPackList.addMenuElement(back);
  }
  computePackStats(packId) {
    let played = 0;
    const storagePrefix = "gravity_defied_record_store:";
    const packPrefix = "p" + packId + "_";
    for (let i = 0; i < window.localStorage.length; ++i) {
      const rawKey = window.localStorage.key(i);
      if (rawKey === null || !rawKey.startsWith(storagePrefix)) {
        continue;
      }
      const key = rawKey.substring(storagePrefix.length);
      if (packId === 0) {
        if (/^[0-9]{2}$/.test(key)) {
          ++played;
        }
      } else if (key.startsWith(packPrefix)) {
        ++played;
      }
    }
    let leagues = 0;
    try {
      const raw = window.localStorage.getItem("gd-progress-" + packId);
      if (raw !== null) {
        const data = JSON.parse(raw);
        if (typeof data.al === "number") {
          leagues = data.al;
        }
      }
    } catch {
    }
    return { played, leagues };
  }
  rebuildCachedPacksMenu(cachedPacks) {
    this.gameMenuCachedPacks.clearVector();
    this.gameMenuCachedPacks.addMenuElement(new TextRender(this.statusMessage, this.micro));
    const packs = cachedPacks ?? [];
    if (packs.length === 0) {
      this.gameMenuCachedPacks.addMenuElement(new TextRender("No cached packs", this.micro));
    } else {
      for (const meta of packs) {
        const stats = this.computePackStats(meta.id);
        const totals = meta.id === 0 && this.originalLoader !== null ? {
          tracksTotal: this.originalLoader.levelNames.reduce((acc, lvl) => acc + lvl.length, 0),
          leaguesTotal: this.originalLoader.levelNames.length
        } : meta;
        const tracksPart = typeof totals.tracksTotal === "number" ? ` ${stats.played}/${totals.tracksTotal} tr` : ` ${stats.played} tr`;
        const leaguesPart = typeof totals.leaguesTotal === "number" ? ` ${stats.leagues}/${totals.leaguesTotal} lg` : ` ${stats.leagues} lg`;
        const item = new CachedPackItem(`${meta.name} —${tracksPart}${leaguesPart}`, meta, this);
        this.gameMenuCachedPacks.addMenuElement(item);
      }
    }
    const backCached = new BackItem("Back", this.gameMenuPacks, this.menuManager);
    this.gameMenuCachedPacks.addMenuElement(backCached);
  }
  goToPrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      void this.loadPackListPage();
    }
  }
  goToNextPage() {
    this.currentPage++;
    void this.loadPackListPage().then(() => {
      // пустая страница (после фильтра) = конец каталога: откатываемся и фиксируем
      if (this.packList.length === 0 && this.currentPage > 1) {
        this.currentPage--;
        void this.loadPackListPage().then(() => {
          this.statusMessage = "No more packs";
        });
      }
    });
  }
  async onPackSelected(pack) {
    this.showPackDetail(pack);
  }
  showPackDetail(pack) {
    const detailMenu = new GameMenu(pack.name, this.micro, this.gameMenuPackList);
    detailMenu.addMenuElement(new TextRender(`Author: ${pack.author}`, this.micro));
    detailMenu.addMenuElement(new TextRender(`Levels: ${pack.levels}`, this.micro));
    detailMenu.addMenuElement(new TextRender(`Size: ${pack.mrgSize}`, this.micro));
    const downloadItem = new DownloadPackItem("Download & Load", pack, this);
    detailMenu.addMenuElement(downloadItem);
    const back = new BackItem("Back", this.gameMenuPackList, this.menuManager);
    detailMenu.addMenuElement(back);
    this.menuManager.openMenu(detailMenu, false);
  }
  async downloadAndLoadPack(pack) {
    try {
      await this.packManager.downloadPack(pack.id);
      // name/author из пункта каталога надёжнее детальной страницы — сохраняем в мету
      void this.packManager.cache.updatePackMeta(pack.id, {
        name: pack.name,
        author: pack.author
      });
      const blobUrl = await this.packManager.getPackBlobUrl(pack.id);
      if (!blobUrl) {
        this.menuManager.showAlert("Error", "Failed to load pack", null);
        return;
      }
      const newLoader = await LevelLoader.create(blobUrl);
      const tracksTotal = newLoader.levelNames.reduce((acc, lvl) => acc + lvl.length, 0);
      void this.packManager.cache.updatePackMeta(pack.id, {
        tracksTotal,
        leaguesTotal: newLoader.levelNames.length,
        levelsBreakdown: newLoader.levelNames.map((l) => l.length)
      });
      this.applyLoader(newLoader, pack.id);
      this.menuManager.showAlert("Pack Loaded", `${pack.name} ready!`, null);
      this.menuManager.openMenu(this.menuManager.gameMenuMain, false);
    } catch (err) {
      console.error("Failed to load pack:", err);
      this.menuManager.showAlert("Error", "Failed to download pack", null);
    }
  }
  async onCachedPackSelected(meta) {
    if (meta.id === 0) {
      if (this.originalLoader !== null && this.originalLoader !== void 0) {
        this.applyLoader(this.originalLoader, 0);
        this.menuManager.showAlert("Pack Loaded", "Original levels ready!", null);
        this.menuManager.openMenu(this.menuManager.gameMenuMain, false);
      }
      return;
    }
    if (isCustomId(meta.id)) {
      // custom-пак живёт в кэше, каталог ему не нужен (иначе "Pack not in catalog")
      try {
        const blobUrl = await this.packManager.getPackBlobUrl(meta.id);
        const newLoader = await LevelLoader.create(blobUrl);
        this.applyLoader(newLoader, meta.id);
        this.menuManager.showAlert("Pack Loaded", `${meta.name} ready!`, null);
        this.menuManager.openMenu(this.menuManager.gameMenuMain, false);
      } catch (err) {
        console.error("Failed to load custom pack:", err);
        this.menuManager.showAlert("Error", "Failed to load pack", null);
      }
      return;
    }
    await this.downloadAndLoadPack({
      id: meta.id,
      name: meta.name,
      author: meta.author,
      authorId: meta.authorId,
      levels: meta.levels,
      mrgSize: meta.mrgSize,
      hasGdlvl: meta.hasGdlvl
    });
  }
}
class BackItem {
  label;
  targetMenu;
  menuManager;
  constructor(label, targetMenu, menuManager) {
    this.label = label;
    this.targetMenu = targetMenu;
    this.menuManager = menuManager;
  }
  isNotTextRender() {
    return true;
  }
  menuElemMethod(action) {
    if (action === 1) {
      this.menuManager.openMenu(this.targetMenu, true);
    }
  }
  render(graphics, y, x) {
    graphics.setColor(0, 0, 0);
    graphics.drawString(this.label, x, y, Graphics.LEFT | Graphics.TOP);
  }
  consumeSelectionMenuRequested() {
    return false;
  }
  getCurrentOptionPos() {
    return 0;
  }
  getMaxOptionPos() {
    return 0;
  }
  getCurrentMenu() {
    return null;
  }
  setAvailableOptions() {
  }
  setCurrentOptionPos() {
  }
  setOptionsList() {
  }
  init() {
  }
  getOptionsList() {
    return [];
  }
  getMaxAvailableOptionPos() {
    return 0;
  }
  setParentGameMenu() {
  }
  setText() {
  }
}
class PackMenuItem {
  label;
  pack;
  packMenu;
  constructor(label, pack, packMenu) {
    this.label = label;
    this.pack = pack;
    this.packMenu = packMenu;
  }
  isNotTextRender() {
    return true;
  }
  menuElemMethod(action) {
    if (action === 1) {
      this.packMenu.onPackSelected(this.pack);
    }
  }
  render(graphics, y, x) {
    graphics.setColor(0, 0, 0);
    graphics.drawString(this.label, x, y, Graphics.LEFT | Graphics.TOP);
  }
  consumeSelectionMenuRequested() {
    return false;
  }
  getCurrentOptionPos() {
    return 0;
  }
  getMaxOptionPos() {
    return 0;
  }
  getCurrentMenu() {
    return null;
  }
  setAvailableOptions() {
  }
  setCurrentOptionPos() {
  }
  setOptionsList() {
  }
  init() {
  }
  getOptionsList() {
    return [];
  }
  getMaxAvailableOptionPos() {
    return 0;
  }
  setParentGameMenu() {
  }
  setText() {
  }
}
class PrevPageItem {
  packMenu;
  constructor(packMenu) {
    this.packMenu = packMenu;
  }
  isNotTextRender() {
    return true;
  }
  menuElemMethod(action) {
    if (action === 1) {
      this.packMenu.goToPrevPage();
    }
  }
  render(graphics, y, x) {
    graphics.setColor(0, 0, 0);
    graphics.drawString("< Prev Page", x, y, Graphics.LEFT | Graphics.TOP);
  }
  consumeSelectionMenuRequested() {
    return false;
  }
  getCurrentOptionPos() {
    return 0;
  }
  getMaxOptionPos() {
    return 0;
  }
  getCurrentMenu() {
    return null;
  }
  setAvailableOptions() {
  }
  setCurrentOptionPos() {
  }
  setOptionsList() {
  }
  init() {
  }
  getOptionsList() {
    return [];
  }
  getMaxAvailableOptionPos() {
    return 0;
  }
  setParentGameMenu() {
  }
  setText() {
  }
}
class NextPageItem {
  packMenu;
  constructor(packMenu) {
    this.packMenu = packMenu;
  }
  isNotTextRender() {
    return true;
  }
  menuElemMethod(action) {
    if (action === 1) {
      this.packMenu.goToNextPage();
    }
  }
  render(graphics, y, x) {
    graphics.setColor(0, 0, 0);
    graphics.drawString("Next Page >", x, y, Graphics.LEFT | Graphics.TOP);
  }
  consumeSelectionMenuRequested() {
    return false;
  }
  getCurrentOptionPos() {
    return 0;
  }
  getMaxOptionPos() {
    return 0;
  }
  getCurrentMenu() {
    return null;
  }
  setAvailableOptions() {
  }
  setCurrentOptionPos() {
  }
  setOptionsList() {
  }
  init() {
  }
  getOptionsList() {
    return [];
  }
  getMaxAvailableOptionPos() {
    return 0;
  }
  setParentGameMenu() {
  }
  setText() {
  }
}
class DownloadPackItem {
  label;
  pack;
  packMenu;
  constructor(label, pack, packMenu) {
    this.label = label;
    this.pack = pack;
    this.packMenu = packMenu;
  }
  isNotTextRender() {
    return true;
  }
  menuElemMethod(action) {
    if (action === 1) {
      void this.packMenu.downloadAndLoadPack(this.pack);
    }
  }
  render(graphics, y, x) {
    graphics.setColor(0, 0, 0);
    graphics.drawString(this.label, x, y, Graphics.LEFT | Graphics.TOP);
  }
  consumeSelectionMenuRequested() {
    return false;
  }
  getCurrentOptionPos() {
    return 0;
  }
  getMaxOptionPos() {
    return 0;
  }
  getCurrentMenu() {
    return null;
  }
  setAvailableOptions() {
  }
  setCurrentOptionPos() {
  }
  setOptionsList() {
  }
  init() {
  }
  getOptionsList() {
    return [];
  }
  getMaxAvailableOptionPos() {
    return 0;
  }
  setParentGameMenu() {
  }
  setText() {
  }
}
class CachedPackItem {
  label;
  meta;
  packMenu;
  constructor(label, meta, packMenu) {
    this.label = label;
    this.meta = meta;
    this.packMenu = packMenu;
  }
  isNotTextRender() {
    return true;
  }
  menuElemMethod(action) {
    if (action === 1) {
      void this.packMenu.onCachedPackSelected(this.meta);
    }
  }
  render(graphics, y, x) {
    graphics.setColor(0, 0, 0);
    graphics.drawString(this.label, x, y, Graphics.LEFT | Graphics.TOP);
  }
  consumeSelectionMenuRequested() {
    return false;
  }
  getCurrentOptionPos() {
    return 0;
  }
  getMaxOptionPos() {
    return 0;
  }
  getCurrentMenu() {
    return null;
  }
  setAvailableOptions() {
  }
  setCurrentOptionPos() {
  }
  setOptionsList() {
  }
  init() {
  }
  getOptionsList() {
    return [];
  }
  getMaxAvailableOptionPos() {
    return 0;
  }
  setParentGameMenu() {
  }
  setText() {
  }
}
export {
  CachedPackItem,
  DownloadPackItem,
  NextPageItem,
  PackMenu,
  PackMenuItem,
  PrevPageItem
};
