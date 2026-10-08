# MookMaker backlog

Updated: 2026-09-29

Edit each **Status** directly. Priorities are initial suggestions, not an agreed work order.

**Priority:** High = address next; Medium = useful, can wait; Low = optional improvement.  
**Status:** Idea = needs discussion; Ready = defined and available to pick up; In progress = work started; Blocked = cannot proceed; Done = completion criteria met; Dropped = no longer planned.

Keep IDs permanent. Add new items by copying an entry. Move finished or dropped items to the bottom and record a date and outcome. Listing work does not authorize implementation. Live verification means checking the actual Foundry world; automated checks alone do not satisfy it.

Source: [current behavior](README.md). BL-001 and BL-002 are proposed verification/documentation follow-ups. BL-003 was requested by the user.

## Open items

### BL-001 — Verify the full mook workflow

**Priority:** Medium  
**Status:** Idea

**Problem:** The README describes supported behavior but does not record a current live-world verification pass.

**Desired result:** Record whether the normal creation, editing, cleanup and promotion workflow works in the supported world.

**Done when:**

- [ ] Create a template token and confirm its Mook Maker control appears.
- [ ] Apply name, stats, skills, armor, role and weapon choices; confirm another token from the same template is unchanged.
- [ ] Purge unused gear while preserving installed item trees and required ammunition.
- [ ] Promote a mook and confirm the resulting Actor and token link are correct.
- [ ] Record Foundry/system/module versions and any failures.

**Notes:** Suggested follow-up based on README.md; no confirmed bug.

### BL-002 — Document everyday GM use

**Priority:** Low  
**Status:** Idea

**Problem:** The README lists capabilities but has no complete step-by-step GM walkthrough.

**Desired result:** A GM can create, edit, purge and promote a mook using the project documentation.

**Done when:**

- [ ] Document the steps and expected results for each workflow.
- [ ] Explain how template, unlinked mook and promoted Actor edits differ.

**Notes:** Suggested documentation improvement based on README.md.


## Done or dropped

### BL-003 — Bullet dodging options and compact Mook controls

**Priority:** High
**Status:** Done

**Problem:** Bullet-dodging setup is not easily configured in MookMaker, and the form is too tall.

**Desired result:** Provide three fixed bullet-dodging choices and fit Purge/Promote beside the compact controls in the Mook section.

**Done when:**

- [x] Stats → Can dodge bullets always offers Unchanged, REF 8 and Reflex Co-Processor.
- [x] Apply REF 8 before setting skills to match the Combat Number.
- [x] Install the native Reflex Co-Processor when selected, reusing existing items.
- [x] Remove Set non-combat skills; keep Secondary and Tertiary controls available with Unchanged selected by default.
- [x] Remove all Combat Tools integration and setting checks.
- [x] Compact the Mook controls and move the shaded Purge/Promote box into that section.

**Superseded decision:** The original request filtered choices using Combat Tools qualifiers. The user explicitly replaced that design with three unconditional options on 2026-09-29.

**Closed:** 2026-09-29  
**Outcome:** Included in 0.93.4. Build, focused behavior checks and browser layout checks passed. Live Foundry verification remains pending under BL-001. See [implementation notes](docs/bullet-dodging.md).

