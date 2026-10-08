# Master roadmap

## Sustainability review - implemented; live verification pending

- Guard Apply, Purge and Promote against overlapping operations on the same token within a client.
- Delete unfinished Scene imports after failure; retain completed Scenes and preserve retry state when cleanup itself fails. Import original JSON before applying overrides.
- Preserve moved and current-version Mook templates, including intentionally empty templates; bound default-template fetches.
- Isolate feature loading/registration and run ready tasks independently.
- Filter and batch Scanner refreshes; resolve referenced documents without scanning the entire world on every panel render.
- Add cancellable folder scanning and media preparation, bounded reads, and four concurrent JSON reads.
- Move MookMaker markup into Handlebars and split view data, typed input validation, and event wiring.
- Expand failure, rollback, cancellation, startup-isolation and rendered-form regressions. Live Foundry and multiplayer verification remains pending.


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

- Import/override execution (0.2.4): native import receives original JSON; overrides execute afterward using native Scene/embedded-document updates. Supersedes modifying the JSON import payload itself.
- JSON-first workflow (0.2.3): native import/migration, reusable per-map JSON assignment, complete payload preservation, and preview of imported settings/geometry implemented. Supersedes custom field stripping and JSON-centered selection rows. Live-world verification remains pending.
- Form refinement (0.2.2): generated HTML, field-name rewriting, and stored builder closures removed. Native template rendering and partial-batch retry regressions pass; matching behavior retained.
- Submission correction (0.2.1): final field names, direct form reads, root-form selection setup, and pre-save numeric validation implemented. Native serializer and browser regressions pass; live-world confirmation remains pending.
- Live Foundry v12 verification and representative real map-pack imports remain pending.
- Archive/compendium extraction, UVTT embedded-image extraction, and visual grid-line detection are not implemented.
- Hex alignment uses native Scene configuration; the creator previews square grids.

