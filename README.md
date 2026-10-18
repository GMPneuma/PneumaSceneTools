# Pneuma's Scene Tools

**Scene Tools · Hazards** in Token/Region controls. Draw GM-only native Regions, configure native hazard actors/cameras/drones, confirm activations, link Scanner access points, and save world presets with file import/export. See the [Hazards guide](docs/traps.md) for setup, module boundaries and validation limits.

Scene, Actor, and access point utilities for Cyberpunk RED on Foundry VTT v12. Includes Quick Scene Importer, Modular Scene Creator, Map POIs, Patrol, Vehicles, MookMaker, Access Points, and Hazards. Requires libWrapper for native Scanner and AP double-click integration.

## In-world folders

Module-created documents use these folders:

```text
Scenes: SceneTools/Imported Scenes
Scenes: SceneTools/Modular Scenes
Actors: SceneTools/MookMaker Templates
Actors: SceneTools/MookMaker Promoted Actors
Actors: SceneTools/NetArchAPs
Actors: SceneTools/Hazard Actor Templates
```

Foundry folders have a document type, so the Scenes, Actors, and Items directories each use their own `SceneTools` root. The shared `ensureSceneToolsFolder` helper applies this convention to future world document creation. Embedded Items remain in their Actor.

## Integrated tools

- **Patrol**: GM Token Controls > Scene Tools - Patrol opens the compact scene controller with per-token Start/Stop/Edit and scene pause/resume that preserves individual stops. Loop, Back & Forth, or Random within a Region. Optional waypoint/path pauses and side tracks, distance preference, movement-time limits, wall avoidance, clear stopping footprints, movement speed and combat suspension. SceneTools vehicles use eight-direction moving turns, reversing maneuvers and collision-aware movement reservations. Runs on the active GM's viewed scene. [Usage and limits](docs/patrol.md). Live Foundry and multiplayer verification remain pending.

- **MookMaker**: default character template and random token art; template-token tagging and native Token HUD control; editing identity, stats, HP, MOVE, Combat Number, skill groups, roles, armor, and weapons; fixed bullet-dodging choices; gear purge and Actor promotion. [Feature guide](docs/mookmaker/README.md).
- **NetArch Scanner**: six container-based AP templates; editable/custom AP types; native Scanner roll-card integration; GM AP editor and discovery panel; private/public reveals, configurable finite/looping pulses, per-AP names, Architecture colors, optional local vision circles, native AP HUD and double-click controls. [Feature guide](docs/netarch/README.md).

These features are integrated from the local MookMaker v0.93.4 and NetArch Scanner v0.9.0 sources. Their original repositories remain unchanged. Enable SceneTools in place of the standalone modules. SceneTools stores new settings and document flags under `pneuma-scenetools`; existing standalone settings/flags and world folders are not automatically migrated or moved.

The API is `game.modules.get("pneuma-scenetools").api`, with `openSceneCreator()` and `netArchScanner`. Version 0.2.0 removes the duplicate top-level Scanner aliases, folder API, and empty MookMaker API object. Existing Scanner macros should use `.api.netArchScanner`.

## Quick Scene Importer

The embedded native picker uses image/video thumbnail mode so map files remain visible; Next selects the current folder, not an individual file.

As GM, open the Scenes sidebar and click **Quick Scene Importer** in its header beside the native creation controls. The three-step wizard starts with a native Foundry file picker embedded in the wizard (source tabs, favorites, filtering and folder navigation). A map image/video must be selected. **Next: Select variants** searches its folder and subfolders for matching normalized filename families, showing progress and Cancel search in the same window. Step 2 has aligned map assignments and compact **File** buttons. **Next: Review scenes** shows a scene pick-list on the left and its preview and editable fields on the right, with shared settings across the top. Review notes, source/foreground paths, counts, grid guidance and missing-asset warnings are in a separately scrolling right sidebar. Checking **Apply these settings to all scenes** disables the individual lighting and vision fields; unchecking restores their previous values. Review fields use compact control widths, with scene dimensions side by side and custom grid size shown only when Custom is selected. Distance per square is one dropdown (1 m, 2 m, 4 m), without a separate units field. An unusual imported distance/unit pair remains available as the selected imported option until changed. **Back** returns to assignments and preserves edits when assignments are unchanged; it is unavailable while saving or once a Scene has been saved. Assign JSON files to map variants, review the imported values and geometry, then create the Scenes. One native window contains the workflow. Scenes go to SceneTools/Imported Scenes without opening extra configuration windows.

