# Master roadmap

## SceneTools consolidation — implemented locally; live verification pending

- All module-created in-world folders use document-type-specific `SceneTools` roots.
- Imported Scenes, MookMaker Templates, MookMaker Promoted Actors, and NetArchAPs use the exact requested child names.
- Imported all existing MookMaker v0.93.4 and NetArch Scanner v0.9.0 source functionality, assets, settings, templates, documentation, and available regressions.
- Ported scanner runtime to TypeScript and changed runtime paths/storage to `pneuma-scenetools`.
- Preserved original source repositories. Original MookMaker roadmap and statuses are retained in `docs/mookmaker/backlog.md`; its deferred items remain deferred.
- Existing standalone world data migration is not implemented; this consolidation creates new folders/data under SceneTools.

## Quick Scene Creator — implemented locally; live verification pending

- Native Foundry map browser/search: implemented through the native image picker and its filename filter.
- Scan selected folder and subfolders for standard scene data: implemented for Foundry Scene JSON and Universal VTT exports.
- Create maps with imported walls and lighting: implemented with explicit import selection.
- Prompt for scene details and suggest grid size: implemented with common choices, Custom, Gridless, square preview, and filename hints.
- Allow scene lighting defaults: implemented as world settings and per-creation edits.
- Prompt for overlay images in the same folder: implemented as positioned tiles or one full-map foreground.
- Recognize Foundry/Foundry Walls/FoundryWalls folders and the supplied FoundryScenes example: implemented with case-insensitive regex mappings and prioritized discovery.
- Rank Scene JSON against publisher/export naming conventions: implemented; floor and zoom variants remain distinct.
- Offer all variants and static/animated/both imports: implemented with explicit choices and per-variant map assignments, including layouts without JSON.
- Offer closely matching OVERLAY/Foreground assets: implemented for static images and videos across the scanned pack. Supersedes showing every other image in the selected folder.

## Fundamentals cleanup - 0.2.0

- Consolidate folder lookup/creation and preserve renamed legacy folders.
- Centralize compatibility checks and reduce the public API to the actual tools.
- Restore native Foundry typing and explicitly type Scanner data.
- Replace repeated dialogs with one native batch-review form, shared settings and per-scene overrides.
- Filter unrelated JSON candidates before fetching and keep manual file-picker overrides.
- Require saved-document confirmation; retain form values and skip saved entries on retry.
- Run the shared browser contract suites in CI. Live persistence verification remains pending.

## Limits and deferred work

- Form refinement (0.2.2): generated HTML, field-name rewriting, and stored builder closures removed. Native template rendering and partial-batch retry regressions pass; matching behavior retained.
- Submission correction (0.2.1): final field names, direct form reads, root-form selection setup, and pre-save numeric validation implemented. Native serializer and browser regressions pass; live-world confirmation remains pending.
- Live Foundry v12 verification and representative real map-pack imports remain pending.
- Archive/compendium extraction, UVTT embedded-image extraction, and visual grid-line detection are not implemented.
- Hex alignment uses native Scene configuration; the creator previews square grids.

