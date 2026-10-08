# Changelog

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

