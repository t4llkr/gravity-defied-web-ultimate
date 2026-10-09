import { GameCanvas } from "./GameCanvas.js";
import { GamePhysics } from "./GamePhysics.js";
import { LevelLoader } from "./LevelLoader.js";
import { MenuManager } from "./MenuManager.js";
import { Micro } from "./Micro.js";
import { VisualSettings } from "./VisualSettings.js";
import { SkinCatalog } from "./SkinCatalog.js";
import { SkinManager } from "./SkinManager.js";
import { openSkinGallery } from "./SkinGallery.js";
import { openPackGallery } from "./PackGallery.js";
import { migrateSchema } from "./SchemaMigrate.js";
const LEVELS_MRG_URL = new URL("./assets/levels.mrg", import.meta.url).href
import { TouchControls } from "./TouchControls.js";

async function startGravityDefiedApp(root) {
  await migrateSchema(); // до любой инициализации, читающей прогресс/паки
  VisualSettings.load();
  void VisualSettings.loadBgImageFromStorage();
  root.className = "app-root";
  const canvasElement = document.createElement("canvas");
  canvasElement.className = "game-canvas";
  root.replaceChildren(canvasElement);
  const micro = new Micro();
  Micro.isGameVisible = true;
  const levelLoader = await LevelLoader.create(LEVELS_MRG_URL);
  const gamePhysics = new GamePhysics(levelLoader);
  const gameCanvas = await GameCanvas.create(canvasElement, micro);
  const menuManager = new MenuManager(micro);
  micro.levelLoader = levelLoader;
  micro.gamePhysics = gamePhysics;
  micro.gameCanvas = gameCanvas;

  const touchControls = new TouchControls(root, {
    keyPressed: (keyCode) => {
      gameCanvas.keyPressed(keyCode);
      render();
    },
    keyReleased: (keyCode) => gameCanvas.keyReleased(keyCode),
    back: () => {
      handleBack();
      render();
    },
  });

  function isBackAvailable() {
    return Micro.isInGameMenu
      ? menuManager.getCurrentMenu()?.getParentMenu() != null
      : gameCanvas.hasMenuButton();
  }
  function handleBack() {
    if (Micro.isInGameMenu) {
      gameCanvas.handleBackAction();
    } else if (gameCanvas.hasMenuButton()) {
      gameCanvas.openPauseMenu();
    }
  }
  window.__gd = { micro, menuManager };
  window.addEventListener("pagehide", () => menuManager.saveAndClose());
  micro.menuManager = menuManager;
  gameCanvas.init(gamePhysics);
  for (let i = 1; i <= 7; ++i) {
    menuManager.initPart(i);
  }
  gameCanvas.setMenuManager(menuManager);
  const state = {
    loadedSpriteFlags: await gameCanvas.loadSprites(menuManager.getLoadedSpriteFlags()),
    lastOuterStepMs: performance.now(),
    outerAccumulatorMs: 0,
    lastMenuStepMs: performance.now(),
    isGoalLoopActive: false,
    goalLoopEndMs: 0,
    lastGoalLoopStepMs: 0,
    forcedRestartMs: 0,
    wasInGameMenu: false
  };
  gameCanvas.loadedSpriteFlags = state.loadedSpriteFlags;
  gamePhysics.applyLoadedSpriteFlags(state.loadedSpriteFlags);
  menuManager.applyLoadedSpriteFlags(state.loadedSpriteFlags);
  await menuManager.packMenu?.restoreLastPack();
  const skinCatalog = new SkinCatalog(menuManager.packMenu.packManager);
  const skinManager = new SkinManager(menuManager.packMenu.packManager, gameCanvas);
  menuManager.skinGalleryOpener = () => openSkinGallery(skinManager, skinCatalog);
  menuManager.packGalleryOpener = () => openPackGallery(menuManager, menuManager.packMenu);
  await skinManager.restoreOnBoot();
  window.__gd.skinManager = skinManager;
  gamePhysics.setMode(1);
  function resize() {
    const rect = root.getBoundingClientRect();
    let width = Math.floor(rect.width);
    let height = Math.floor(rect.height);
    if (width <= 0 || height <= 0) {
      width = window.innerWidth;
      height = window.innerHeight;
    }
    if (window.visualViewport !== null) {
      width = Math.max(width, Math.floor(window.visualViewport.width));
      height = Math.max(height, Math.floor(window.visualViewport.height));
    }
    gameCanvas.resize(width, height, menuManager.getZoom());
    gamePhysics.setMinimalScreenWH(Math.ceil((width < height ? width : height) / menuManager.getZoom()));
  }
  function render() {
    gameCanvas.paint(gameCanvas.getGraphics());
    touchControls.update(Micro.isInGameMenu, isBackAvailable());
  }
  gameCanvas.setRepaintHandler(render);
  function restart(var1) {
    gamePhysics.resetSmth(true);
    micro.timeMs = 0;
    micro.gameTimeMs = 0;
    micro.crashRestartDeadlineMs = 0;
    micro.isTimerRunning = false;
    state.goalLoopEndMs = 0;
    state.isGoalLoopActive = false;
    state.lastGoalLoopStepMs = 0;
    state.forcedRestartMs = 0;
    if (var1) {
      gameCanvas.scheduleGameTimerTask(micro.levelLoader.getName(menuManager.getCurrentLevel(), menuManager.getCurrentTrack()), 3e3);
    }
    gameCanvas.resetInputState();
  }
  function openFinishedMenu() {
    menuManager.setFinishTime(micro.gameTimeMs / 10);
    menuManager.showMenuScreen(2);
  }
  function startGoalLoop(nowMs) {
    state.goalLoopEndMs = nowMs + 1e3;
    state.isGoalLoopActive = true;
    state.lastGoalLoopStepMs = nowMs;
    gameCanvas.scheduleGameTimerTask(gamePhysics.isTrackFinished ? "Finished" : "Wheelie!", 1e3);
  }
  function updateSpriteMode() {
    const nextSpriteFlags = menuManager.getLoadedSpriteFlags();
    if (gamePhysics.getLoadedSpriteFlags() !== nextSpriteFlags) {
      void gameCanvas.loadSprites(nextSpriteFlags).then((var5) => {
        gamePhysics.applyLoadedSpriteFlags(var5);
        menuManager.applyLoadedSpriteFlags(var5);
        state.loadedSpriteFlags = var5;
      });
    }
  }
  function outerStep(nowMs) {
    updateSpriteMode();
    if (state.forcedRestartMs !== 0) {
      if (nowMs >= state.forcedRestartMs) {
        restart(true);
      }
      return;
    }
    for (let i = micro.numPhysicsLoops; i > 0; --i) {
      if (micro.isTimerRunning) {
        micro.gameTimeMs += 20;
      }
      if (micro.timeMs === 0) {
        micro.timeMs = Date.now();
      }
      const var5 = gamePhysics.updatePhysics();
      if (var5 === 3 && micro.crashRestartDeadlineMs === 0) {
        micro.crashRestartDeadlineMs = Date.now() + 3e3;
        gameCanvas.scheduleGameTimerTask("Crashed", 3e3);
        gameCanvas.repaint();
        gameCanvas.serviceRepaints();
      }
      if (micro.crashRestartDeadlineMs !== 0 && micro.crashRestartDeadlineMs < Date.now()) {
        restart(true);
        return;
      }
      if (var5 === 5) {
        gameCanvas.scheduleGameTimerTask("Crashed", 3e3);
        gameCanvas.repaint();
        gameCanvas.serviceRepaints();
        let waitMs = 1e3;
        if (micro.crashRestartDeadlineMs > 0) {
          waitMs = Math.min(micro.crashRestartDeadlineMs - Date.now(), 1e3);
        }
        if (waitMs < 0) {
          waitMs = 0;
        }
        state.forcedRestartMs = nowMs + waitMs;
        return;
      }
      if (var5 === 4) {
        micro.timeMs = 0;
        micro.gameTimeMs = 0;
      } else if (var5 === 1 || var5 === 2) {
        if (var5 === 2) {
          micro.gameTimeMs -= 10;
        }
        startGoalLoop(nowMs);
        micro.isTimerRunning = true;
        return;
      }
      micro.isTimerRunning = var5 !== 4;
    }
    gamePhysics.syncRenderStateFromSimulation();
  }
  function goalLoopStep(nowMs) {
    if (!state.isGoalLoopActive) {
      return;
    }
    if (nowMs >= state.goalLoopEndMs) {
      state.isGoalLoopActive = false;
      openFinishedMenu();
      return;
    }
    while (nowMs - state.lastGoalLoopStepMs >= 30) {
      for (let i = micro.numPhysicsLoops; i > 0; --i) {
        if (gamePhysics.updatePhysics() === 5) {
          state.isGoalLoopActive = false;
          state.goalLoopEndMs = nowMs;
          openFinishedMenu();
          return;
        }
      }
      gamePhysics.syncRenderStateFromSimulation();
      state.lastGoalLoopStepMs += 30;
    }
  }
  function menuStep(nowMs) {
    if (!Micro.isInGameMenu) {
      return;
    }
    while (nowMs - state.lastMenuStepMs >= 50) {
      if (gamePhysics.isGenerateInputAI) {
        const var9 = gamePhysics.updatePhysics();
        if (var9 !== 0 && var9 !== 4) {
          gamePhysics.resetSmth(true);
        }
        gamePhysics.syncRenderStateFromSimulation();
      }
      state.lastMenuStepMs += 50;
      if (!gamePhysics.isGenerateInputAI) {
        break;
      }
    }
  }
  resize();
  gameCanvas.requestRepaint(0);
  restart(false);
  menuManager.showMenuScreen(0);
  function loop(now) {
    if (menuManager.getZoom() !== gameCanvas.getZoom()) {
      resize();
    }
    if (Micro.isInGameMenu && !state.wasInGameMenu) {
      state.lastMenuStepMs = now;
    }
    if (Micro.isInGameMenu && !state.wasInGameMenu && menuManager.isOpeningPauseMenu) {
      menuManager.showMenuScreen(1);
    }
    if (Micro.isInGameMenu) {
      menuStep(now);
      render();
      state.wasInGameMenu = true;
      requestAnimationFrame(loop);
      return;
    }
    if (state.wasInGameMenu) {
      state.lastOuterStepMs = now;
      state.outerAccumulatorMs = 0;
    }
    state.wasInGameMenu = false;
    if (menuManager.consumeRestartRequested()) {
      restart(true);
    }
    if (state.isGoalLoopActive) {
      goalLoopStep(now);
      render();
      requestAnimationFrame(loop);
      return;
    }
    state.outerAccumulatorMs += now - state.lastOuterStepMs;
    state.lastOuterStepMs = now;
    while (state.outerAccumulatorMs >= 30) {
      outerStep(now);
      state.outerAccumulatorMs -= 30;
      if (Micro.isInGameMenu || state.isGoalLoopActive) {
        break;
      }
    }
    if (menuManager.consumeRestartRequested()) {
      restart(true);
    }
    render();
    requestAnimationFrame(loop);
  }
  const handleResize = () => {
    resize();
    render();
  };
  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(root);
  window.addEventListener("resize", handleResize);
  window.visualViewport?.addEventListener("resize", handleResize);
  window.addEventListener("keydown", (event) => {
    let handled = false;
    const keyCode = browserKeyCodeToGameKeyCode(event.code);
    if (event.code === "Escape") {
      if (Micro.isInGameMenu) {
        gameCanvas.handleBackAction();
        handled = true;
      } else if (gameCanvas.hasMenuButton()) {
        gameCanvas.openPauseMenu();
        handled = true;
      }
    }
    if (keyCode !== null) {
      gameCanvas.keyPressed(keyCode);
      handled = true;
    }
    if (handled) {
      event.preventDefault();
      render();
    }
  });
  window.addEventListener("keyup", (event) => {
    const keyCode = browserKeyCodeToGameKeyCode(event.code);
    if (keyCode !== null) {
      gameCanvas.keyReleased(keyCode);
      event.preventDefault();
    }
  });
  requestAnimationFrame(loop);
}
function browserKeyCodeToGameKeyCode(code) {
  switch (code) {
    case "ArrowUp":
      return 1;
    case "ArrowLeft":
      return 2;
    case "ArrowRight":
      return 5;
    case "ArrowDown":
      return 6;
    case "Space":
    case "Enter":
    case "NumpadEnter":
      return 8;
    case "Digit0":
      return 48;
    case "Digit1":
      return 49;
    case "Digit2":
      return 50;
    case "Digit3":
      return 51;
    case "Digit4":
      return 52;
    case "Digit5":
      return 53;
    case "Digit6":
      return 54;
    case "Digit7":
      return 55;
    case "Digit8":
      return 56;
    case "Digit9":
      return 57;
    default:
      return null;
  }
}
export {
  startGravityDefiedApp
};
