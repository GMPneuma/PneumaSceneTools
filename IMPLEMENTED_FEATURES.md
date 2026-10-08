# Implemented features

- Import then overrides (v0.2.4): untouched JSON is imported first, followed by changed field updates, embedded asset rematches, and selected overlay tiles. Pending Scenes are reused after either import or override failures. Browser tests verify ordering and preservation; live-world verification remains pending.
- JSON-first creation (v0.2.3): choose import according to JSON or make changes; assign each layout a reusable Scene JSON; preload JSON values and preview imported walls/light sources. Native migration and JSON import receive complete Scene data. Core import policies handle identities/state; the module no longer strips journal/playlist or other fields. Pending native imports reuse their destination on retry. Browser regressions cover four variants/two JSONs; live persistence remains pending.
- The creator renders selection and review through one native Handlebars template. Scene preparation returns plain data; one builder validates and applies form values. Saved batch entries are marked and locked during retry (v0.2.2).
- Scene creation reads the registered form with final per-scene field names; missing numeric fields and invalid dimensions/grid values are rejected before saving (v0.2.1). Verified with the native v12 form serializer in an isolated browser; live-world persistence remains unverified.

## Module foundation

- Foundry v12 manifest targeting Cyberpunk RED.
- Strict TypeScript, compiler-based build, manifest validation, and CI.
- Init registration for settings and the Scenes sidebar control.
- Integrated MookMaker and NetArch Scanner startup, settings, assets, templates, styling, and APIs; per-feature registration and ready error reporting. libWrapper is required for scanner wrappers.
- Scanner runtime resolves native Foundry lexical globals; startup browser coverage verifies module loading, menus/API, the sidebar button, and seven template Actors.

## In-world folder convention

- Shared document-type-aware `SceneTools` root creation, with concurrent feature calls reusing one root.
- Imported Scenes use `SceneTools/Imported Scenes`.
- MookMaker uses `SceneTools/MookMaker Templates` and `SceneTools/MookMaker Promoted Actors`.
- AP template Actors use `SceneTools/NetArchAPs`.
- The same helper is available for future world Items, Journals, RollTables, and Playlists; embedded Items remain in their parent Actor.

## MookMaker

Imported the existing v0.93.4 functionality: versioned default character template, embedded equipment and skills, random token artwork, unlinked-template token tagging, native Token HUD control, identity/stats/HP/MOVE changes, Combat Number skill adjustments, secondary/tertiary skill settings, Role and armor changes, two weapon selections, Unchanged/REF 8/Reflex Co-Processor options with native item installation and rollback, gear/ammunition purge, and promotion to linked Actors. Preserved the compact form and skill classification settings. Runtime asset paths and module storage use `pneuma-scenetools`.

## NetArch Scanner

Imported the existing v0.9.0 functionality and ported runtime source to TypeScript: six private AP templates, custom/disabled AP types and artwork, AP editor/HUD/double-click controls, native Scanner roll-card wrapper, GM discovery panel with original roll-card display, Netrunner ownership/selection and grid-aware radius filtering, individual/bulk private/public reveals, Hide All, accumulated runner recipients, per-AP names, configurable finite/looping pulses, stable Architecture colors and per-Scene unassigned colors, local above-fog artwork/optional vision circles, and cleanup on concealment or canvas teardown. Runtime asset paths, settings, flags, and libWrapper registrations use `pneuma-scenetools`.

## Quick Scene Creator

- GM-only button in the native Scenes sidebar and native image file picker.
- Scene button uses native header actions, supports specific and generic sidebar render hooks, and attaches to an already-rendered sidebar at ready; duplicate controls are prevented.
- Recursive import discovery, explicit import choice, and filename-match suggestion.
- Native Scene JSON migration and import, plus Universal VTT walls, portals, and lights conversion.
- Editable scene dimensions, grid types/distance/units, lighting, token vision, and fog exploration.
- Common grid-size ranking, filename hints, Custom/Gridless choices, and square-grid preview.
- World defaults for grid size, darkness, and global illumination.
- Same-folder overlay thumbnails, opt-in tiles with placement/dimensions, and one full-map foreground.
- Unambiguous nearby asset rematching, scan warnings, and inactive creation; native Scene configuration remains available afterward.
- Case-insensitive Foundry/Foundry Walls/FoundryWalls/FoundryScenes folder recognition and regex ranking for the provided Train Assault and Corporate Eatery naming conventions.
- Explicit bulk variant selection, per-variant media assignments, Static/Animated/Both Scene creation, and image/video-only layout variants.
- Matching OVERLAY/Foreground image and video suggestions, preserving floor and zoom layout differences.
- Video-capable picker, video metadata dimensions, and video frame grid preview.

Type checks, imported regressions, folder/startup checks, and browser fixtures pass. These checks use mocked Foundry APIs. Live Foundry, hosting-provider file browsing, multiplayer visibility, and real map-pack alignment verification are pending. Existing standalone world data is not automatically migrated. See README.md for limits and feature guides.


Scene Creator uses one native FormApplication for selection and batch review, shared lighting/vision, per-scene overrides, and one batch submission. Empty overlay steps and automatic Scene configuration popups are removed. Failure retains form values and retries only unsaved scenes. World collection membership is checked before reporting success. SceneTools/Imported Scenes is provisioned by the active GM at world startup.

Folder lookup and creation are shared by all features and recognize existing renamed folders by current or legacy flags. Scanner uses native Foundry types plus explicit AP, pulse, discovery, settings, and UI data types; global/constructor proxies and untyped global declarations are absent. Compatibility policy is centralized in the module entry point. The API exposes only openSceneCreator and netArchScanner.

The browser suites run in CI. They cover startup, native-form contracts, static/animated batches, shared settings, invalid forms, failed persistence and retry. Live Foundry verification remains pending because browser attachment reports Debugger unattached.
