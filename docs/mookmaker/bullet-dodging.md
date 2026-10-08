# Bullet dodging configuration

Included in 0.93.4 for BL-003. Live-world verification remains pending.

The Stats selector always offers Unchanged, REF 8 and Reflex Co-Processor.
Unchanged preserves existing REF and cyberware. Combat Tools integration was
removed at the user's request; no module activation or evasion settings are read.

Purge and Promote retain their shaded container inside the Mook section, beside
the compact identity and token controls. Apply and Cancel remain at the bottom.

REF 8 is included when calculating skill levels and written before skill Item
updates. Secondary/tertiary categories are skipped unless Set to is selected.

Co-Processor setup searches current system compendiums and reuses existing
cyberware. A missing Neural Link is imported; a present link must have capacity.
The configured native Item class creates embedded items and CPR's `installItems`
installs them. It does not set the derived `isInstalledInActor` flag directly.
This explicit GM configuration avoids the actor wrapper's sheet-dependent
installation/Humanity wizard. New item IDs and prior installation data participate
in the existing Apply rollback. Unrelated newly created items are not deleted.

Native source checked: CPR v0.92.4
[actor creation and installation](https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core/-/raw/v0.92.4/src/modules/actor/cpr-actor.js)
and [container installation](https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core/-/raw/v0.92.4/src/modules/item/mixins/cpr-container.js).

## Verification

Run `node scripts/build.mjs`, then `node scripts/bullet-dodging.test.mjs`.
Set `PNEUMA_PLAYWRIGHT_MODULE` to a Playwright module URL to include the Edge
layout fixture and write `output/bullet-dodging-form.png`.

The checks cover fixed choices without module access, REF/skill ordering,
unchanged categories, existing-item reuse, missing/full foundations, rollback,
selector placement in Stats and the compact Mook action box. These are mocked document and browser checks.

Live checks still needed: native system compendium imports, installation with a
character/mook sheet open or closed, unlinked-token isolation, Apply failure
recovery, and native actor-sheet state after configuration.
