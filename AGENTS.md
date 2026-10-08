# Project guidance

## Scope

Implement only user-authorized workflows. SceneTools includes Quick Scene Creator, MookMaker, and NetArch Scanner; importing their existing functionality does not authorize unrelated features.

## In-world folders

All module-created world folders belong under a document-type-specific `SceneTools` root. Use the shared helper in `src/scripts/world-folders.ts` to create or reuse roots and child folders. Scenes use `SceneTools/Imported Scenes`; Actors use `SceneTools/MookMaker Templates`, `SceneTools/MookMaker Promoted Actors`, and `SceneTools/NetArchAPs`. Future world Items and other documents use the same root convention for their own document type. Embedded Items remain inside their Actor.

All runtime assets, settings, flags, hooks, and public APIs use module id `pneuma-scenetools`. Preserve feature-specific CSS/localization names where they are identifiers, rather than module paths.

## Design principles

Preserve native Foundry v12 and Cyberpunk RED behavior. Inspect the relevant APIs, templates, styles, and workflows before adding features. Keep implementation small, direct, and readable; avoid speculative frameworks, dependencies, settings, or persistent state. Prefer native controls and minimal scoped styling. Preserve necessary permission, target, and duplicate-application checks.

## Language and tooling

Use strict TypeScript under `src/`, Foundry v12 type definitions, pnpm, and the compiler-based build. Use `.js` extensions in runtime imports. JavaScript build scripts belong in `scripts/`. Do not edit generated `dist/` files.

## Build layout

Write runtime files directly into `dist/`; do not nest them under a module-named folder. Package the contents of `dist/` at the ZIP root. The installed folder is `pneuma-scenetools`.

## Documentation

Keep IMPLEMENTED_FEATURES.md updated for every feature or convenience option added, changed, or removed. Distinguish working behavior from placeholders and deferred designs. Keep BACKLOG.md as the master roadmap and preserve user-requested features and superseding decisions. Keep package and manifest versions synchronized and update CHANGELOG.md for releases. Do not claim live Foundry verification from build or automated checks alone.

## Communication

Be factual and concise. Never imply personal firsthand experience or anthropomorphize yourself. Do not add color commentary.

