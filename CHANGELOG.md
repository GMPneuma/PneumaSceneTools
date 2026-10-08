# Changelog

## 0.2.5 - 2026-10-08

- Guard Apply, Purge and Promote against overlapping operations on the same token within a client.
- Delete unfinished Scene imports after failure; retain completed Scenes and preserve retry state when cleanup itself fails. Import original JSON before applying overrides.
- Preserve moved and current-version Mook templates, including intentionally empty templates; bound default-template fetches.
- Isolate feature loading/registration and run ready tasks independently.
- Filter and batch Scanner refreshes; resolve referenced documents without scanning the entire world on every panel render.
- Add cancellable folder scanning and media preparation, bounded reads, and four concurrent JSON reads.
- Move MookMaker markup into Handlebars and split view data, typed input validation, and event wiring.
- Expand failure, rollback, cancellation, startup-isolation and rendered-form regressions. Live Foundry and multiplayer verification remains pending.

## 0.2.4 - 2026-10-08

- Save in two phases: import untouched original JSON using Foundry's native import, then apply overrides through native updates.
- Update only changed supported fields; preserve the imported settings, flags, and embedded data outside those overrides. Background assignments also happen after import.
- Apply embedded asset rematches and create selected overlay tiles after the native import. Retrying an override failure reuses the same Scene.
- Verify original import payloads, import/update ordering, minimal override updates, overlay creation, and failed-override retry in browser regressions. Live-world verification remains pending.

## 0.2.3 - 2026-10-08

- Restore JSON-first choice: import according to JSON or make changes. Review uses imported values; unchanged imports keep the JSON Scene name and settings.
- Give each map layout an explicit Scene JSON assignment, allowing several variants to reuse one JSON. Discover all exports in conventional Foundry folders, including generically named files.
- Use Foundry's asynchronous `Scene.fromImport()` for migration and `scene.importFromJSON()` for saving complete Scene data. Remove custom field stripping; Foundry owns import identity/state policies.
- Show source files, embedded-content counts, imported walls, and light-source markers in the preview. Explicit map assignments replace the background source; other JSON data remains intact in unchanged mode.
- Reuse pending destination documents when native import fails, avoiding duplicates on retry. Add four-variant/two-JSON, full-payload, preview, and import-retry browser regressions. Live-world persistence remains unverified.

## 0.2.2 - 2026-10-08

- Move all selection/review controls into one native Handlebars template with final field names and automatic escaping. Remove generated form HTML, regex field rewriting, and per-scene builder closures.
- Keep matching/ranking intact; use plain selection and prepared Scene data with one validated Scene builder.
- Mark saved scenes and disable their controls after a partial batch save, preserving unsaved values for retry.
- Render the real Handlebars template in browser tests and verify partial-save retry without duplicate Scenes. Live-world persistence remains unverified.

## 0.2.1 - 2026-10-08

- Render final per-scene input names before Foundry attaches form listeners, and read creation values directly from the registered form.
- Support Foundry's root form element during selection setup. Validate required numeric values before Scene creation instead of converting missing fields to zero.
- Match the browser fixture to Foundry's form root and reject invalid Scene dimensions/grid values. Verify the cached native v12 serializer in an isolated browser; live-world persistence remains unverified.

## 0.2.0 - 2026-10-08

- Consolidate folder discovery and creation, including renamed folders identified by legacy MookMaker flags.
- Use a single native Scene Creator window for batch review, shared lighting/vision, per-scene overrides, overlays, validation and creation. Keep failed imports open and retry only unsaved scenes.
- Filter unrelated JSON/media candidates before loading and rendering; retain native file-picker overrides.
- Restore native Foundry types and explicit Scanner data models; remove untyped globals and redundant startup checks.
- Reduce the public API to openSceneCreator and netArchScanner; remove duplicate Scanner aliases and empty/internal API entries.
- Consolidate browser fixtures and run startup and import contract checks in CI. Actual live-world persistence remains unverified.

## 0.1.3 - 2026-10-08

- Remove all scanner global and constructor proxy wrappers; use Foundry globals directly.
- Route scene creator buttons and Enter through native Dialog submission, preserving validation and cancellation.
- Create SceneTools/Imported Scenes folders when the GM loads the world.

## 0.1.2 - 2026-10-08

- Fix module startup failing before hook registration: use Foundry's lexical global classes and services instead of assuming they are globalThis properties. Add a browser regression that runs init and ready with lexical globals and verifies the sidebar button and MookMaker/AP provisioning.

## 0.1.1 - 2026-10-08

- Fix the missing Quick Scene Creator button by supporting native sidebar header actions, the generic sidebar render hook, and already-rendered Scenes sidebars. Prevent duplicate buttons and retain GM-only visibility.

## 0.1.0 - 2026-10-08

- Initialize the TypeScript Foundry v12 module scaffold using Combat Tools tooling conventions.
- Add the GM Quick Scene Creator: native map picker, recursive nearby import discovery, Foundry Scene/Universal VTT import, editable grid suggestions and preview, lighting defaults, and opt-in overlays.
- Add convention-aware regex matching, all-variant imports, Static/Animated/Both Scene choices, and closely matching overlay/foreground images and videos.
- Consolidate MookMaker v0.93.4 and NetArch Scanner v0.9.0 functionality, source, assets, documentation, and regressions; port scanner runtime to TypeScript.
- Use `pneuma-scenetools` for integrated module paths/storage and document-type-specific `SceneTools` world folders with the requested child names.