- Scans the map's folder and subfolders for native Foundry Scene JSON and Universal VTT JSON (`.dd2vtt`, `.uvtt`, `.df2vtt`, `.json`). Prioritizes `Foundry`, `Foundry Walls`, `FoundryWalls`, and `FoundryScenes` folders, ignoring case and separator differences. Starting in an `Image`/`Video` folder also scans its parent pack folder.
- Regex mappings ignore `fvtt-Scene`, `Cybermaps_`, and `SOL-` prefixes, Foundry export IDs, grid/resolution suffixes, and image/video format labels. `Map1` matches `floor-1`; `CorporateEateryInt` matches `corporate-eatery-interior`. Floor numbers, zoomed-out layouts, and descriptive variant names remain distinct. Matching filenames and every JSON in conventional Foundry folders are read. Candidates are scored from JSON filenames, Scene names, and background filenames; convention folders break name-score ties. Each map layout has a JSON selector with a unique best match preselected. A JSON may be reused for multiple variants, including four maps with only two exports. Choose No JSON for map-only creation; native Scene-file and map Browse buttons permit overrides.
- Offers **Import all matching variants**, including related layouts without JSON. Each variant has editable static and animated map assignments and import checkboxes beside **Static image** and **Animated video**. Checking both creates separate Scenes. Imported names populate the review, with Static/Animated suffixes for paired media. **Use static and animated where both are available** checks both import boxes on paired rows. Grid/resolution copies remain choices within a layout rather than extra layouts.
- Prepares complete exports through native `Scene.fromImport()` with version metadata retained. Saving follows **Import → Apply overrides**: `scene.importFromJSON()` receives the untouched original JSON, then native updates apply the selected background and changed settings. Name, walls, lights, tiles, tokens, sounds, notes, drawings, flags, links, and other Scene fields go through Foundry's standard import. Foundry controls identities, ownership, folder placement and import state. Editable review starts with JSON values; only changed supported fields are updated afterward. Embedded asset path replacements also execute after import. Imported image paths appears only for existing tile/token images, without adding duplicate tiles. References to documents from another world may require review afterward.
- The Foreground / overlay dropdown lists every image/video in the map folder, plus the current imported foreground only if it was found in the scanned files, so differently named files can be selected manually. Selection updates the preview and saved path, persists through Back, and clears only the replaced foreground warning. Unavailable JSON foregrounds appear as a disabled Missing foreground placeholder, not a selectable file. None removes the foreground. JSON foregrounds automatically rematch by filename in the selected map folder first, then beside the Scene JSON, before using an unambiguous scanned-file match. The resolved foreground is composited over the map in the import preview, with its path shown; loading failures are reported beside the preview. Native JSON import is followed by the foreground path update.

- Converts Universal VTT line-of-sight walls, object walls, portals, and lights using the selected image dimensions and map origin. Requires a separate matching map image; embedded UVTT images are not extracted.
- Suggests 50, 70, 100, 140, 150, 200, 256, and 300 px grids using filename hints and whole-square fit, with Custom grid size and Squares/Gridless grid types. JSON grid settings populate the review first. The square-grid preview includes cyan imported walls and amber light-source markers; it does not simulate Foundry lighting or vision. Native grid types remain editable during review.
- Grid type offers only Squares and Gridless. Foundry JSON grid size, supported grid type and distance are selected by default and marked (Imported); fallback sizes are marked (Suggested).

- World settings provide default grid size, darkness, and global illumination. Imported settings take priority; all can be adjusted during creation.
- Offers closely matching `OVERLAY`/`Foreground` images and videos from the scanned pack as positioned tiles or one full-map foreground. Floor and zoom variants are respected. Overlays are opt-in, with image/video previews and editable coordinates/dimensions.

Storage must be accessible through Foundry's file picker. Scans can be cancelled, stop at 500 folders, and report inaccessible folders/read failures. Folder/media reads time out after 15 seconds; JSON reads run up to four at a time. Closing the Creator during preparation cancels media loading. ZIPs and compendium databases are not imported. Editable review rematches asset paths only when their filename is unambiguous. Unmatched paths are shown for review. Filename mappings are suggestions, so review variant assignments before creating Scenes. Grid guesses do not establish alignment; native grid configuration remains available for final adjustments. Changing scene dimensions resizes the image without moving imported geometry. Grid type is limited to Squares and Gridless. The full batch is reviewed and validated before creation. A failed save keeps the form and its values open, reports how many Scenes were saved, and removes unfinished Scenes before retrying. Completed Scenes are retained. If cleanup fails, keep the window open and retry; the pending Scene is reused. Browser shutdown or a connection loss during writes still requires checking the world for incomplete documents. Success requires world collection membership and completion of the native import.

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

Browser contract checks run in CI with `pnpm test:browser`. Locally, install Chromium with `pnpm exec playwright install chromium`, or set `PNEUMA_BROWSER_CHANNEL=msedge` to use installed Edge. FFmpeg is required for the generated WebM fixture. The fixtures render the actual Handlebars form template, share one form/document adapter, and test lexical-global startup, folders, real media decoding, batch submission, rejection, partial-save retry, and saved-document confirmation. They do not prove persistence in a live Foundry database. See [live verification](docs/live-verification.md).

MookMaker uses one operation guard per token within each client. Template upgrades use version flags and recognize moved default templates. The form uses separate Handlebars markup, view data, typed input parsing, and native document actions. Feature loading and startup failures are isolated. Scanner refreshes are filtered and coalesced; panel rendering resolves only referenced documents.

Map POIs use one journal per Scene under SceneTools and one page per location, with default headings for Description, Factions, NPCs, Contacts, and Services. Pins open their own page, and a Pan to Note button appears at the top of linked journals. Configure the template and hover fields in Map POI Defaults. The POI manager provides editable JSON import/export for Notes and linked journals. [JSON format and import behavior](docs/map-pin-transfer.md).

## Modular Scene Creator

Click **Modular Scene Creator** in the Scenes directory and enter a name. It creates a blank scene under **SceneTools / Modular Scenes** and opens live tile controls. The first tile sets the scene dimensions. Place tiles from any matching collection, rotate them, and expand or shrink at the scene edges. One-step Undo restores the last modular edit. Use native Foundry tools to draw walls. The Tiles toolbar resumes building. [Usage and limits](docs/modular-scenes.md).

The modular tile picker generates WebP still thumbnails up to 160 pixels for images and videos, and caches them with original dimensions in the browser across reloads. Initial generation reads the originals; previews and placement retain full-resolution files. Refresh regenerates a collection after files change.
