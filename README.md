# Gravity Defied Web Ultimate

Browser port of the J2ME classic **Gravity Defied** (moto-trial racing). This repository is a community fork of [yurkagon/gravity-defied-web](https://github.com/yurkagon/gravity-defied-web), converted from TypeScript/Vite to plain JavaScript with **no build step and no Node.js toolchain**.

## Running locally

No build step: serve the repository root with any static file server and open it in a browser.

```bash
# Python (no dependencies)
python3 -m http.server 8000

# or Node.js
npx serve .
```

## Contents

- [Running locally](#running-locally)
- [Level packs](#level-packs)
- [Level editor](#level-editor)
- [Menus](#menus)
- [Skins](#skins)
- [Backup](#backup)
- [Local data layout](#local-data-layout)
- [Visual customization](#visual-customization)
- [Save data](#save-data)
- [Changes from upstream](#changes-from-upstream)
- [License](#license)

## Running locally

Open `http://localhost:8000`. Any equivalent works — VS Code «Live Server», nginx, GitHub Pages, and so on. Opening `index.html` directly via `file://` will **not** work: the game is built from ES modules, which browsers only load over HTTP(S).

## Level packs

- **Single unified catalog**: the whole community collection (~3 200 packs) lives in `data/packs/` as `<id>.mrg` with dense numeric ids; metadata comes from `data/packs_catalog.json`. The former per-source catalogs (gdmod / GDTR) were merged into it — rebuilds are done with the tools in `tools/` (`packs_3k_compare.py` → `build_packs.py` → `validate_packs.py`).
- **Pack gallery** (DOM overlay, mouse-driven): tabs — **Catalog**, **Saved**, **Custom** — with client-side paging (50/page) over the full local catalog.
- **Custom tab**: your own `.mrg` packs — import by button or drag-and-drop (author is read from the `Author - Name.mrg` file-name convention), cards with per-league progress bars and ⚠ flags like Saved, click to play, ✎ Edit opens the pack in the Level editor, delete (✕) soft or with progress. Cards show name, author and levels (`a/b/c`); the active pack has a green border, a fully completed one blue, an «impossible»-flagged one red. A soft-deleted pack that was completed keeps its blue border (completion lives in the records, not in the download), and a completed pack can not be flagged «impossible».
- **Auto-flagged broken packs**: `data/packs_broken.json` marks packs that don't parse or contain unrenderable tracks. They get the red «impossible» state and obey **Hide impossible** like a manual flag — but an auto-flag can not be toggled off in the UI; it disappears only when the pack is fixed and the report regenerated.
- **Sorting** is a row of toggle buttons (click to activate, click again to flip direction): tracks / name / author on Catalog (author is case-insensitive, packs without an author sort last); **% completed** / saved date / name / tracks on Saved; name / tracks / added on Custom. There is deliberately no date / downloads / source sort — the collection metadata doesn't carry them.
- **Search** by name works in every tab.
- **Visibility toggles** on every tab: **Hide downloaded**, **Hide 100%** and **Hide impossible** (on by default; hidden packs are filtered out before paging — not pinned to any page). The current pack is never hidden: it stays visible at its sorted position while it is loaded.
- **"Impossible" flag** (⚠, hover): marks a pack with a red border — click does not load the pack, state persists (`gd-pack-flags`).
- **🎲 Random** (catalog tabs): jumps to a random pack and flashes it. The draw excludes downloaded, «impossible» and fully completed packs and respects the current search — a quick way to surface something new worth playing.
- **Delete from Saved** (✕, hover): «Delete pack» keeps records (progress restores on re-download); «Delete with progress» also wipes the pack's record stores and progress — mirroring the in-game *Clear highscore* (RecordStore cache evicted, in-memory unlock state reset, deleted current pack falls back to Original levels).
- **Per-pack progress** on Saved cards: three mini-bars (Easy / Medium / Hard) counted from track records; league of a record is its store-name prefix (`p<id>_<league><track>`, e.g. `p42_115` = league 1, track 15), exactly as the game numbers them.
- **Per-pack persistence**: unlocked leagues/tracks, per-track records and last selection are stored per pack (`gd-progress-*`); the last active pack is restored on reload. If a pack's binary is missing from the cache, the game falls back to the original levels with a notice.

## Level editor

A built-in track editor (main menu → **Level editor**) for authoring and testing custom `.mrg` packs:

- **Canvas**: pan (right/middle drag), zoom to cursor (wheel), fit-to-view (**F**); fixed editor colors, independent of the in-game Visuals. The spawn point is drawn as a bike+rider schematic at 1:1 with the game's sprite proportions (wheel Ø15 px, 28 px wheelbase), scaled with the zoom; flags scale too.
- **Editing**: click empty space to append a point, drag points / start / finish / flags, **Delete** removes the selection, Ctrl+Z / Ctrl+Y undo/redo (50 steps), optional 8 px snap-to-grid, X/Y property inputs. Multi-select: **Ctrl+click** toggles a point, **Shift+drag** box-selects (Ctrl+Shift adds to the current selection), dragging any selected point moves the whole group.
- **Hotkeys** (layout-independent): **T** test drive, **F** fit, **H**/? help overlay, Esc close.
- **Pack tree**: 3 leagues × tracks numbered **E12. / M56. / H123.**, with add (blank or flat/hills/sine templates), ✎ rename, ⧉ duplicate, drag-and-drop reorder within and across leagues, ✕ delete.
- **Engine parity**: the editor decodes `.mrg` bit-exactly like the game (32-bit fixed-point pipeline, and the engine's silent drop of points whose X is not strictly increasing — what you see is exactly what the game renders). GDTR packs (F16 absolute points), empty stub tracks and over-declared header counts are tolerated.
- **Validation**: per-track rules (start left of finish, ≥ 4 points, flag placement — start/finish flags sharing a point, finish flag left of start, spawn sunk below the surface measured from the wheel bottom); **Check pack for errors** sweeps every track, click a problem jumps to it (with auto-scroll); duplicate-point warnings go to the console at export.
- **Minimap**: full-track strip with the viewport frame — click to jump.
- **Test drive** (**T**): rides the current track in the real physics with its league's moto class, starts directly (bypassing the unlock guard), keeps the league on manual restart, suppresses in-game info toasts, then returns to the editor unchanged.
- **Files**: export/import `.mrg` (import asks for confirmation); the **author is carried in the file name** — `Author - Name.mrg` — and parsed back on import. **Move to Custom** publishes the pack straight to the gallery's Custom tab (name + author + per-league track counts), where it can be played or re-opened for editing; custom pack ids start at 2 000 000 so records and progress never collide with the catalogs.
- **Drafts**: the work-in-progress autosaves (debounced) to IndexedDB and restores on reopen; **New pack** discards it.

## Menus

- The in-game **pause menu** mirrors the main menu's comfort: **Options**, **Visuals** and **Skins** are all available mid-run (Visuals and Skins sit right under Options).
- In the main menu, **Visuals** and **Level packs** sit next to each other — tune the look, then grab tracks to match it.
- **In-game info toasts** — the text of game alerts («pack loaded», «complete more tracks to unlock…») appears as a popup at the top of the screen, not just in the browser console.

## Skins

- The bike and rider graphics are skinnable; skins are individual `<id>.zip` files under `data/skins/`, unpacked in the browser with a built-in ZIP reader (`DecompressionStream` — no dependencies) and stored in IndexedDB.
- **Gallery** with Catalog / Saved tabs: sorting buttons (date / downloads / name / author; saved: date / name / size / author), search in all tabs, lazy thumbnails from `data/thumbs/` (see below), delete (✕) with confirmation — deleting the current skin auto-switches to Default.
- The built-in **Default** skin is always available in Saved.

## Backup

**Options → Export backup / Import backup** moves *everything* between browsers or machines:

- **localStorage** is dumped wholesale — every key: records, per-pack progress, flags, presets, settings (future settings are included automatically).
- **Downloaded content is stored by reference**: packs and skins are saved as id lists, and on import the app re-fetches the binaries from its own `data/` (missing ids are skipped and reported, never fatal).
- The **background image** is embedded as base64 — the only binary that exists nowhere but in your browser.
- Import is a **full replace** (with an explicit confirmation) and finishes with a report toast — how many packs/skins were restored, what was missing — followed by a reload. Typical backup size: well under a few megabytes.

## Local data layout

Everything the game needs is static content next to `index.html`:

```
data/
  packs_catalog.json      catalog metadata: id / name / author / levels per pack
  packs_broken.json       auto-flags for broken packs
  packs/<id>.mrg          level pack binaries — dense numeric ids
  skins.json
  skins/<id>.zip          skin archives (names already strict)
  thumbs/<id>.<ext>       skin thumbnails + thumbs.json manifest {"thumbs": {"<id>": "<file>"}}
```

Loading is lazy: the catalog on first gallery open, a pack file on its first download, a skin file on its first download. Thumbnails are plain files fetched on demand — no archives involved at runtime at all. The collection itself is (re)built offline.

## Visual customization

A **Visuals** section in the main menu (all settings global, stored in `gd-visual`, applied live):

- **Line color** — track lines (both perspective and flat rendering).
- **Text color** — in-game text including the stopwatch.
- **Background color** — game backdrop.
- **Track fill** — the track wall filled with a shade computed from each segment's slope; shading can be a **smooth gradient** or **fixed steps**; toggleable, own color.
- **Track curtain** — a solid layer from the track surface to the bottom of the screen (toggleable; flat/no-perspective mode shows the curtain only).
- **Background image** — any picture from your computer (fill / fit / tile modes; GIF support included — animated via a built-in decoder, since browsers do not animate GIFs drawn to canvas), with removal once loaded.
- **Two-tone track lines** — the surface line uses the main line color, while the far wall line and the surface→wall connectors are drawn in a derived darker shade, so the track keeps its classic depth at any custom color.
- **Hide lines** (shown when Track fill is on) — hides every track line, leaving the pure filled shape (and curtain). Toggling Track fill off remembers the choice and restores it when fill comes back.
- **Visual presets** — a dedicated **Presets** screen (transparent overlay over the paused game, so every change is visible live): save the current look under a name (with an overwrite warning on duplicate names), one-click apply, rename, delete (with confirmation), **import/export of single-preset JSON files** (name collisions offer *overwrite / rename imported / cancel*), **reset to default**, and **Back to last** — a one-step undo slot that captures the custom look the moment you first switch to a preset and restores it on demand.

## Save data

Everything is stored in the browser, **per origin** (`scheme + host + port`):

| Storage | Contents |
|---|---|
| `localStorage` | per-track records (`p<id>_*` record stores), per-pack progress/selection (`gd-progress-*`), pack flags (`gd-pack-flags`), visual presets (`gd-visual-presets`) and the preset undo slot (`gd-visual-last`), last active pack/skin, visual settings (`gd-visual`), game settings, schema version (`gd-schema-version`) |
| `IndexedDB` | downloaded and custom level packs (`GravityDefiedPacks`), downloaded skins and background image (`gdvisual`), editor drafts (`gd-editor`) |

Clearing site data wipes all progress, records and downloaded content.

**Schema migrations**: `gd-schema-version` guards one-time data wipes. Version 1 (catalog rebuild onto the unified collection) removed every id-bound key except the built-in pack (id 0 — its records and progress survive) and custom packs (ids ≥ 2 000 000); bumping the constant in `src/SchemaMigrate.js` is the mechanism for future breaking changes.

## Changes from upstream

Port date: 2026-09-23 → 2026-10-09; all 32 `.ts` modules transpiled to native ES modules. Highlights, in general terms:

- **Runtime**: no bundler and no Node.js — native ES modules, Vite-isms replaced with standard web APIs.
- **Stability**: fixed a startup hang (background raster drawn before load) and an infinite loop in the physics bisection (a bike falling out of the map froze the tab) by restoring the original algorithm's termination guard; settings/progress now flush on tab close.
- **Level packs / skins / visuals**: the subsystems described above, with batched canvas paths so the effects cost nothing at 60 fps.

## License

The original project is GPL-2.0. This port is a derivative work and remains GPL-2.0 — see [LICENSE.md](LICENSE.md).
