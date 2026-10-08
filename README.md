# Pneuma's Scene Tools

Scene, Actor, and access point utilities for Cyberpunk RED on Foundry VTT v12. Includes Quick Scene Creator, MookMaker, and NetArch Scanner. Requires libWrapper for native Scanner and AP double-click integration.

## In-world folders

Module-created documents use these folders:

```text
Scenes: SceneTools/Imported Scenes
Actors: SceneTools/MookMaker Templates
Actors: SceneTools/MookMaker Promoted Actors
Actors: SceneTools/NetArchAPs
```

Foundry folders have a document type, so the Scenes, Actors, and Items directories each use their own `SceneTools` root. The shared `ensureSceneToolsFolder` helper applies this convention to future world document creation. Embedded Items remain in their Actor.

## Integrated tools

- **MookMaker**: default character template and random token art; template-token tagging and native Token HUD control; editing identity, stats, HP, MOVE, Combat Number, skill groups, roles, armor, and weapons; fixed bullet-dodging choices; gear purge and Actor promotion. [Feature guide](docs/mookmaker/README.md).
- **NetArch Scanner**: six container-based AP templates; editable/custom AP types; native Scanner roll-card integration; GM AP editor and discovery panel; private/public reveals, configurable finite/looping pulses, per-AP names, Architecture colors, optional local vision circles, native AP HUD and double-click controls. [Feature guide](docs/netarch/README.md).

These features are integrated from the local MookMaker v0.93.4 and NetArch Scanner v0.9.0 sources. Their original repositories remain unchanged. Enable SceneTools in place of the standalone modules. SceneTools stores new settings and document flags under `pneuma-scenetools`; existing standalone settings/flags and world folders are not automatically migrated or moved.

The API is `game.modules.get("pneuma-scenetools").api`. It exposes `openSceneCreator`, `ensureFolder(type, child)`, `folders`, `mookMaker`, and `netArchScanner`, with the scanner's existing direct methods retained as aliases.

## Quick Scene Creator

As GM, open the Scenes sidebar and click **Quick Scene Creator** in its header beside the native creation controls. Choose an image or video using Foundry's native picker, select variants and their static/animated maps, then review details and overlays for each Scene. Created Scenes are inactive and their native configuration opens for review.

- Scans the map's folder and subfolders for native Foundry Scene JSON and Universal VTT JSON (`.dd2vtt`, `.uvtt`, `.df2vtt`, `.json`). Prioritizes `Foundry`, `Foundry Walls`, `FoundryWalls`, and `FoundryScenes` folders, ignoring case and separator differences. Starting in an `Image`/`Video` folder also scans its parent pack folder.
- Regex mappings ignore `fvtt-Scene`, `Cybermaps_`, and `SOL-` prefixes, Foundry export IDs, grid/resolution suffixes, and image/video format labels. `Map1` matches `floor-1`; `CorporateEateryInt` matches `corporate-eatery-interior`. Floor numbers, zoomed-out layouts, and descriptive variant names remain distinct. Candidates are scored from JSON filenames, Scene names, and background filenames; convention folders break name-score ties. Only a unique best match is preselected.
- Offers **Import all matching variants**, including related layouts without JSON. Each variant has editable static and animated map assignments and **Static / Animated / Both** choices. Both creates separate Scenes with Static/Animated name suffixes. **Use static and animated where both are available** applies Both to paired rows. Grid/resolution copies remain choices within a layout rather than extra layouts.
- Imports native Scene walls, lights, tiles, and other Scene data through Foundry's migration. Scene-level journal and playlist links are cleared. Imported token and note references may require review in the destination world.
- Converts Universal VTT line-of-sight walls, object walls, portals, and lights using the selected image dimensions and map origin. Requires a separate matching map image; embedded UVTT images are not extracted.
- Suggests 50, 70, 100, 140, 150, 200, 256, and 300 px grids using filename hints and whole-square fit, with Custom and Gridless choices. Includes square-grid preview and editable native grid types.
- World settings provide default grid size, darkness, and global illumination. Imported settings take priority; all can be adjusted during creation.
- Offers closely matching `OVERLAY`/`Foreground` images and videos from the scanned pack as positioned tiles or one full-map foreground. Floor and zoom variants are respected. Overlays are opt-in, with image/video previews and editable coordinates/dimensions.

Storage must be accessible through Foundry's file picker. Scans stop at 500 folders and report inaccessible folders/read failures. ZIPs and compendium databases are not imported. Asset paths are rematched only when their filename is unambiguous; unmatched paths are shown for review. Filename mappings are suggestions, so review variant assignments before creating Scenes. Grid guesses do not establish alignment; native grid configuration remains available for final adjustments. Changing scene dimensions resizes the image without moving imported geometry. Hex-grid previews are deferred to native Scene configuration. Batch imports review and create each selected Scene in sequence; cancelling or encountering an error stops further imports and reports the number already created.

## Development

Requires Node.js 22 or newer and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

Edit strict TypeScript under `src/scripts/`; use `.js` extensions for relative runtime imports. Assets live in `src/styles/`, `src/lang/`, and `src/templates/`. Do not edit generated `dist/` files.

`pnpm build` validates the manifest, checks types, cleans `dist/`, copies assets and documentation, compiles TypeScript, and validates output. Install the contents of `dist/` in Foundry's `Data/modules/pneuma-scenetools/` folder. Package those contents at the ZIP root as `pneuma-scenetools.zip`.

Install using the [latest module manifest](https://github.com/GMPneuma/PneumaSceneTools/releases/latest/download/module.json). Release ZIPs contain the contents of `dist/` directly at the archive root. Build checks do not establish live Foundry compatibility.

Optional browser fixtures: set `PNEUMA_PLAYWRIGHT_MODULE` to a Playwright ESM module URL, optionally set `PNEUMA_BROWSER_CHANNEL` to `chrome` or `msedge`, then run `node scripts/browser-test.mjs` and `node scripts/variants-browser-test.mjs` after building. The variants fixture also requires FFmpeg on PATH to generate a small local WebM. These fixtures use mocked Foundry APIs, with real image/video decoding and DOM form interactions.

