import { VisualSettings, pickColor, pickFile, saveBgImage, clearBgImage } from "./VisualSettings.js";
import { openPresetsOverlay } from "./VisualPresets.js";
import { showInfoToast } from "./InfoToast.js";
import { GameCanvas } from "./GameCanvas.js";
import { GameMenu } from "./GameMenu.js";
import { LevelLoader } from "./LevelLoader.js";
import { RecordManager } from "./RecordManager.js";
import { SettingsStringRender } from "./SettingsStringRender.js";
import { TextRender } from "./TextRender.js";
import { TimerOrMotoPartOrMenuElem } from "./TimerOrMotoPartOrMenuElem.js";
import { Font } from "./lcdui/Font.js";
import { FontStorage } from "./lcdui/FontStorage.js";
import { Graphics } from "./lcdui/Graphics.js";
import { Image } from "./lcdui/Image.js";
import { RecordStore } from "./rms/RecordStore.js";
import { Time } from "./utils/Time.js";
const RASTER_URL = new URL("./assets/raster.png", import.meta.url).href
import { PackManager } from "./PackManager.js";
import { PackMenu } from "./PackMenu.js";
class MenuManager {
  persistedStateBuffer = new Int8Array(19);
  micro;
  recordManager = null;
  gameMenuMain = null;
  gameMenuPlay = null;
  gameMenuOptions = null;
  gameMenuAbout = null;
  gameMenuHelp = null;
  gameMenuConfirmClear = null;
  gameMenuConfirmReset = null;
  gameMenuFinished = null;
  gameMenuIngame = null;
  taskPlayMenu = null;
  taskOptions = null;
  taskHelp = null;
  settingStringLevel = null;
  gameMenuStringLevel = null;
  settingsStringTrack = null;
  trackSelectionMenu = null;
  settingsStringLeague = null;
  gameMenuLeague = null;
  gameMenuHighscore = null;
  gameTimerTaskHighscore = null;
  taskStart = null;
  perspectiveSetting = null;
  shadowsSetting = null;
  driverSpriteSetting = null;
  bikeSpriteSetting = null;
  inputSetting = null;
  lookAheadSetting = null;
  clearHighscoreSetting = null;
  fullResetItem = null;
  confirmYes = null;
  confirmNo = null;
  taskAbout = null;
  objectiveMenu = null;
  objectiveItem = null;
  keysMenu = null;
  keysItem = null;
  unlockingMenu = null;
  unlockingItem = null;
  gameMenuOptionsHighscoreDescription = null;
  taskHighscore = null;
  gameMenuOptions2 = null;
  optionsHelpItem = null;
  gameMenuEnterName = null;
  settingStringBack = null;
  settingStringPlayMenu = null;
  settingStringContinue = null;
  settingStringGoToMain = null;
  settingStringExitGame = null;
  restartTrackAction = null;
  nextTrackAction = null;
  finishOkAction = null;
  finishNameAction = null;
  lastFinishTime = -1;
  lastFinishSeconds = -1;
  lastFinishCentiseconds = -1;
  lastFinishTimeString = "";
  playerNameBytes = new Uint8Array([65, 65, 65]);
  unlockedTracksByLevel = new Int8Array(4);
  currentPackId = 0;
  defaultInputString = new Uint8Array([65, 65, 65]);
  availableLeagues = 0;
  maxAvailableLevel = 0;
  selectedTrackByLevel = [0, 0, 0];
  levelNames = [];
  leagueNames = new Array(3);
  leagueNamesAll4 = [];
  recordStore = null;
  recordStoreRecordId = -1;
  isRecordStoreOpened = false;
  rasterImage = null;
  textRenderCodeBrewLink = null;
  resumeLevelIndex = 0;
  resumeTrackIndex = 0;
  completedLastTrack = false;
  restartRequested = false;
  levelDifficultyNames = ["Easy", "Medium", "Pro"];
  finishMenuOpenedAt = 0;
  isDisablePerspective = 0;
  isDisabledShadows = 0;
  isDisabledDriverSprite = 0;
  isDisabledBikeSprite = 0;
  inputMode = 0;
  isDisableLookAhead = 0;
  selectedTrackIndex = 0;
  selectedLevelIndex = 0;
  selectedLeagueIndex = 0;
  uiOverlayMode = 0;
  reservedSetting15 = 0;
  toggleOptionNames = [];
  inputModeNames = [];
  spacerTextRender;
  packMenu = null;
  taskLevelPacks = null;
  currentGameMenu = null;
  highscoreLeagueIndex = 0;
  isOpeningPauseMenu = false;
  constructor(var1) {
    this.micro = var1;
    this.spacerTextRender = new TextRender("", var1);
  }
  initPart(var1) {
    let var4 = 0;
    switch (var1) {
      case 1:
        this.playerNameBytes = this.defaultInputString;
        this.toggleOptionNames = ["On", "Off"];
        this.inputModeNames = ["Keyset 1", "Keyset 2", "Keyset 3"];
        this.recordManager = new RecordManager();
        this.lastFinishTime = -1;
        this.lastFinishSeconds = -1;
        this.lastFinishCentiseconds = -1;
        this.lastFinishTimeString = "";
        this.isRecordStoreOpened = false;
        for (let var11 = 0; var11 < 19; ++var11) {
          this.persistedStateBuffer[var11] = -127;
        }
        try {
          this.recordStore = RecordStore.openRecordStore("GWTRStates", true);
          this.isRecordStoreOpened = true;
        } catch {
          this.isRecordStoreOpened = false;
        }
        return;
      case 2: {
        this.recordStoreRecordId = -1;
        if (this.recordStore === null) {
          return;
        }
        let records;
        try {
          records = this.recordStore.enumerateRecords(null, null, false);
        } catch {
          return;
        }
        if (records.numRecords() > 0) {
          try {
            const var32 = records.nextRecord();
            records.reset();
            this.recordStoreRecordId = records.nextRecordId();
            if (var32.length <= 19) {
              for (let i = 0; i < var32.length; ++i) {
                this.persistedStateBuffer[i] = var32[i];
              }
            }
          } catch {
            return;
          }
          records.destroy();
        }
        const var3 = this.readStoredNameBytes(16, -1);
        if (var3.length !== 0 && var3[0] !== -1) {
          for (var4 = 0; var4 < 3; ++var4) {
            this.playerNameBytes[var4] = var3[var4];
          }
        }
        if (this.playerNameBytes[0] === 82 && this.playerNameBytes[1] === 75 && this.playerNameBytes[2] === 69) {
          this.availableLeagues = 3;
          this.maxAvailableLevel = 2;
          if (this.micro.levelLoader !== null) {
            this.unlockedTracksByLevel[0] = this.micro.levelLoader.levelNames[0].length - 1;
            this.unlockedTracksByLevel[1] = this.micro.levelLoader.levelNames[1].length - 1;
            this.unlockedTracksByLevel[2] = this.micro.levelLoader.levelNames[2].length - 1;
          }
          return;
        }
        this.availableLeagues = 0;
        this.maxAvailableLevel = 1;
        this.unlockedTracksByLevel[0] = 0;
        this.unlockedTracksByLevel[1] = 0;
        this.unlockedTracksByLevel[2] = -1;
        return;
      }
      case 3:
        this.isDisablePerspective = this.readStoredValue(0, this.isDisablePerspective);
        this.isDisabledShadows = this.readStoredValue(1, this.isDisabledShadows);
        this.isDisabledDriverSprite = this.readStoredValue(2, this.isDisabledDriverSprite);
        this.isDisabledBikeSprite = this.readStoredValue(3, this.isDisabledBikeSprite);
        this.inputMode = this.readStoredValue(14, this.inputMode);
        this.isDisableLookAhead = this.readStoredValue(4, this.isDisableLookAhead);
        this.selectedTrackIndex = this.readStoredValue(11, this.selectedTrackIndex);
        this.selectedLevelIndex = this.readStoredValue(10, this.selectedLevelIndex);
        this.selectedLeagueIndex = this.readStoredValue(12, this.selectedLeagueIndex);
        this.reservedSetting15 = this.readStoredValue(15, this.reservedSetting15);
        this.resumeLevelIndex = this.selectedLevelIndex;
        this.resumeTrackIndex = this.selectedTrackIndex;
        if (this.playerNameBytes[0] !== 82 || this.playerNameBytes[1] !== 75 || this.playerNameBytes[2] !== 69) {
          this.availableLeagues = this.readStoredValue(5, this.availableLeagues);
          this.maxAvailableLevel = this.readStoredValue(6, this.maxAvailableLevel);
          for (var4 = 0; var4 < 3; ++var4) {
            this.unlockedTracksByLevel[var4] = this.readStoredValue(7 + var4, this.unlockedTracksByLevel[var4]);
          }
        }
        {
          const migrated = this.loadProgressData(0);
          if (migrated !== null) {
            this.availableLeagues = migrated.al;
            this.maxAvailableLevel = migrated.ml;
            this.unlockedTracksByLevel[0] = migrated.u[0];
            this.unlockedTracksByLevel[1] = migrated.u[1];
            this.unlockedTracksByLevel[2] = migrated.u[2];
          } else {
            this.saveProgressToStorage();
          }
        }
        try {
          this.selectedTrackByLevel[this.selectedLevelIndex] = this.selectedTrackIndex;
        } catch {
          this.selectedLevelIndex = 0;
          this.selectedTrackIndex = 0;
          this.selectedTrackByLevel[this.selectedLevelIndex] = this.selectedTrackIndex;
        }
        LevelLoader.isEnabledPerspective = this.isDisablePerspective === 0;
        LevelLoader.isEnabledShadows = this.isDisabledShadows === 0;
        if (this.micro.gamePhysics !== null) {
          this.micro.gamePhysics.setEnableLookAhead(this.isDisableLookAhead === 0);
        }
        if (this.micro.gameCanvas !== null) {
          this.micro.gameCanvas.setInputMode(this.inputMode);
          this.micro.gameCanvas.setUiOverlayEnabled(this.uiOverlayMode === 0);
        }
        this.leagueNamesAll4 = ["100cc", "175cc", "220cc", "325cc"];
        this.levelNames = this.micro.levelLoader?.levelNames ?? [];
        if (this.availableLeagues < 3) {
          this.leagueNames = ["100cc", "175cc", "220cc"];
        } else {
          this.leagueNames = this.leagueNamesAll4;
        }
        // список селекктора лиг должен повторять leagueNames: 325cc виден
        // только при анлоке (иначе после разблокировки в другом паке он
        // оставался в списке навсегда)
        if (this.settingsStringLeague) {
          this.settingsStringLeague.setOptionsList(this.leagueNames);
          this.settingsStringLeague.setAvailableOptions(this.availableLeagues);
        }
        this.highscoreLeagueIndex = this.selectedLeagueIndex;
        return;
      case 4: {
        this.gameMenuMain = new GameMenu("Main", this.micro, null);
        this.gameMenuPlay = new GameMenu("Play", this.micro, this.gameMenuMain);
        this.gameMenuOptions = new GameMenu("Options", this.micro, this.gameMenuMain);
        this.gameMenuAbout = new GameMenu("About", this.micro, this.gameMenuMain);
        this.gameMenuHelp = new GameMenu("Help", this.micro, this.gameMenuMain);
        this.gameMenuVisuals = new GameMenu("Visuals", this.micro, this.gameMenuMain);
        this.settingStringBack = new SettingsStringRender("Back", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.settingStringGoToMain = new SettingsStringRender("Go to Main", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.settingStringContinue = new SettingsStringRender("Continue", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.settingStringPlayMenu = new SettingsStringRender("Play Menu", 0, this, [], false, this.micro, this.gameMenuMain, true);
        const boldSmallFont = FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_SMALL);
        if ((this.gameMenuAbout?.xPos ?? 0) + boldSmallFont.stringWidth("http://www.codebrew.se/") >= this.getCanvasWidth()) {
          this.textRenderCodeBrewLink = new TextRender("www.codebrew.se", this.micro);
        } else {
          this.textRenderCodeBrewLink = new TextRender("http://www.codebrew.se/", this.micro);
        }
        this.textRenderCodeBrewLink.setFont(boldSmallFont);
        this.gameMenuHighscore = new GameMenu("Highscore", this.micro, this.gameMenuPlay);
        this.gameMenuFinished = new GameMenu("Finished!", this.micro, this.gameMenuPlay);
        return;
      }
      case 5:
        this.gameMenuIngame = new GameMenu("Ingame", this.micro, this.gameMenuPlay);
        this.gameMenuEnterName = new GameMenu("Enter Name", this.micro, this.gameMenuFinished, this.playerNameBytes);
        this.gameMenuConfirmClear = new GameMenu("Confirm Clear", this.micro, this.gameMenuOptions);
        this.gameMenuConfirmReset = new GameMenu("Confirm Reset", this.micro, this.gameMenuConfirmClear);
        this.taskPlayMenu = new TimerOrMotoPartOrMenuElem("Play Menu", this.gameMenuPlay, this);
        this.taskOptions = new TimerOrMotoPartOrMenuElem("Options", this.gameMenuOptions, this);
        this.taskHelp = new TimerOrMotoPartOrMenuElem("Help", this.gameMenuHelp, this);
        this.taskAbout = new TimerOrMotoPartOrMenuElem("About", this.gameMenuAbout, this);
        this.settingStringExitGame = new SettingsStringRender("Exit Game", 0, this, [], false, this.micro, this.gameMenuMain, true);
        const packManager = new PackManager();
        void packManager.init();
        this.packMenu = new PackMenu(this.micro, this, packManager);
        this.taskLevelPacks = new TimerOrMotoPartOrMenuElem("Level Packs", null, this);
        this.taskLineColor = new TimerOrMotoPartOrMenuElem("Line color", null, this);
        this.taskBgColor = new TimerOrMotoPartOrMenuElem("Background color", null, this);
        this.taskTextColor = new TimerOrMotoPartOrMenuElem("Text color", null, this);
        this.fillSetting = new SettingsStringRender("Track fill", VisualSettings.settings.fillEnabled ? 0 : 1, this, this.toggleOptionNames, true, this.micro, this.gameMenuVisuals, false);
        this.hideLinesSetting = new SettingsStringRender("Hide lines", VisualSettings.settings.hideLines ? 0 : 1, this, this.toggleOptionNames, true, this.micro, this.gameMenuVisuals, false);
        this.taskFillColor = new TimerOrMotoPartOrMenuElem("Fill color", null, this);
        this.fillModeSetting = new SettingsStringRender("Shading", VisualSettings.settings.fillMode === "gradient" ? 0 : 1, this, ["Smooth", "Steps"], true, this.micro, this.gameMenuVisuals, false);
        this.curtainSetting = new SettingsStringRender("Track curtain", VisualSettings.settings.curtainEnabled ? 0 : 1, this, this.toggleOptionNames, true, this.micro, this.gameMenuVisuals, false);
        this.taskBgImage = new TimerOrMotoPartOrMenuElem("BG image", null, this);
        this.taskRemoveBg = new TimerOrMotoPartOrMenuElem("Remove BG image", null, this);
        this.taskPresets = new TimerOrMotoPartOrMenuElem("Presets", null, this);
        this.bgModeSetting = new SettingsStringRender("BG mode", VisualSettings.settings.bgImageMode === "fill" ? 0 : VisualSettings.settings.bgImageMode === "fit" ? 1 : 2, this, ["Fill", "Fit", "Tile"], false, this.micro, this.gameMenuVisuals, false);
        this.showBgSetting = new SettingsStringRender("Show image", VisualSettings.settings.showBgImage ? 0 : 1, this, this.toggleOptionNames, true, this.micro, this.gameMenuVisuals, false);
        this.gameMenuVisuals?.addMenuElement(this.taskLineColor);
        this.gameMenuVisuals?.addMenuElement(this.taskBgColor);
        this.gameMenuVisuals?.addMenuElement(this.taskTextColor);
        this.gameMenuVisuals?.addMenuElement(this.fillSetting);
        this.gameMenuVisuals?.addMenuElement(this.taskFillColor);
        this.gameMenuVisuals?.addMenuElement(this.fillModeSetting);
        this.gameMenuVisuals?.addMenuElement(this.curtainSetting);
        this.gameMenuVisuals?.addMenuElement(this.taskBgImage);
        this.gameMenuVisuals?.addMenuElement(this.bgModeSetting);
        this.gameMenuVisuals?.addMenuElement(this.showBgSetting);
        this.gameMenuVisuals?.addMenuElement(this.settingStringBack);
        this.taskVisuals = new TimerOrMotoPartOrMenuElem("Visuals", this.gameMenuVisuals, this);
        this.taskSkins = new TimerOrMotoPartOrMenuElem("Skins", null, this);
        this.gameMenuMain?.addMenuElement(this.taskPlayMenu);
        this.gameMenuMain?.addMenuElement(this.taskOptions);
        this.gameMenuMain?.addMenuElement(this.taskHelp);
        this.gameMenuMain?.addMenuElement(this.taskVisuals);
        this.gameMenuMain?.addMenuElement(this.taskLevelPacks);
        this.gameMenuMain?.addMenuElement(this.taskSkins);
        this.gameMenuMain?.addMenuElement(this.taskAbout);
        this.gameMenuMain?.addMenuElement(this.settingStringExitGame);
        this.settingStringLevel = new SettingsStringRender("Level", this.selectedLevelIndex, this, this.levelDifficultyNames, false, this.micro, this.gameMenuPlay, false);
        this.settingsStringTrack = new SettingsStringRender("Track", this.selectedTrackByLevel[this.selectedLevelIndex], this, this.levelNames[this.selectedLevelIndex], false, this.micro, this.gameMenuPlay, false);
        this.settingsStringLeague = new SettingsStringRender("League", this.selectedLeagueIndex, this, this.leagueNames, false, this.micro, this.gameMenuPlay, false);
        try {
          this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.selectedLevelIndex]);
        } catch {
          this.settingsStringTrack.setAvailableOptions(0);
        }
        this.settingStringLevel.setAvailableOptions(this.maxAvailableLevel);
        this.settingsStringLeague.setAvailableOptions(this.availableLeagues);
        this.gameTimerTaskHighscore = new TimerOrMotoPartOrMenuElem("Highscore", this.gameMenuHighscore, this);
        this.gameMenuHighscore?.addMenuElement(this.settingStringBack);
        this.taskStart = new SettingsStringRender("Start>", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.gameMenuPlay?.addMenuElement(this.taskStart);
        this.gameMenuPlay?.addMenuElement(this.settingStringLevel);
        this.gameMenuPlay?.addMenuElement(this.settingsStringTrack);
        this.gameMenuPlay?.addMenuElement(this.settingsStringLeague);
        this.gameMenuPlay?.addMenuElement(this.gameTimerTaskHighscore);
        this.gameMenuPlay?.addMenuElement(this.settingStringGoToMain);
        this.perspectiveSetting = new SettingsStringRender("Perspective", this.isDisablePerspective, this, this.toggleOptionNames, true, this.micro, this.gameMenuOptions, false);
        this.shadowsSetting = new SettingsStringRender("Shadows", this.isDisabledShadows, this, this.toggleOptionNames, true, this.micro, this.gameMenuOptions, false);
        this.driverSpriteSetting = new SettingsStringRender("Driver sprite", this.isDisabledDriverSprite, this, this.toggleOptionNames, true, this.micro, this.gameMenuOptions, false);
        this.bikeSpriteSetting = new SettingsStringRender("Bike sprite", this.isDisabledBikeSprite, this, this.toggleOptionNames, true, this.micro, this.gameMenuOptions, false);
        this.inputSetting = new SettingsStringRender("Input", this.inputMode, this, this.inputModeNames, false, this.micro, this.gameMenuOptions, false);
        this.lookAheadSetting = new SettingsStringRender("Look ahead", this.isDisableLookAhead, this, this.toggleOptionNames, true, this.micro, this.gameMenuOptions, false);
        this.clearHighscoreSetting = new TimerOrMotoPartOrMenuElem("Clear highscore", this.gameMenuConfirmClear, this);
        return;
      case 6:
        this.gameMenuOptions?.addMenuElement(this.perspectiveSetting);
        this.gameMenuOptions?.addMenuElement(this.shadowsSetting);
        this.gameMenuOptions?.addMenuElement(this.driverSpriteSetting);
        this.gameMenuOptions?.addMenuElement(this.bikeSpriteSetting);
        this.gameMenuOptions?.addMenuElement(this.inputSetting);
        this.gameMenuOptions?.addMenuElement(this.lookAheadSetting);
        this.gameMenuOptions?.addMenuElement(this.clearHighscoreSetting);
        this.gameMenuOptions?.addMenuElement(this.settingStringBack);
        this.confirmNo = new SettingsStringRender("No", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.confirmYes = new SettingsStringRender("Yes", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.fullResetItem = new TimerOrMotoPartOrMenuElem("Full Reset", this.gameMenuConfirmReset, this);
        this.addTextRender(this.gameMenuConfirmClear, "Clearing the highscores can not be undone. It will remove all the registered times on all tracks.");
        this.addTextRender(this.gameMenuConfirmClear, "Would you like to clear the highscores?");
        this.gameMenuConfirmClear?.addMenuElement(this.confirmNo);
        this.gameMenuConfirmClear?.addMenuElement(this.confirmYes);
        this.gameMenuConfirmClear?.addMenuElement(this.fullResetItem);
        this.addTextRender(this.gameMenuConfirmReset, "A full reset can not be undone. It will relock all tracks and leagues and clear back all settings to default. A full reset will exit the application.");
        this.addTextRender(this.gameMenuConfirmReset, "Would you like to do a full reset?");
        this.gameMenuConfirmReset?.addMenuElement(this.confirmNo);
        this.gameMenuConfirmReset?.addMenuElement(this.confirmYes);
        this.objectiveMenu = new GameMenu("Objective", this.micro, this.gameMenuHelp);
        this.objectiveItem = new TimerOrMotoPartOrMenuElem("Objective", this.objectiveMenu, this);
        this.addTextRender(this.objectiveMenu, "Race to the finish line as fast as you can without crashing. By leaning forward and backward you can adjust the rotation of your bike. By landing on both wheels after jumping, your bike won't crash as easily. Beware, the levels tend to get harder and harder...");
        this.objectiveMenu.addMenuElement(this.settingStringBack);
        this.gameMenuHelp?.addMenuElement(this.objectiveItem);
        this.keysMenu = new GameMenu("Keys", this.micro, this.gameMenuHelp);
        this.keysItem = new TimerOrMotoPartOrMenuElem("Keys", this.keysMenu, this);
        this.addTextRender(this.keysMenu, `- ${this.inputModeNames[0]} -`);
        this.addTextRender(this.keysMenu, "UP accelerates, DOWN brakes, RIGHT leans forward and LEFT leans backward. 1 accelerates and leans backward. 3 accelerates and leans forward. 7 brakes and leans backward. 9 brakes and leans forward.");
        this.keysMenu.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.keysMenu, `- ${this.inputModeNames[1]} -`);
        this.addTextRender(this.keysMenu, "1 accelerates, 4 brakes, 6 leans forward and 5 leans backward.");
        this.keysMenu.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.keysMenu, `- ${this.inputModeNames[2]} -`);
        this.addTextRender(this.keysMenu, "3 accelerates, 6 brakes, 5 leans forward and 4 leans backward.");
        this.keysMenu.addMenuElement(this.settingStringBack);
        this.gameMenuHelp?.addMenuElement(this.keysItem);
        this.unlockingMenu = new GameMenu("Unlocking", this.micro, this.gameMenuHelp);
        this.unlockingItem = new TimerOrMotoPartOrMenuElem("Unlocking", this.unlockingMenu, this);
        this.addTextRender(this.unlockingMenu, "By completing the easier levels, new levels will be unlocked. You will also gain access to higher leagues where more advanced bikes with different characteristics are available.");
        this.unlockingMenu.addMenuElement(this.settingStringBack);
        this.gameMenuHelp?.addMenuElement(this.unlockingItem);
        this.gameMenuOptionsHighscoreDescription = new GameMenu("Highscore", this.micro, this.gameMenuHelp);
        this.taskHighscore = new TimerOrMotoPartOrMenuElem("Highscore", this.gameMenuOptionsHighscoreDescription, this);
        this.addTextRender(this.gameMenuOptionsHighscoreDescription, "The three best times on every track are saved for each league. When beating a time on a track you will be asked to enter your name. The highscores can be viewed from the Play Menu. By pressing left and right in the highscore view you can view the highscore for a specific league. The highscore can be cleared from the options menu.");
        this.gameMenuOptionsHighscoreDescription.addMenuElement(this.settingStringBack);
        this.gameMenuHelp?.addMenuElement(this.taskHighscore);
        return;
      case 7:
        this.gameMenuOptions2 = new GameMenu("Options", this.micro, this.gameMenuHelp);
        this.optionsHelpItem = new TimerOrMotoPartOrMenuElem("Options", this.gameMenuOptions2, this);
        this.addTextRender(this.gameMenuOptions2, "Perspective: On/Off");
        this.addTextRender(this.gameMenuOptions2, "Default: <On>. Turns on and off the perspective view of the tracks.");
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.gameMenuOptions2, "Shadows: On/Off");
        this.addTextRender(this.gameMenuOptions2, "Default: <On>. Turns on and off the shadows.");
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.gameMenuOptions2, "Driver Sprite: On / Off");
        this.addTextRender(this.gameMenuOptions2, "Default: <On>. <On> uses a texture for the driver. <Off> uses line graphics.");
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.gameMenuOptions2, "Bike Sprite: On / Off");
        this.addTextRender(this.gameMenuOptions2, "Default: <On>. <On> uses a texture for the bike. <Off> uses line graphics.");
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.gameMenuOptions2, "Input: Keyset 1,2,3 ");
        this.addTextRender(this.gameMenuOptions2, 'Default: <1>. Determines which type of input should be used when playing. See "Keys" in the help menu for more info.');
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.gameMenuOptions2, "Look ahead: On/Off");
        this.addTextRender(this.gameMenuOptions2, "Default: <On>. Turns on and off smart camera movement.");
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.addTextRender(this.gameMenuOptions2, "Clear highscore");
        this.addTextRender(this.gameMenuOptions2, 'Lets you clear the highscores. Here you can also do a "Full Reset" which will reset the game to original state (clear settings, highscores, unlocked levels and leagues).');
        this.gameMenuOptions2.addMenuElement(this.spacerTextRender);
        this.gameMenuOptions2.addMenuElement(this.settingStringBack);
        this.gameMenuHelp?.addMenuElement(this.optionsHelpItem);
        this.gameMenuHelp?.addMenuElement(this.settingStringBack);
        this.addTextRender(this.gameMenuAbout, '"Gravity Defied"');
        this.addTextRender(this.gameMenuAbout, "brought 2 you by pascha.                For information visit:");
        if (this.textRenderCodeBrewLink !== null) {
          this.gameMenuAbout?.addMenuElement(this.textRenderCodeBrewLink);
        }
        this.gameMenuAbout?.addMenuElement(this.settingStringBack);
        if (this.micro.levelLoader !== null) {
          this.nextTrackAction = new SettingsStringRender(`Track: ${this.micro.levelLoader.getName(0, 1)}`, 0, this, [], false, this.micro, this.gameMenuMain, true);
          this.restartTrackAction = new SettingsStringRender(`Restart: ${this.micro.levelLoader.getName(0, 0)}`, 0, this, [], false, this.micro, this.gameMenuMain, true);
        } else {
          this.nextTrackAction = new SettingsStringRender("Track", 0, this, [], false, this.micro, this.gameMenuMain, true);
          this.restartTrackAction = new SettingsStringRender("Restart", 0, this, [], false, this.micro, this.gameMenuMain, true);
        }
        this.gameMenuIngame?.addMenuElement(this.settingStringContinue);
        this.gameMenuIngame?.addMenuElement(this.restartTrackAction);
        this.gameMenuIngame?.addMenuElement(this.taskOptions);
        this.gameMenuIngame?.addMenuElement(this.taskVisuals);
        this.gameMenuIngame?.addMenuElement(this.taskSkins);
        this.gameMenuIngame?.addMenuElement(this.taskHelp);
        this.gameMenuIngame?.addMenuElement(this.settingStringPlayMenu);
        this.finishOkAction = new SettingsStringRender("Ok", 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.finishNameAction = new SettingsStringRender(`Name - ${this.makeString(this.playerNameBytes)}`, 0, this, [], false, this.micro, this.gameMenuMain, true);
        this.openMenu(this.gameMenuMain, false);
        this.rasterImage = Image.fromSrc(RASTER_URL);
        return;
      default:
        return;
    }
  }
  addTextRender(gameMenu, text) {
    const var3 = TextRender.makeMultilineTextRenders(text, this.micro);
    for (let var4 = 0; var4 < var3.length; ++var4) {
      gameMenu.addMenuElement(var3[var4]);
    }
  }
  getCurrentLevel() {
    return this.settingStringLevel?.getCurrentOptionPos() ?? 0;
  }
  getCurrentTrack() {
    return this.settingsStringTrack?.getCurrentOptionPos() ?? 0;
  }
  consumeRestartRequested() {
    if (this.restartRequested) {
      this.restartRequested = false;
      return true;
    }
    return false;
  }
  finalizeFinishedMenu() {
    if (this.recordManager === null || this.gameMenuFinished === null || this.settingsStringLeague === null || this.settingsStringTrack === null || this.settingStringLevel === null || this.restartTrackAction === null || this.settingStringPlayMenu === null || this.micro.levelLoader === null) {
      return;
    }
    this.recordManager.addRecordIfNeeded(this.settingsStringLeague.getCurrentOptionPos(), this.playerNameBytes, this.lastFinishTime);
    this.recordManager.writeRecordInfo();
    this.completedLastTrack = false;
    this.gameMenuFinished.clearVector();
    this.gameMenuFinished.addMenuElement(new TextRender(`Time: ${this.lastFinishTimeString}`, this.micro));
    const var1 = this.recordManager.getRecordDescription(this.settingsStringLeague.getCurrentOptionPos());
    for (let var2 = 0; var2 < var1.length; ++var2) {
      if (var1[var2] !== "") {
        this.gameMenuFinished.addMenuElement(new TextRender(`${var2 + 1}.${var1[var2]}`, this.micro));
      }
    }
    this.recordManager.closeRecordStore();
    let availableLeagues = -1;
    // монотонная разблокировка: прохождение более лёгкой лиги после сложной
    // не должно закрывать уже открытые классы (сравнение с реальным максимумом,
    // а не с локальной переменной, которая всегда -1)
    const currentMaxLeague = this.settingsStringLeague.getMaxAvailableOptionPos();
    if (this.settingsStringTrack.getMaxAvailableOptionPos() >= this.settingsStringTrack.getCurrentOptionPos()) {
      this.settingsStringTrack.setAvailableOptions(
        this.settingsStringTrack.getCurrentOptionPos() + 1 < this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()] ? this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()] : this.settingsStringTrack.getCurrentOptionPos() + 1
      );
      this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()] = this.settingsStringTrack.getMaxAvailableOptionPos() < this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()] ? this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()] : this.settingsStringTrack.getMaxAvailableOptionPos();
    }
    if (this.settingsStringTrack.getCurrentOptionPos() === this.settingsStringTrack.getMaxOptionPos()) {
      this.completedLastTrack = true;
      switch (this.settingStringLevel.getCurrentOptionPos()) {
        case 0:
          if (currentMaxLeague < 1) {
            availableLeagues = 1;
            this.settingsStringLeague.setAvailableOptions(availableLeagues);
          }
          break;
        case 1:
          if (currentMaxLeague < 2) {
            availableLeagues = 2;
            this.settingsStringLeague.setAvailableOptions(availableLeagues);
          }
          break;
        case 2:
          if (currentMaxLeague < 3) {
            availableLeagues = 3;
            this.settingsStringLeague.setOptionsList(this.leagueNamesAll4);
            this.leagueNames = this.leagueNamesAll4;
            this.settingsStringLeague.setAvailableOptions(availableLeagues);
          } else if (this.leagueNames !== this.leagueNamesAll4) {
            // классы уже открыты, но список ещё короткий (переход со старого сейва)
            this.settingsStringLeague.setOptionsList(this.leagueNamesAll4);
            this.leagueNames = this.leagueNamesAll4;
          }
      }
      this.settingStringLevel.setAvailableOptions(this.settingStringLevel.getMaxAvailableOptionPos() + 1);
      if (this.unlockedTracksByLevel[this.settingStringLevel.getMaxAvailableOptionPos()] === -1) {
        this.unlockedTracksByLevel[this.settingStringLevel.getMaxAvailableOptionPos()] = 0;
      }
    }
    const var3 = this.getCountOfRecordStoresWithPrefix(this.settingStringLevel.getCurrentOptionPos());
    this.addTextRender(
      this.gameMenuFinished,
      `${var3} of ${this.levelNames[this.settingStringLevel.getCurrentOptionPos()].length} tracks in ${this.levelDifficultyNames[this.settingStringLevel.getCurrentOptionPos()]} completed.`
    );
    if (!this.completedLastTrack) {
      this.restartTrackAction.setText(`Restart: ${this.micro.levelLoader.getName(this.settingStringLevel.getCurrentOptionPos(), this.settingsStringTrack.getCurrentOptionPos())}`);
      this.nextTrackAction?.setText(`Next: ${this.micro.levelLoader.getName(this.resumeLevelIndex, this.resumeTrackIndex + 1)}`);
    } else {
      if (this.settingStringLevel.getCurrentOptionPos() < this.settingStringLevel.getMaxOptionPos()) {
        this.settingStringLevel.setCurrentOptionPos(this.settingStringLevel.getCurrentOptionPos() + 1);
        this.settingsStringTrack.setCurrentOptionPos(0);
        this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()]);
      }
      this.availableLeagues = this.settingsStringLeague.getMaxAvailableOptionPos();
      this.maxAvailableLevel = this.settingStringLevel.getMaxAvailableOptionPos();
      this.saveProgressToStorage();
      if (availableLeagues !== -1) {
        this.addTextRender(this.gameMenuFinished, `Congratultions! You have successfully unlocked a new league: ${this.leagueNames[availableLeagues]}`);
        if (availableLeagues === 3) {
          this.gameMenuFinished.addMenuElement(new TextRender("Enjoy...", this.micro));
        }
        this.showAlert("League unlocked", `You have successfully unlocked a new league: ${this.leagueNames[availableLeagues]}`, null);
      } else {
        let var4 = true;
        if (this.micro.levelLoader !== null) {
          for (let var5 = 0; var5 < 3; ++var5) {
            if (this.unlockedTracksByLevel[var5] !== this.micro.levelLoader.levelNames[var5].length - 1) {
              var4 = false;
            }
          }
        }
        if (!var4) {
          this.addTextRender(this.gameMenuFinished, "You have completed all tracks at this level.");
        }
      }
    }
    if (!this.completedLastTrack && this.nextTrackAction !== null) {
      this.gameMenuFinished.addMenuElement(this.nextTrackAction);
    }
    this.restartTrackAction.setText(`Restart: ${this.micro.levelLoader.getName(this.resumeLevelIndex, this.resumeTrackIndex)}`);
    this.gameMenuFinished.addMenuElement(this.restartTrackAction);
    this.gameMenuFinished.addMenuElement(this.settingStringPlayMenu);
    this.openMenu(this.gameMenuFinished, false);
  }
  repaint() {
    this.micro.gameCanvas?.repaint();
  }
  getCanvasHeight() {
    return this.micro.gameCanvas?.getHeight() ?? 0;
  }
  getCanvasWidth() {
    return this.micro.gameCanvas?.getWidth() ?? 0;
  }
  showMenuScreen(var1) {
    void this.finishMenuOpenedAt;
    this.isOpeningPauseMenu = false;
    switch (var1) {
      case 0:
        this.openMenu(this.gameMenuMain, false);
        this.micro.gamePhysics?.enableGenerateInputAI();
        break;
      case 1:
        if (this.settingStringLevel !== null && this.settingsStringTrack !== null && this.restartTrackAction !== null && this.micro.levelLoader !== null) {
          this.resumeLevelIndex = this.settingStringLevel.getCurrentOptionPos();
          this.resumeTrackIndex = this.settingsStringTrack.getCurrentOptionPos();
          this.restartTrackAction.setText(`Restart: ${this.micro.levelLoader.getName(this.resumeLevelIndex, this.resumeTrackIndex)}`);
        }
        this.restartRequested = false;
        this.openMenu(this.gameMenuIngame, false);
        break;
      case 2: {
        this.finishMenuOpenedAt = Time.currentTimeMillis();
        this.gameMenuFinished?.clearVector();
        if (this.settingStringLevel === null || this.settingsStringTrack === null || this.recordManager === null || this.settingsStringLeague === null || this.gameMenuFinished === null || this.finishOkAction === null || this.finishNameAction === null) {
          break;
        }
        this.resumeLevelIndex = this.settingStringLevel.getCurrentOptionPos();
        this.resumeTrackIndex = this.settingsStringTrack.getCurrentOptionPos();
        this.recordManager.openRecordStoreForTrack(this.settingStringLevel.getCurrentOptionPos(), this.settingsStringTrack.getCurrentOptionPos());
        const var2 = this.recordManager.getPosOfNewRecord(this.settingsStringLeague.getCurrentOptionPos(), this.lastFinishTime);
        this.lastFinishTimeString = this.timeToString(this.lastFinishTime);
        if (var2 >= 0 && var2 <= 2) {
          const var3 = new TextRender("", this.micro);
          var3.setDx(GameCanvas.spriteSizeX[5] + 1);
          switch (var2) {
            case 0:
              var3.setText("First place!");
              var3.setDrawSprite(true, 5);
              break;
            case 1:
              var3.setText("Second place!");
              var3.setDrawSprite(true, 6);
              break;
            case 2:
              var3.setText("Third place!");
              var3.setDrawSprite(true, 7);
          }
          this.gameMenuFinished.addMenuElement(var3);
          const var4 = new TextRender(`${this.lastFinishTimeString}`, this.micro);
          var4.setDx(GameCanvas.spriteSizeX[5] + 1);
          this.gameMenuFinished.addMenuElement(var4);
          this.gameMenuFinished.addMenuElement(this.finishOkAction);
          this.gameMenuFinished.addMenuElement(this.finishNameAction);
          this.openMenu(this.gameMenuFinished, false);
          this.isOpeningPauseMenu = false;
        } else {
          this.finalizeFinishedMenu();
        }
        break;
      }
      default:
        this.openMenu(this.gameMenuMain, false);
    }
    this.micro.gameCanvas.isDrawingTime = false;
    this.micro.gamePhysics?.syncRenderStateFromSimulation();
    this.micro.gameToMenu();
  }
  renderCurrentMenu(var1) {
    if (this.currentGameMenu !== null && !this.isOpeningPauseMenu) {
      this.micro.gameCanvas?.drawGame(var1);
      this.fillCanvasWithImage(var1);
      this.currentGameMenu.render(var1);
    }
  }
  fillCanvasWithImage(graphics) {
    if (this.rasterImage === null) {
      return;
    }
    const rasterHeight = this.rasterImage.getHeight();
    const rasterWidth = this.rasterImage.getWidth();
    if (rasterHeight <= 0 || rasterWidth <= 0) {
      return;
    }
    for (let y = 0; y < this.getCanvasHeight(); y += rasterHeight) {
      for (let x = 0; x < this.getCanvasWidth(); x += rasterWidth) {
        graphics.drawImage(this.rasterImage, x, y, Graphics.LEFT | Graphics.TOP);
      }
    }
  }
  processKeyCode(keyCode) {
    if (this.currentGameMenu !== null && this.micro.gameCanvas !== null) {
      switch (this.micro.gameCanvas.getGameAction(keyCode)) {
        case 1:
          this.currentGameMenu.processGameActionUp();
          return;
        case 2:
          this.currentGameMenu.processGameActionUpd(3);
          if (this.currentGameMenu === this.gameMenuHighscore && this.settingsStringLeague !== null) {
            --this.highscoreLeagueIndex;
            if (this.highscoreLeagueIndex < 0) {
              this.highscoreLeagueIndex = 0;
            }
            this.rebuildHighscoreMenu(this.highscoreLeagueIndex);
          }
          return;
        case 5:
          this.currentGameMenu.processGameActionUpd(2);
          if (this.currentGameMenu === this.gameMenuHighscore && this.settingsStringLeague !== null) {
            ++this.highscoreLeagueIndex;
            if (this.highscoreLeagueIndex > this.settingsStringLeague.getMaxAvailableOptionPos()) {
              this.highscoreLeagueIndex = this.settingsStringLeague.getMaxAvailableOptionPos();
            }
            this.rebuildHighscoreMenu(this.highscoreLeagueIndex);
          }
          return;
        case 6:
          this.currentGameMenu.processGameActionDown();
          return;
        case 8:
          this.currentGameMenu.processGameActionUpd(1);
          return;
        default:
          return;
      }
    }
  }
  handleBackAction() {
    if (this.currentGameMenu === null) {
      return;
    }
    if (this.currentGameMenu === this.gameMenuIngame) {
      this.micro.menuToGame();
      return;
    }
    this.openMenu(this.currentGameMenu.getParentMenu(), true);
  }
  getCurrentMenu() {
    return this.currentGameMenu;
  }
  // Динамический состав Visuals: опциональные пункты показываются только когда
  // актуальны (заливка — при включённом Track fill; BG mode/Show image — при
  // загруженном фоновом изображении). Инстансы элементов не пересоздаём —
  // пересобираем только вектор; вызывается при каждом открытии меню.
  rebuildVisualsMenu() {
    if (this.gameMenuVisuals === null || this.gameMenuVisuals === undefined) {
      return;
    }
    const menu = this.gameMenuVisuals;
    // запоминаем ПОЗИЦИЮ курсора по элементу (не по индексу) — после пересборки
    // ищем тот же инстанс; если элемент исчез, зажимаем индекс в диапазон
    const prevIdx = menu.getSelectedIndex();
    const prevEl = prevIdx >= 0 && prevIdx < menu.vector.length ? menu.vector[prevIdx] : null;
    const prevFirstVisible = menu.firstVisibleIndex || 0;
    menu.clearVector();
    menu.addMenuElement(this.taskLineColor);
    menu.addMenuElement(this.taskTextColor);
    menu.addMenuElement(this.taskBgColor);
    menu.addMenuElement(this.fillSetting);
    if (VisualSettings.settings.fillEnabled) {
      menu.addMenuElement(this.taskFillColor);
      menu.addMenuElement(this.fillModeSetting);
      // пересоздаём, чтобы пункт отражал актуальное состояние (в т.ч. автосброс)
      this.hideLinesSetting = new SettingsStringRender("Hide lines", VisualSettings.settings.hideLines ? 0 : 1, this, this.toggleOptionNames, true, this.micro, this.gameMenuVisuals, false);
      menu.addMenuElement(this.hideLinesSetting);
    }
    menu.addMenuElement(this.curtainSetting);
    menu.addMenuElement(this.taskBgImage);
    const hasImage = VisualSettings.bgImage !== null || VisualSettings.bgGif !== null;
    if (hasImage) {
      menu.addMenuElement(this.bgModeSetting);
      menu.addMenuElement(this.showBgSetting);
      menu.addMenuElement(this.taskRemoveBg);
    }
    menu.addMenuElement(this.taskPresets);
    menu.addMenuElement(this.settingStringBack);
    if (prevEl !== null) {
      const idx = menu.vector.indexOf(prevEl);
      menu.selectedIndex = idx >= 0 ? idx : Math.min(prevIdx, menu.vector.length - 1);
    } else if (prevIdx >= 0) {
      menu.selectedIndex = Math.min(prevIdx, menu.vector.length - 1);
    }
    // восстановить окно прокрутки как было (без скачка к выделенному/вверх),
    // выделение гарантированно оставляем видимым
    const count = menu.visibleItemCount;
    menu.firstVisibleIndex = Math.min(prevFirstVisible, Math.max(0, menu.vector.length - count));
    menu.lastVisibleIndex = menu.firstVisibleIndex + count - 1;
    if (menu.lastVisibleIndex > menu.vector.length - 1) {
      menu.lastVisibleIndex = menu.vector.length - 1;
    }
    if (menu.selectedIndex >= 0 && menu.selectedIndex < menu.firstVisibleIndex) {
      const d = menu.firstVisibleIndex - menu.selectedIndex;
      menu.firstVisibleIndex = menu.selectedIndex;
      menu.lastVisibleIndex -= d;
    } else if (menu.selectedIndex > menu.lastVisibleIndex) {
      const d = menu.selectedIndex - menu.lastVisibleIndex;
      menu.lastVisibleIndex = menu.selectedIndex;
      menu.firstVisibleIndex += d;
    }
  }
  openMenu(gm, preserveSelection) {
    if (gm === null || gm === undefined) {
      return;
    }
    if (gm === this.gameMenuVisuals) {
      this.rebuildVisualsMenu();
    }
    this.micro.gameCanvas?.hideBackButton();
    if (gm !== this.gameMenuMain && gm !== this.gameMenuFinished && gm !== null) {
      this.micro.gameCanvas?.showBackButton();
    }
    if (gm === this.gameMenuHighscore) {
      if (this.settingsStringLeague !== null) {
        this.highscoreLeagueIndex = this.settingsStringLeague.getCurrentOptionPos();
        this.rebuildHighscoreMenu(this.highscoreLeagueIndex);
      }
    } else if (gm === this.gameMenuFinished) {
      this.playerNameBytes = this.gameMenuEnterName?.getStrArr() ?? this.playerNameBytes;
      this.finishNameAction?.setText(`Name - ${this.makeString(this.playerNameBytes)}`);
    } else if (gm === this.gameMenuPlay) {
      if (this.settingStringLevel !== null && this.settingsStringTrack !== null && this.micro.levelLoader !== null) {
        this.settingsStringTrack.setOptionsList(this.micro.levelLoader.levelNames[this.settingStringLevel.getCurrentOptionPos()]);
        if (this.currentGameMenu === this.trackSelectionMenu) {
          this.selectedTrackByLevel[this.settingStringLevel.getCurrentOptionPos()] = this.settingsStringTrack.getCurrentOptionPos();
        }
        this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()]);
        this.settingsStringTrack.setCurrentOptionPos(this.selectedTrackByLevel[this.settingStringLevel.getCurrentOptionPos()]);
      }
    }
    if (gm === this.gameMenuMain || gm === this.gameMenuPlay) {
      this.micro.gamePhysics?.enableGenerateInputAI();
    }
    this.currentGameMenu = gm;
    if (this.currentGameMenu !== null && !preserveSelection) {
      this.currentGameMenu.selectFirstMenuItem();
    }
    this.isOpeningPauseMenu = false;
  }
  rebuildHighscoreMenu(var1) {
    if (this.gameMenuHighscore === null || this.recordManager === null || this.settingStringLevel === null || this.settingsStringTrack === null || this.settingsStringLeague === null || this.micro.levelLoader === null || this.settingStringBack === null) {
      return;
    }
    this.gameMenuHighscore.clearVector();
    this.recordManager.openRecordStoreForTrack(this.settingStringLevel.getCurrentOptionPos(), this.settingsStringTrack.getCurrentOptionPos());
    this.gameMenuHighscore.addMenuElement(new TextRender(this.micro.levelLoader.getName(this.settingStringLevel.getCurrentOptionPos(), this.settingsStringTrack.getCurrentOptionPos()), this.micro));
    this.gameMenuHighscore.addMenuElement(new TextRender(`LEAGUE: ${this.settingsStringLeague.getOptionsList()[var1]}`, this.micro));
    const var2 = this.recordManager.getRecordDescription(var1);
    for (let var3 = 0; var3 < var2.length; ++var3) {
      if (var2[var3] !== "") {
        const var4 = new TextRender(`${var3 + 1}.${var2[var3]}`, this.micro);
        var4.setDx(GameCanvas.spriteSizeX[5] + 1);
        if (var3 === 0) {
          var4.setDrawSprite(true, 5);
        } else if (var3 === 1) {
          var4.setDrawSprite(true, 6);
        } else if (var3 === 2) {
          var4.setDrawSprite(true, 7);
        }
        this.gameMenuHighscore.addMenuElement(var4);
      }
    }
    this.recordManager.closeRecordStore();
    if (var2[0] === "") {
      this.gameMenuHighscore.addMenuElement(new TextRender("No Highscores", this.micro));
    }
    this.gameMenuHighscore.addMenuElement(this.settingStringBack);
  }
  saveAndClose() {
    if (this.isRecordStoreOpened) {
      this.persistState();
      try {
        this.recordStore?.closeRecordStore();
        this.isRecordStoreOpened = false;
      } catch {
      }
    }
    this.currentGameMenu = null;
  }
  persistState() {
    this.copyThreeBytesFromArr(16, this.playerNameBytes);
    this.setValue(0, this.perspectiveSetting?.getCurrentOptionPos() ?? 0);
    this.setValue(1, this.shadowsSetting?.getCurrentOptionPos() ?? 0);
    this.setValue(2, this.driverSpriteSetting?.getCurrentOptionPos() ?? 0);
    this.setValue(3, this.bikeSpriteSetting?.getCurrentOptionPos() ?? 0);
    this.setValue(14, this.inputSetting?.getCurrentOptionPos() ?? 0);
    this.setValue(4, this.lookAheadSetting?.getCurrentOptionPos() ?? 0);
    this.setValue(5, this.settingsStringLeague?.getMaxAvailableOptionPos() ?? 0);
    this.setValue(6, this.settingStringLevel?.getMaxAvailableOptionPos() ?? 0);
    this.setValue(10, this.settingStringLevel?.getCurrentOptionPos() ?? 0);
    this.setValue(11, this.settingsStringTrack?.getCurrentOptionPos() ?? 0);
    this.setValue(12, this.settingsStringLeague?.getCurrentOptionPos() ?? 0);
    for (let i = 0; i < 3; ++i) {
      this.setValue(7 + i, this.unlockedTracksByLevel[i]);
    }
    this.saveProgressToStorage();
    if (this.recordStore === null) {
      return;
    }
    if (this.recordStoreRecordId === -1) {
      try {
        this.recordStoreRecordId = this.recordStore.addRecord(this.persistedStateBuffer, 0, 19);
      } catch {
      }
    } else {
      try {
        this.recordStore.setRecord(this.recordStoreRecordId, this.persistedStateBuffer, 0, 19);
      } catch {
      }
    }
  }
  run() {
  }
  showAlert(title, alertText, image) {
    void image;
    if (title !== "") {
      this.micro.gameCanvas?.scheduleGameTimerTask(title, 2e3);
    }
    console.info(alertText);
    // текст алерта — ещё и попапом сверху (не только в консоль)
    showInfoToast(title, alertText);
  }
  handleMenuSelection(menuElement) {
    if (menuElement === this.taskStart) {
      if (this.settingStringLevel !== null && this.settingsStringTrack !== null && this.settingsStringLeague !== null && this.settingStringLevel.getCurrentOptionPos() <= this.settingStringLevel.getMaxAvailableOptionPos() && this.settingsStringTrack.getCurrentOptionPos() <= this.settingsStringTrack.getMaxAvailableOptionPos() && this.settingsStringLeague.getCurrentOptionPos() <= this.settingsStringLeague.getMaxAvailableOptionPos()) {
        this.micro.gamePhysics?.disableGenerateInputAI();
        this.micro.levelLoader?.loadLevel(this.settingStringLevel.getCurrentOptionPos(), this.settingsStringTrack.getCurrentOptionPos());
        this.micro.gamePhysics?.setMotoLeague(this.settingsStringLeague.getCurrentOptionPos());
        this.saveProgressToStorage();
        this.restartRequested = true;
        this.micro.menuToGame();
      } else {
        this.showAlert("GWTR", "Complete more tracks to unlock this track/league combo.", null);
      }
      return;
    }
    if (menuElement === this.perspectiveSetting) {
      this.micro.gamePhysics?.applyPerspectiveOffset(this.perspectiveSetting.getCurrentOptionPos() === 0);
      LevelLoader.isEnabledPerspective = this.perspectiveSetting.getCurrentOptionPos() === 0;
      return;
    }
    if (menuElement === this.shadowsSetting) {
      LevelLoader.isEnabledShadows = this.shadowsSetting.getCurrentOptionPos() === 0;
      return;
    }
    if (menuElement === this.driverSpriteSetting) {
      if (this.driverSpriteSetting.consumeSelectionMenuRequested()) {
        this.driverSpriteSetting.setCurrentOptionPos(this.driverSpriteSetting.getCurrentOptionPos() + 1);
      }
      return;
    }
    if (menuElement === this.bikeSpriteSetting) {
      if (this.bikeSpriteSetting.consumeSelectionMenuRequested()) {
        this.bikeSpriteSetting.setCurrentOptionPos(this.bikeSpriteSetting.getCurrentOptionPos() + 1);
      }
      return;
    }
    if (menuElement === this.inputSetting) {
      if (this.inputSetting.consumeSelectionMenuRequested()) {
        this.inputSetting.setCurrentOptionPos(this.inputSetting.getCurrentOptionPos() + 1);
      }
      this.micro.gameCanvas?.setInputMode(this.inputSetting.getCurrentOptionPos());
      return;
    }
    if (menuElement === this.lookAheadSetting) {
      this.micro.gamePhysics?.setEnableLookAhead(this.lookAheadSetting.getCurrentOptionPos() === 0);
      return;
    }
    if (menuElement === this.confirmYes) {
      if (this.currentGameMenu === this.gameMenuConfirmClear) {
        this.recordManager?.deleteRecordStoresForCurrentPack();
        window.localStorage.removeItem("gd-progress-" + this.currentPackId);
        this.setCurrentPack(this.currentPackId);
        this.showAlert("Cleared", "This pack's records and progress cleared", null);
      } else if (this.currentGameMenu === this.gameMenuConfirmReset) {
        this.exit();
        this.showAlert("Reset", "Master reset. Application will be closed.", null);
      }
      this.openMenu(this.currentGameMenu?.getParentMenu() ?? null, false);
      return;
    }
    if (menuElement === this.confirmNo) {
      this.openMenu(this.currentGameMenu?.getParentMenu() ?? null, false);
      return;
    }
    if (menuElement === this.settingStringBack) {
      this.openMenu(this.currentGameMenu?.getParentMenu() ?? null, true);
      return;
    }
    if (menuElement === this.settingStringPlayMenu) {
      if (this.settingStringLevel !== null && this.settingsStringTrack !== null) {
        this.settingStringLevel.setCurrentOptionPos(this.resumeLevelIndex);
        this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.resumeLevelIndex]);
        this.settingsStringTrack.setCurrentOptionPos(this.resumeTrackIndex);
      }
      this.openMenu(this.currentGameMenu?.getParentMenu() ?? null, false);
      return;
    }
    if (menuElement === this.settingStringGoToMain) {
      this.openMenu(this.gameMenuMain, false);
      return;
    }
    if (menuElement === this.settingStringExitGame) {
      this.openMenu(this.currentGameMenu?.getParentMenu() ?? null, false);
      return;
    }
    if (menuElement === this.restartTrackAction) {
      if (this.settingsStringLeague !== null && this.settingStringLevel !== null && this.settingsStringTrack !== null && this.settingsStringLeague.getCurrentOptionPos() <= this.settingsStringLeague.getMaxAvailableOptionPos()) {
        this.settingStringLevel.setCurrentOptionPos(this.resumeLevelIndex);
        this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.resumeLevelIndex]);
        this.settingsStringTrack.setCurrentOptionPos(this.resumeTrackIndex);
        this.micro.gamePhysics?.setMotoLeague(this.settingsStringLeague.getCurrentOptionPos());
        this.restartRequested = true;
        this.micro.menuToGame();
      }
      return;
    }
    if (menuElement === this.nextTrackAction) {
      if (!this.completedLastTrack) {
        this.settingsStringTrack?.menuElemMethod(2);
      }
      if (this.settingStringLevel !== null && this.settingsStringTrack !== null && this.settingsStringLeague !== null) {
        this.micro.levelLoader?.loadLevel(this.settingStringLevel.getCurrentOptionPos(), this.settingsStringTrack.getCurrentOptionPos());
        this.micro.gamePhysics?.setMotoLeague(this.settingsStringLeague.getCurrentOptionPos());
        this.persistState();
        this.restartRequested = true;
        this.micro.menuToGame();
      }
      return;
    }
    if (menuElement === this.settingStringContinue) {
      this.repaint();
      this.micro.menuToGame();
      return;
    }
    if (menuElement === this.finishNameAction) {
      this.gameMenuEnterName?.selectFirstMenuItem();
      this.openMenu(this.gameMenuEnterName, false);
      return;
    }
    if (menuElement === this.finishOkAction) {
      this.finalizeFinishedMenu();
      return;
    }
    if (menuElement === this.settingsStringTrack) {
      if (this.settingsStringTrack.consumeSelectionMenuRequested()) {
        this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.settingStringLevel?.getCurrentOptionPos() ?? 0]);
        this.settingsStringTrack.init();
        this.trackSelectionMenu = this.settingsStringTrack.getCurrentMenu();
        this.openMenu(this.trackSelectionMenu, false);
        this.trackSelectionMenu?.scrollToSelection(this.settingsStringTrack.getCurrentOptionPos());
      }
      if (this.settingStringLevel !== null) {
        this.selectedTrackByLevel[this.settingStringLevel.getCurrentOptionPos()] = this.settingsStringTrack.getCurrentOptionPos();
      }
      this.saveProgressToStorage();
      return;
    }
    if (menuElement === this.settingStringLevel) {
      if (this.settingStringLevel.consumeSelectionMenuRequested()) {
        this.gameMenuStringLevel = this.settingStringLevel.getCurrentMenu();
        this.openMenu(this.gameMenuStringLevel, false);
        this.gameMenuStringLevel?.scrollToSelection(this.settingStringLevel.getCurrentOptionPos());
      }
      if (this.micro.levelLoader !== null && this.settingsStringTrack !== null) {
        this.settingsStringTrack.setOptionsList(this.micro.levelLoader.levelNames[this.settingStringLevel.getCurrentOptionPos()]);
        this.settingsStringTrack.setAvailableOptions(this.unlockedTracksByLevel[this.settingStringLevel.getCurrentOptionPos()]);
        this.settingsStringTrack.setCurrentOptionPos(this.selectedTrackByLevel[this.settingStringLevel.getCurrentOptionPos()]);
        this.settingsStringTrack.init();
      }
      this.saveProgressToStorage();
      return;
    }
    if (menuElement === this.settingsStringLeague) {
      if (this.settingsStringLeague.consumeSelectionMenuRequested()) {
        this.gameMenuLeague = this.settingsStringLeague.getCurrentMenu();
        this.settingsStringLeague.setParentGameMenu(this.currentGameMenu);
        this.openMenu(this.gameMenuLeague, false);
        this.gameMenuLeague?.scrollToSelection(this.settingsStringLeague.getCurrentOptionPos());
      }
      this.saveProgressToStorage();
    }
    if (menuElement === this.taskSkins) {
      this.skinGalleryOpener?.();
      return;
    }
    if (menuElement === this.taskLineColor) {
      pickColor(VisualSettings.settings.lineColor, (hex) => {
        VisualSettings.settings.lineColor = hex;
      });
      return;
    }
    if (menuElement === this.fillSetting) {
      const fillNowOn = this.fillSetting.getCurrentOptionPos() === 0;
      VisualSettings.settings.fillEnabled = fillNowOn;
      if (!fillNowOn) {
        // скрытие линий действует только с заливкой: выключая fill, запоминаем
        // состояние hideLines и гасим его; при повторном включении — возвращаем
        this._hideLinesBeforeFillOff = VisualSettings.settings.hideLines === true;
        VisualSettings.settings.hideLines = false;
      } else {
        VisualSettings.settings.hideLines = this._hideLinesBeforeFillOff === true;
      }
      VisualSettings.save();
      this.rebuildVisualsMenu();
      return;
    }
    if (menuElement === this.hideLinesSetting) {
      VisualSettings.settings.hideLines = this.hideLinesSetting.getCurrentOptionPos() === 0;
      VisualSettings.save();
      return;
    }
    if (menuElement === this.fillModeSetting) {
      VisualSettings.settings.fillMode = this.fillModeSetting.getCurrentOptionPos() === 0 ? "gradient" : "steps";
      VisualSettings.save();
      return;
    }
    if (menuElement === this.taskBgImage) {
      pickFile(async (file) => {
        try {
          await saveBgImage(file);
          await VisualSettings.loadBgImageFromStorage();
          // свежезагруженный фон показываем сразу (например, после Remove BG image)
          VisualSettings.settings.showBgImage = true;
          VisualSettings.save();
          // появились настройки фона — обновить меню сразу, без перезахода
          this.rebuildVisualsMenu();
        } catch {
          this.showAlert("BG image", "Failed to load the image.", null);
        }
      });
      return;
    }
    if (menuElement === this.taskPresets) {
      openPresetsOverlay();
      return;
    }
    if (menuElement === this.taskRemoveBg) {
      (async () => {
        try {
          await clearBgImage();
        } catch {
        }
        VisualSettings.bgImage = null;
        VisualSettings.bgGif = null;
        if (VisualSettings.bgImageEl !== null) {
          VisualSettings.bgImageEl.remove();
        }
        VisualSettings.bgImageUrl = null;
        VisualSettings.bgImageEl = null;
        VisualSettings.settings.showBgImage = false;
        VisualSettings.save();
        this.rebuildVisualsMenu();
      })();
      return;
    }
    if (menuElement === this.bgModeSetting) {
      const pos = this.bgModeSetting.getCurrentOptionPos();
      VisualSettings.settings.bgImageMode = pos === 0 ? "fill" : pos === 1 ? "fit" : "tile";
      VisualSettings.save();
      return;
    }
    if (menuElement === this.showBgSetting) {
      VisualSettings.settings.showBgImage = this.showBgSetting.getCurrentOptionPos() === 0;
      VisualSettings.save();
      this.rebuildVisualsMenu();
      return;
    }
    if (menuElement === this.curtainSetting) {
      VisualSettings.settings.curtainEnabled = this.curtainSetting.getCurrentOptionPos() === 0;
      VisualSettings.save();
      return;
    }
    if (menuElement === this.taskFillColor) {
      pickColor(VisualSettings.settings.fillColor, (hex) => {
        VisualSettings.settings.fillColor = hex;
      });
      return;
    }
    if (menuElement === this.taskTextColor) {
      pickColor(VisualSettings.settings.textColor, (hex) => {
        VisualSettings.settings.textColor = hex;
      });
      return;
    }
    if (menuElement === this.taskBgColor) {
      pickColor(VisualSettings.settings.bgColor, (hex) => {
        VisualSettings.settings.bgColor = hex;
      });
      return;
    }
    if (menuElement === this.taskLevelPacks) {
      // открываем DOM-галерею паков (аналог скинов), а не подменю на канвасе
      this.packGalleryOpener?.();
      return;
    }
    if (menuElement === this.packMenu?.taskBrowsePacks) {
      void this.packMenu.loadPackListPage();
      return;
    }
    if (menuElement === this.packMenu?.taskCachedPacks) {
      void this.packMenu.loadCachedPacksPage();
      return;
    }
  }
  getLoadedSpriteFlags() {
    let var1 = 0;
    if ((this.driverSpriteSetting?.getCurrentOptionPos() ?? 1) === 0) {
      var1 |= 2;
    }
    if ((this.bikeSpriteSetting?.getCurrentOptionPos() ?? 1) === 0) {
      var1 |= 1;
    }
    return var1;
  }
  applyLoadedSpriteFlags(var1) {
    this.bikeSpriteSetting?.setCurrentOptionPos(1);
    this.driverSpriteSetting?.setCurrentOptionPos(1);
    if ((var1 & 1) > 0) {
      this.bikeSpriteSetting?.setCurrentOptionPos(0);
    }
    if ((var1 & 2) > 0) {
      this.driverSpriteSetting?.setCurrentOptionPos(0);
    }
  }
  getSelectedLevel() {
    return this.settingStringLevel?.getCurrentOptionPos() ?? 0;
  }
  getSelectedTrack() {
    return this.settingsStringTrack?.getCurrentOptionPos() ?? 0;
  }
  getSelectedLeague() {
    return this.settingsStringLeague?.getCurrentOptionPos() ?? 0;
  }
  setFinishTime(var1) {
    this.lastFinishTime = var1;
  }
  readStoredNameBytes(var1, var2) {
    switch (var1) {
      case 16: {
        const var3 = new Int8Array(3);
        for (let var4 = 0; var4 < 3; ++var4) {
          var3[var4] = this.persistedStateBuffer[16 + var4];
        }
        if (var3[0] === -127) {
          var3[0] = var2;
        }
        return var3;
      }
      default:
        return new Int8Array(0);
    }
  }
  readStoredValue(var1, var2) {
    return this.persistedStateBuffer[var1] === -127 ? var2 : this.persistedStateBuffer[var1];
  }
  copyThreeBytesFromArr(var1, var2) {
    if (this.isRecordStoreOpened && var1 === 16) {
      for (let i = 0; i < 3; ++i) {
        this.persistedStateBuffer[16 + i] = var2[i];
      }
    }
  }
  timeToString(time) {
    this.lastFinishSeconds = Math.trunc(time / 100);
    this.lastFinishCentiseconds = Math.trunc(time % 100);
    let timeStr = this.lastFinishSeconds / 60 < 10 ? ` 0${Math.trunc(this.lastFinishSeconds / 60)}` : ` ${Math.trunc(this.lastFinishSeconds / 60)}`;
    if (this.lastFinishSeconds % 60 < 10) {
      timeStr += `:0${this.lastFinishSeconds % 60}`;
    } else {
      timeStr += `:${this.lastFinishSeconds % 60}`;
    }
    if (this.lastFinishCentiseconds < 10) {
      timeStr += `.0${this.lastFinishCentiseconds}`;
    } else {
      timeStr += `.${this.lastFinishCentiseconds}`;
    }
    return timeStr;
  }
  setValue(pos, value) {
    if (this.isRecordStoreOpened) {
      this.persistedStateBuffer[pos] = value;
    }
  }
  loadProgressData(packId) {
    try {
      const raw = window.localStorage.getItem("gd-progress-" + packId);
      if (raw === null) {
        return null;
      }
      const d = JSON.parse(raw);
      if (typeof d.al !== "number" || typeof d.ml !== "number" || !Array.isArray(d.u) || d.u.length < 3) {
        return null;
      }
      return d;
    } catch {
      return null;
    }
  }
  saveProgressToStorage(withSelection = true) {
    try {
      const key = "gd-progress-" + this.currentPackId;
      let sel = null;
      let st = null;
      if (!withSelection) {
        // смена пака: НЕ затираем выбор чужими позициями виджетов,
        // оставляем ранее сохранённый (если пак реально игрался)
        try {
          const existing = window.localStorage.getItem(key);
          if (existing !== null) {
            const parsed = JSON.parse(existing);
            if (Array.isArray(parsed.sel) && parsed.sel.length >= 3) {
              sel = parsed.sel;
            }
            if (Array.isArray(parsed.st)) {
              st = parsed.st;
            }
          }
        } catch {
        }
      }
      const record = {
        al: this.availableLeagues,
        ml: this.maxAvailableLevel,
        u: [this.unlockedTracksByLevel[0], this.unlockedTracksByLevel[1], this.unlockedTracksByLevel[2]]
      };
      if (sel !== null) {
        record.sel = sel;
      } else if (withSelection) {
        record.sel = [
          this.settingStringLevel?.getCurrentOptionPos() ?? this.selectedLevelIndex,
          this.settingsStringTrack?.getCurrentOptionPos() ?? this.selectedTrackIndex,
          this.settingsStringLeague?.getCurrentOptionPos() ?? this.selectedLeagueIndex
        ];
      }
      if (st !== null) {
        record.st = st;
      } else if (withSelection) {
        record.st = [...this.selectedTrackByLevel];
      }
      window.localStorage.setItem(key, JSON.stringify(record));
    } catch {
    }
  }
  setCurrentPack(packId) {
    if (this.currentPackId !== packId) {
      this.saveProgressToStorage(false);
    }
    this.currentPackId = packId;
    try {
      window.localStorage.setItem("gd-last-pack", String(packId));
    } catch {
    }
    const data = this.loadProgressData(packId);
    if (data !== null) {
      this.availableLeagues = data.al;
      this.maxAvailableLevel = data.ml;
      this.unlockedTracksByLevel[0] = data.u[0];
      this.unlockedTracksByLevel[1] = data.u[1];
      this.unlockedTracksByLevel[2] = data.u[2];
    } else {
      this.availableLeagues = 0;
      this.maxAvailableLevel = 1;
      this.unlockedTracksByLevel[0] = 0;
      this.unlockedTracksByLevel[1] = 0;
      this.unlockedTracksByLevel[2] = -1;
    }
    // список лиг должен соответствовать прогрессу пака: 325cc виден только при анлоке
    this.leagueNames = this.availableLeagues < 3 ? ["100cc", "175cc", "220cc"] : this.leagueNamesAll4;
    this.settingsStringLeague?.setOptionsList(this.leagueNames);
    this.settingsStringLeague?.setAvailableOptions(this.availableLeagues);
    this.settingStringLevel?.setAvailableOptions(this.maxAvailableLevel);
    this.settingsStringLeague?.setAvailableOptions(this.availableLeagues);
    this.settingStringLevel?.setAvailableOptions(this.maxAvailableLevel);
    if (data !== null && Array.isArray(data.st)) {
      for (let i = 0; i < Math.min(data.st.length, this.selectedTrackByLevel.length); ++i) {
        this.selectedTrackByLevel[i] = data.st[i];
      }
    } else {
      for (let i = 0; i < this.selectedTrackByLevel.length; ++i) {
        this.selectedTrackByLevel[i] = 0;
      }
    }
    if (data !== null && Array.isArray(data.sel) && data.sel.length >= 3) {
      this.settingsStringLeague?.setCurrentOptionPos(Math.min(data.sel[2], this.availableLeagues));
      this.settingStringLevel?.setCurrentOptionPos(Math.min(data.sel[0], this.maxAvailableLevel));
      this.settingsStringTrack?.setCurrentOptionPos(data.sel[1]);
    } else {
      // сохранённого выбора нет — начинаем пак с первой позиции
      this.settingsStringLeague?.setCurrentOptionPos(0);
      this.settingStringLevel?.setCurrentOptionPos(0);
      this.settingsStringTrack?.setCurrentOptionPos(0);
    }
    if (this.recordManager !== null) {
      this.recordManager.packPrefix = packId === 0 ? "" : "p" + packId + "_";
    }
  }
  exit() {
    this.perspectiveSetting?.setCurrentOptionPos(0);
    this.shadowsSetting?.setCurrentOptionPos(0);
    this.driverSpriteSetting?.setCurrentOptionPos(0);
    this.bikeSpriteSetting?.setCurrentOptionPos(0);
    this.lookAheadSetting?.setCurrentOptionPos(0);
    this.settingsStringLeague?.setCurrentOptionPos(0);
    this.settingsStringLeague?.setAvailableOptions(0);
    this.settingStringLevel?.setCurrentOptionPos(0);
    this.settingStringLevel?.setAvailableOptions(1);
    this.settingsStringTrack?.setCurrentOptionPos(0);
    this.playerNameBytes[0] = 65;
    this.playerNameBytes[1] = 65;
    this.playerNameBytes[2] = 65;
    this.inputSetting?.setCurrentOptionPos(0);
    this.unlockedTracksByLevel[0] = 0;
    this.unlockedTracksByLevel[1] = 0;
    this.unlockedTracksByLevel[2] = -1;
    this.availableLeagues = 0;
    this.persistState();
    this.recordManager?.deleteRecordStores();
    for (let i = window.localStorage.length - 1; i >= 0; --i) {
      const k = window.localStorage.key(i);
      if (k !== null && k.startsWith("gd-progress-")) {
        window.localStorage.removeItem(k);
      }
    }
  }
  getCountOfRecordStoresWithPrefix(prefixNumber) {
    const storeNames = RecordStore.listRecordStores();
    if (this.recordManager !== null && storeNames.length !== 0) {
      const packPrefix = this.currentPackId === 0 ? "" : "p" + this.currentPackId + "_";
      const fullPrefix = packPrefix + String(prefixNumber);
      let count = 0;
      for (let i = 0; i < storeNames.length; ++i) {
        if (storeNames[i].startsWith(fullPrefix)) {
          ++count;
        }
      }
      return count;
    }
    return 0;
  }
  makeString(value) {
    return String.fromCharCode(value[0], value[1], value[2]);
  }
}
export {
  MenuManager
};
