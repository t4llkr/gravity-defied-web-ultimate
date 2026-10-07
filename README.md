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

Then open `http://localhost:8000`. Any equivalent works — VS Code «Live Server», nginx, GitHub Pages, and so on. Opening `index.html` directly via `file://` will **not** work: the game is built from ES modules, which browsers only load over HTTP(S).

## Level packs

- **Two catalogs**: **gdmod** (gdmod.ru) and **GDTR** (gdtr.net) — separate tabs in the gallery, one flat namespace (`gdtr` ids are offset by 1 000 000 internally, so caches, records and progress never collide between sources).
- **Pack gallery** (DOM overlay, mouse-driven): three tabs — **gdmod**, **GDTR**, **Saved** — with client-side paging (50/page) over the full local catalog. Catalog cards show name, levels (`a/b/c`), downloads (gdmod only) and date; the active pack has a green border, a fully completed one blue, an «impossible»-flagged one red. A soft-deleted pack that was completed keeps its blue border (completion lives in the records, not in the download), and a completed pack can not be flagged «impossible».
- **Sorting** is a row of toggle buttons (click to activate, click again to flip direction): date / downloads / tracks / name / author; Saved additionally sorts by **% completed**, saved date, name, tracks, source.
- **Search** by name works in every tab.
- **Visibility toggles** on every tab: **Hide downloaded**, **Hide 100%** and **Hide impossible** (hidden packs are filtered out before paging — not pinned to any page). The current pack is never hidden: it stays visible at its sorted position while it is loaded.
- **"Impossible" flag** (⚠, hover): marks a pack with a red border — click does not load the pack, state persists (`gd-pack-flags`).
- **🎲 Random** (catalog tabs): jumps to a random pack and flashes it. The draw excludes downloaded, «impossible» and fully completed packs and respects the current search — a quick way to surface something new worth playing.
- **Delete from Saved** (✕, hover): «Delete pack» keeps records (progress restores on re-download); «Delete with progress» also wipes the pack's record stores and progress — mirroring the in-game *Clear highscore* (RecordStore cache evicted, in-memory unlock state reset, deleted current pack falls back to Original levels).
- **Per-pack progress** on Saved cards: three mini-bars (Easy / Medium / Hard) counted from track records; league of a record is its store-name prefix (`p<id>_<league><track>`, e.g. `p42_115` = league 1, track 15), exactly as the game numbers them.
- **Per-pack persistence**: unlocked leagues/tracks, per-track records and last selection are stored per pack (`gd-progress-*`); the last active pack is restored on reload. If a pack's binary is missing from the cache, the game falls back to the original levels with a notice.

## Menus

- The in-game **pause menu** mirrors the main menu's comfort: **Options**, **Visuals** and **Skins** are all available mid-run (Visuals and Skins sit right under Options).
- In the main menu, **Visuals** and **Level packs** sit next to each other — tune the look, then grab tracks to match it.

## Skins

- The bike and rider graphics are skinnable; skins are individual `<id>.zip` files under `data/skins/`, unpacked in the browser with a built-in ZIP reader (`DecompressionStream` — no dependencies) and stored in IndexedDB.
- **Gallery** with Catalog / Saved tabs: sorting buttons (date / downloads / name / author; saved: date / name / size / author), search in all tabs, lazy thumbnails from `data/thumbs/` (see below), delete (✕) with confirmation — deleting the current skin auto-switches to Default.
- The built-in **Default** skin is always available in Saved.

## Local data layout

Everything the game needs is static content next to `index.html`:

```
data/
  packs_gdmod.json        catalog metadata (schema 1; from tools/sync_gdmod.py)
  packs_gdtr.json
  skins.json
  packs_gdmod/<id>.mrg    level pack binaries — strict names after rename_packs.py
  packs_gdtr/<id>.mrg
  skins/<id>.zip          skin archives (names already strict)
  thumbs/<id>.<ext>       skin thumbnails + thumbs.json manifest {"thumbs": {"<id>": "<file>"}}
```

Loading is lazy: catalog JSONs on first gallery open, a pack file on its first download, a skin file on its first download. Thumbnails are plain files fetched on demand — no archives involved at runtime at all.

## Visual customization

A **Visuals** section in the main menu (all settings global, stored in `gd-visual`, applied live):

- **Line color** — track lines (both perspective and flat rendering).
- **Text color** — in-game text including the stopwatch.
- **Background color** — game backdrop.
- **Track fill** — the track wall filled with a shade computed from each segment's slope; shading can be a **smooth gradient** or **fixed steps**; toggleable, own color.
- **Track curtain** — a solid layer from the track surface to the bottom of the screen (toggleable; flat/no-perspective mode shows the curtain only).
- **Background image** — any picture from your computer (fill / fit / tile modes; GIF support included — animated via a built-in decoder, since browsers do not animate GIFs drawn to canvas), with removal once loaded.
- **Two-tone track lines** — the surface line uses the main line color, while the far wall line and the surface→wall connectors are drawn in a derived darker shade, so the track keeps its classic depth at any custom color.
- **Visual presets** — a dedicated **Presets** screen (transparent overlay over the paused game, so every change is visible live): save the current look under a name (with an overwrite warning on duplicate names), one-click apply, rename, delete (with confirmation), **import/export of single-preset JSON files** (name collisions offer *overwrite / rename imported / cancel*), **reset to default**, and **Back to last** — a one-step undo slot that captures the custom look the moment you first switch to a preset and restores it on demand.

## Save data

Everything is stored in the browser, **per origin** (`scheme + host + port`):

| Storage | Contents |
|---|---|
| `localStorage` | per-track records (`p<id>_*` record stores), per-pack progress/selection (`gd-progress-*`), pack flags (`gd-pack-flags`), visual presets (`gd-visual-presets`) and the preset undo slot (`gd-visual-last`), last active pack/skin, visual settings (`gd-visual`), game settings |
| `IndexedDB` | downloaded level packs (`gdpacks`), downloaded skins and background image (`gdvisual`) |

Clearing site data wipes all progress, records and downloaded content.

## Changes from upstream

Port date: 2026-09-23 → 2026-10-07; all 32 `.ts` modules transpiled to native ES modules. Highlights, in general terms:

- **Runtime**: no bundler and no Node.js — native ES modules, Vite-isms replaced with standard web APIs.
- **Stability**: fixed a startup hang (background raster drawn before load) and an infinite loop in the physics bisection (a bike falling out of the map froze the tab) by restoring the original algorithm's termination guard; settings/progress now flush on tab close.
- **Level packs / skins / visuals**: the subsystems described above, with batched canvas paths so the effects cost nothing at 60 fps.

## License

The original project is GPL-2.0. This port is a derivative work and remains GPL-2.0 — see [LICENSE.md](LICENSE.md).
