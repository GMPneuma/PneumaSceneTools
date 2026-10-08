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

The API is `game.modules.get("pneuma-scenetools").api`, with `openSceneCreator()` and `netArchScanner`. Version 0.2.0 removes the duplicate top-level Scanner aliases, folder API, and empty MookMaker API object. Existing Scanner macros should use `.api.netArchScanner`.

## Quick Scene Creator

As GM, open the Scenes sidebar and click **Quick Scene Creator** in its header beside the native creation controls. Choose an image or video using Foundry's native picker. If Foundry Scene JSON is discovered, first choose **Import according to JSON** or **Make changes**. Assign JSON files to map variants, review the imported values and geometry, then create the Scenes. One native window contains the workflow. Scenes go to SceneTools/Imported Scenes without opening extra configuration windows.

- Scans the map's folder and subfolders for native Foundry Scene JSON and Universal VTT JSON (`.dd2vtt`, `.uvtt`, `.df2vtt`, `.json`). Prioritizes `Foundry`, `Foundry Walls`, `FoundryWalls`, and `FoundryScenes` folders, ignoring case and separator differences. Starting in an `Image`/`Video` folder also scans its parent pack folder.
- Regex mappings ignore `fvtt-Scene`, `Cybermaps_`, and `SOL-` prefixes, Foundry export IDs, grid/resolution suffixes, and image/video format labels. `Map1` matches `floor-1`; `CorporateEateryInt` matches `corporate-eatery-interior`. Floor numbers, zoomed-out layouts, and descriptive variant names remain distinct. Matching filenames and every JSON in conventional Foundry folders are read. Candidates are scored from JSON filenames, Scene names, and background filenames; convention folders break name-score ties. Each map layout has a JSON selector with a unique best match preselected. A JSON may be reused for multiple variants, including four maps with only two exports. Choose No JSON for map-only creation; native Scene-file and map Browse buttons permit overrides.
- Offers **Import all matching variants**, including related layouts without JSON. Each variant has editable static and animated map assignments and **Static / Animated / Both** choices. Both creates separate Scenes. Unchanged JSON imports retain the JSON's Scene name; Make changes offers Static/Animated name suffixes. **Use static and animated where both are available** applies Both to paired rows. Grid/resolution copies remain choices within a layout rather than extra layouts.
- Prepares complete exports through native `Scene.fromImport()` with version metadata retained, and saves through `scene.importFromJSON()`. Name, walls, lights, tiles, tokens, sounds, notes, drawings, flags, links, and other Scene fields are passed to Foundry's standard import. Foundry controls identities, ownership, folder placement and import state. The selected map replaces the background source; unchanged mode retains the other JSON values. Make changes starts with JSON values and applies the edits while retaining data outside the form. References to documents from another world may require review afterward.
- Converts Universal VTT line-of-sight walls, object walls, portals, and lights using the selected image dimensions and map origin. Requires a separate matching map image; embedded UVTT images are not extracted.
- Suggests 50, 70, 100, 140, 150, 200, 256, and 300 px grids using filename hints and whole-square fit, with Custom and Gridless choices. JSON grid settings populate the review first. The square-grid preview includes cyan imported walls and amber light-source markers; it does not simulate Foundry lighting or vision. Native grid types remain editable in Make changes mode.
- World settings provide default grid size, darkness, and global illumination. Imported settings take priority; all can be adjusted during creation.
- Offers closely matching `OVERLAY`/`Foreground` images and videos from the scanned pack as positioned tiles or one full-map foreground. Floor and zoom variants are respected. Overlays are opt-in, with image/video previews and editable coordinates/dimensions.

Storage must be accessible through Foundry's file picker. Scans stop at 500 folders and report inaccessible folders/read failures. ZIPs and compendium databases are not imported. Make changes rematches asset paths only when their filename is unambiguous; unchanged mode retains original asset paths. Unmatched paths are shown for review. Filename mappings are suggestions, so review variant assignments before creating Scenes. Grid guesses do not establish alignment; native grid configuration remains available for final adjustments. Changing scene dimensions resizes the image without moving imported geometry. Hex-grid previews are deferred to native Scene configuration. The full batch is reviewed and validated before creation. A failed save keeps the form and its values open, reports how many Scenes were saved, and permits retry without duplicating completed or pending imports. Success requires world collection membership and completion of the native import.

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

Browser contract checks run in CI with `pnpm test:browser`. Locally, install Chromium with `pnpm exec playwright install chromium`, or set `PNEUMA_BROWSER_CHANNEL=msedge` to use installed Edge. FFmpeg is required for the generated WebM fixture. The fixtures render the actual Handlebars form template, share one form/document adapter, and test lexical-global startup, folders, real media decoding, batch submission, rejection, partial-save retry, and saved-document confirmation. They do not prove persistence in a live Foundry database.
