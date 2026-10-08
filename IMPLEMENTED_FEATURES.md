# Implemented features

## Module foundation

- Foundry v12 manifest targeting Cyberpunk RED.
- Strict TypeScript, compiler-based build, manifest validation, and CI.
- Init registration for settings and the Scenes sidebar control.
- Integrated MookMaker and NetArch Scanner startup, settings, assets, templates, styling, and APIs; independent startup failure handling. libWrapper is required for scanner wrappers.

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
- Recursive import discovery, explicit import choice, and filename-match suggestion.
- Native Scene JSON migration and import, plus Universal VTT walls, portals, and lights conversion.
- Editable scene dimensions, grid types/distance/units, lighting, token vision, and fog exploration.
- Common grid-size ranking, filename hints, Custom/Gridless choices, and square-grid preview.
- World defaults for grid size, darkness, and global illumination.
- Same-folder overlay thumbnails, opt-in tiles with placement/dimensions, and one full-map foreground.
- Unambiguous nearby asset rematching, scan warnings, inactive creation, and native Scene configuration.
- Case-insensitive Foundry/Foundry Walls/FoundryWalls/FoundryScenes folder recognition and regex ranking for the provided Train Assault and Corporate Eatery naming conventions.
- Explicit bulk variant selection, per-variant media assignments, Static/Animated/Both Scene creation, and image/video-only layout variants.
- Matching OVERLAY/Foreground image and video suggestions, preserving floor and zoom layout differences.
- Video-capable picker, video metadata dimensions, and video frame grid preview.

Type checks, imported regressions, folder/startup checks, and browser fixtures pass. These checks use mocked Foundry APIs. Live Foundry, hosting-provider file browsing, multiplayer visibility, and real map-pack alignment verification are pending. Existing standalone world data is not automatically migrated. See README.md for limits and feature guides.

