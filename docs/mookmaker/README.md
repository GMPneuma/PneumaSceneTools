# Pneuma Mook Maker

Planned work and editable statuses: [backlog.md](backlog.md).

A TypeScript module for Foundry Virtual Tabletop v12 and Cyberpunk RED Core.

## Development

Requirements: Node.js 22 or newer.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The build is written to `dist/`. For local Foundry development, place or link that directory at:

```text
<Foundry user data>/Data/modules/pneuma-scenetools
```

The module requires Cyberpunk RED Core v0.92.1 or newer. Its implementation
entry point is `src/scripts/mookmaker/main.ts`.

### Source layout

- `tokens.ts` registers token creation and Token HUD hooks.
- `mook-form.ts` renders the Mook Maker form and validates user input.
- `apply-mook.ts` applies changes transactionally and rolls back failures.
- `armor.ts`, `skills.ts`, and `stats.ts` contain calculation/update helpers.
- `purge.ts` and `promotion.ts` own their respective workflows.
- `folders.ts` manages MookMaker folders and the versioned default template.

## Current behavior

- On startup, a GM creates (or reuses) `SceneTools/MookMaker Templates` and
  `SceneTools/MookMaker Promoted Actors` in the Actors directory.
- A `Default Mook` Actor is created in `MookMaker Templates` as a Cyberpunk RED
  `character`, with an unlinked prototype Token and its embedded skills and
  equipment.
- Dropping an Actor directly from `SceneTools/MookMaker Templates` onto a scene marks the
  resulting unlinked Token with the module flag `CreatedByMookMaker`.
- Right-clicking a marked Token opens the normal Token HUD with a gold hammer
  control for the Mook Maker dialog.
- Apply can rename the synthetic Actor and Token, set BODY/WILL-derived HP,
  MOVE, Combat Number skill levels, armor, and Role rank.
- Two weapons from the mook's inventory can be equipped on Apply.
- Stats → **Can dodge bullets** always offers **Unchanged**, **REF 8**, and
  **Reflex Co-Processor**. There is no Combat Tools integration or setting lookup.
  REF is set before skills are adjusted to the
  Combat Number. The Co-Processor option reuses existing cyberware or imports the
  native system item, adding a Neural Link when needed. A full Neural Link or
  missing system item stops Apply with an error. This GM configuration does not
  roll Humanity loss. Existing qualifiers are never removed by **Unchanged**.
- Secondary and Tertiary Skills are always available and default to
  **Unchanged**; the former Set non-combat skills checkbox is removed.
- Purge Unused Gear removes unused inventory while preserving carried/equipped
  items and complete installed-item trees. Optional ammunition purging can
  retain every ammo type used by carried or equipped weapons.
- Promote creates a linked Actor in `SceneTools/MookMaker Promoted Actors`, links the current
  Token to it, and marks the Token as promoted from MookMaker.
- Purge and Promote are stacked in their shaded box on the right of the Mook
  section, beside compact role, level and token controls.

[Implementation and verification notes](bullet-dodging.md).

