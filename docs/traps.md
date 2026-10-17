# Hazards

The Hazards toolbar uses a warning triangle. New hazards using **Default hazard Actor** get matching portrait/token artwork and an equipped Very Heavy Pistol with a 200-round magazine containing 200 Basic rounds. All rounds are loaded; there is no extra reserve stack. Each Actor owns its own native weapon/ammunition documents. Saving again preserves spent ammunition. Existing Actors keep their equipment; selected custom templates supply their own equipment.

Local implementation for Foundry v12 / Cyberpunk RED. No official hazard statistics or presets are distributed. Live Foundry and multiplayer verification remains pending.

## Editor and placement

Open Scene Tools - Hazards from Token or Region controls. The left list contains hazards on the current scene. Add hazard opens a new draft. Save immediately adds it to the scene list, even without a Region shape or complete configuration. Choose an existing Trigger Region. Save creates a small GM-only trigger Region if no existing trigger Region is selected. All hazard configuration and state is stored on the Scene. Existing Regions can use Add Scene Tools hazard in their native configuration sheet. Locate on map selects and pans to the Region.

The editor has three rows, with the scene hazard list at left:

1. Hazard identity, description, perception/counter settings, Hazard Actor template and NetArch AP on the left; Effects and selected effect properties on the right.
2. Trigger Region, trigger choices and Activated By on the left; Targets / Area on the right.
3. Red Controls on the left; Presets in the middle; a large Save Hazard button on the right.

Incomplete drafts can be saved. The yellow list warning identifies missing templates, Regions, weapons or effect selections; runtime checks readiness before activation. Counter checks use Electronics/Security Tech.

Choose a native Actor template from SceneTools / HazardActor Templates. Save creates an independent hidden native Actor/token under SceneTools / Hazard Actors, using the template's stats, equipment and weapons. The HP field is removed. Reveal hazard exposes the token for ordinary player targeting and native damage. Its attack effects use this same Actor. At zero native HP, the hazard cannot activate. Repeated saves preserve damage. Changing templates replaces the instance only after saving succeeds, preserving the source template and rolling back new documents on failure.

Actor creation does not require a Region. Save supplies a default trigger Region. Define or edit shapes and separate target Regions through native Foundry Region controls. Native Region controls create or reuse a linked Scene hazard record; Region geometry remains native. Shapes, holes and elevation remain native Region settings.

## Triggers and areas

Trigger Region selects a native Region on the current scene, defaulting to the hazard's own Region. Selecting another Region adds a native behavior listener without creating a second hazard. Shape, elevation and membership remain native. Trigger choices are:

- Enter / cross Region, using native membership and movement segments.
- Move within Region, after the specified travel distance inside it.
- Hazard Actor's turn, for eligible targets still in the trigger Region. Always uses this hazard's innate Actor. Add it to combat using native controls. No camera range or earlier engagement is required.
- Token in Region at start of turn, using the native Region turn event.

Below the trigger choices, Activated By lists incoming hazards as read-only entries. Configure connections at the source with Trigger another hazard effects. No selected local triggers is valid for a linked-only hazard. Manual requests remain available to the active GM.

Targets offers All Actors in Region or Only triggering Actor, using this hazard's fixed trigger Region. All Actors includes eligible NPCs and excludes hazard bodies, condition instances and AP markers. Only triggering Actor uses the initiating token; entry/crossing can affect it even if it finishes outside the Region. To affect a different area, add Trigger another Hazard and configure that hazard's own Region.

## Effects

Add effect appends an entry. Edit opens its Type selector and properties beside the list. Entries can be removed or moved up.

| Type | Configuration and behavior |
| --- | --- |
| Direct Damage | Label/instructions, 0d6–8d6, Interact with Armor, Half Armor, Skill to avoid and DV. Existing custom formulas remain readable for compatibility. |
| MOVE Penalty | Penalty amount, duration in seconds (0 = until removed), Remove on exit, Skill to avoid and DV. |
| Apply Status Effects | Native status effect, Skill to avoid and DV. |
| Spawn Condition Instance | Select a world Actor as the template. Creates a small unlinked token attached to each target, using the template's HP and active Actor effects. It follows target movement and visibility. Destroying/deleting it removes only the effects it applied. Removing all applied effects also removes the instance; templates without effects remain attached until destroyed or the target is deleted. The template is never edited or deleted. |
| Hazard Actor will attack | Choose a weapon from this hazard's automatically created Actor. Edit its equipment through Open hazard actor. Requires Combat Tools scene-attack API v2. Area weapons use its existing placement and multi-target response/damage flow. |
| Trigger another hazard | Choose another hazard on this scene. Resolving this entry requests that hazard's own GM-confirmed activation. Cycles are suppressed. |

The active GM confirms activations and resolves effects individually. An effect with Resist Skill requires an explicit success/skip or failure decision before application; its roll uses the target's native skill. Direct damage, statuses and MOVE penalties then create a Combat Tools effect card, grouping confirmed targets from the same activation/effect. One rolled amount is shared across those targets, and application remains a separate GM click per target. SceneTools retains native damage application and effect cleanup. Condition instances keep their existing GM-confirmed spawn and publish completed result rows without another attack, resistance check or application click. Repeated or stale clicks cannot reuse a card revision. Partial/uncertain failures enter review and are not automatically replayed.

Each hazard Actor gets one native weapon attack per active combat round, including manual native sheet/HUD attacks. Damage/status/MOVE effects and condition spawning do not consume that allowance. One weapon dispatch is shared across an activation's target/effect cards; an area weapon launches one AoE flow, while a single-target weapon attacks only the chosen target. Outside combat there is no round/time cooldown, but each activation still allows only one weapon attack. Cancelling targeting or a roll dialog leaves the activation available; uncertain post-roll failures require review. Both updated modules are required. Existing Combat Tools encounter-participation requirements still apply.

Native ActiveEffects own status and MOVE changes. MOVE penalties expose duration and removal on exit/source destruction. Duration and damage-removal behavior is stored on each effect. Condition-instance destruction always removes that instance's effects, preserving unrelated effects with the same status. Counter timing and notice/counter DVs are GM references, not automated adjudication.

## Presets and Scanner

Load Preset replaces the draft after an unsaved-change check. Save as preset uses the draft name and confirms same-name overwrites. Preset files supports JSON import/export and deletion. Presets are world settings, not compendiums. Saving and exporting presets clears trigger/affected Region, body, attacking/turn actor, AP marker and linked-hazard references. Condition Actor template references are retained. Assign scene references after loading; importing into a world without the referenced template leaves an inactive draft.

The Region body can be a Scanner access point using existing icon choices and a linked marker. This retains standard architecture, audience, reveal and pulse behavior without replacing the attackable body. Scanner marker discovery does not reveal the body automatically.

Hazards require current saved fields. Drawing migration, legacy link lists, single-trigger aliases, combined-effect editor conversion and retired patrol requests are not supported. The editor offers the four triggers above; the runtime also supports camera/end-of-turn/manual triggers.

The module manifest must declare the hazard RegionBehavior subtype. After installing an updated manifest, restart Foundry before testing creation. No cooldown, charges or automatic patrol routes are provided. Item-based trigger exemptions remain backlog; GMs adjudicate exemptions on confirmation cards.

## Verification

Type/build checks, native-event fixtures, GM authority and card revision tests, HP preservation and rollback, area selection, turn membership, resistance gating, condition movement/destruction/failure cleanup, native attacks and browser layout/preset tests. These checks do not establish live Foundry or multiplayer behavior.

## Revised editor layout

Top: Hazard (name, description, perception DV, token icon, counter DV/time and NetArch Access Point) beside Effects. Middle: Triggers beside Targets/Area. Fixed bottom: red Controls (Activated, Trigger now, Reveal/Hide and Open Hazard Actor), Presets, and a large Save Hazard button. Boxes match the height of their row.

Counter checks always use Electronics/Security Tech. The skill selector is removed, and existing/imported configurations normalize to that skill. Trigger now requests GM confirmation with saved settings and selected targets. Import / Export beneath Add Hazard opens the preset-file panel. New hazard Actors use native system defaults; edit HP and equipment through Open hazard actor.

## Creating linked documents

Save creates a native GM-only blank trigger Region named `<hazard>-Tigger` for a new hazard. Later saves reuse the saved Region reference. A missing saved Region or hazard Actor reports an error; delete and recreate the affected hazard. No orphan document is adopted or rebuilt. If saving the initial Region reference fails, the newly created Region is deleted.

The hazard editor has no Region Create/Edit buttons. Use native Region controls to adjust the automatic shape or create a separate target Region, then select it in Target Region. Target selection is enabled when Target a different Region is checked.

Create NetArch AP places an ordinary Scanner token from the selected Actor template, with the hazard name and template artwork. It works without hazard HP. Save does not create an AP. The button is disabled while the linked AP exists. Deleted APs clear their reference in the editor; a deleted saved trigger reference remains invalid. Save reports a missing trigger Region. Create NetArch AP becomes available again for a missing AP and requires an existing selected AP template.

## Innate Hazard Actor

Place native mook/character templates in `SceneTools/HazardActor Templates` or its subfolders, then choose one on the hazard. Save creates an independent hidden Actor/token with the hazard name, native stats, equipment and weapons. A trigger Region is not required for Actor creation. Repeated saves preserve damage. Changing templates replaces the instance only after saving succeeds; templates are never deleted or damaged by hazard cleanup. The HP field is removed. Attack effects automatically use this Actor and offer only its weapons. Presets retain the Actor template reference. Default hazard Actor supplies the equipped pistol; activation still requires a drawn Region and complete effects.

## Status effect picker

Apply Status Effects opens Combat Tools' categorized picker through its public statusPicker API v1. Active Combat Tools and that API are required; no private-file import or substitute picker is used. The picker receives supported native IDs, and Cancel preserves the choice. Selecting edits only the draft; normal effect resolution and GM confirmation remain required.

Delete Hazard in the Save box asks for confirmation before removing the hazard record, its NetArch AP, trigger Region, hazard token and owned Actor. Actor templates and target-only Regions remain. Shared trigger Regions are identified in the confirmation. If a native deletion is cancelled, the hazard remains disarmed and deletion can be retried.

- Trigger Regions start with no shapes; draw the area using native Foundry Region controls. Deleting a scene hazard's trigger Region preserves its record, Actor and AP and makes it inactive with a missing-Region warning. Save Hazard to create a blank replacement; repeated saves reuse it and preserve Actor HP. Region edits refresh the editor warning. Local checks only; live verification pending.

- Hazard readiness: required fields have an asterisk, missing values use yellow outlines, and Controls lists specific missing requirements. Effect rows identify incomplete effects. Activated replaces Armed; Trigger now replaces Activate Now. Incomplete hazards save inactive; Activated and Trigger now are disabled until requirements are complete. Runtime also rejects incomplete/inactive manual triggers. Zero-valued optional perception/counter/avoidance checks remain optional. Local automated validation only; live verification pending.

The four trigger choices use a 2�2 grid. Save automatically creates an owned native hazard Actor; there is no Actor template dropdown. Token icon shows the current artwork and opens the native image picker. The default is `modules/pneuma-scenetools/assets/hazard-sign.svg`. Save applies icon changes to the hazard token and owned Actor while retaining HP/equipment. World presets and imported/exported preset files retain the chosen token icon.

- A hazard Actor reaching 0 HP (or below) persistently clears Activated. Native Actor updates and unlinked token delta updates are supported; startup checks handle already destroyed bodies. Only the authoritative GM writes deactivation. Healing does not reactivate; the GM must activate it again. The hazard, Actor and AP are retained. Pending trigger cards reject destroyed hazards. Local regression checks; live Foundry verification pending.

- Trigger Region binding is fixed after creation. The trigger selector and its helper text are removed; saved configurations cannot rebind a hazard to a different Region. Native shape/elevation edits remain available. Save reports a missing trigger; delete and recreate the affected hazard. Target Region selection remains available. Local checks only; live verification pending.

- Hazard Actor turn trigger always uses the hazard's innate body Actor/token. The separate turn Actor selector is removed, another drone's turn cannot trigger this hazard. Native Region membership remains required for targets. Local verification only; live retest pending.

- Hazard layout: full-width Hazard box at top, with identity/description beside the checks and token icon. Middle row has three panes: Triggers, Targets/Area and Effects. Effects uses a short scrolling list above the selected properties. Bottom remains Controls, Presets and Save/Delete. Window width stays 1040px. Local layout checks; live verification pending.

- Latest hazard layout: full-width Hazard at top. Middle combines Triggers and Targets/Area in one left box, with Effects on the right (scrolling effect list beside selected properties). Bottom remains Controls, Presets and Save/Delete. No tabs; all options remain visible. Local layout checks; live Foundry verification pending.

- Alternate target Regions are removed. Targets now offers only All Actors in Region or Only triggering Actor, using the hazard's fixed trigger Region. Alternate-area fields are not supported. Use Trigger another Hazard to affect another area, with that hazard's own activation and GM confirmation. Local verification only; live retest pending.

- Trigger options now form one horizontal row. Move within Region always displays its movement-distance number input directly to the right, even while unchecked. Distance uses scene units; zero means any movement. Local layout/persistence checks only; live verification pending.

- Hazard header has three columns: Name/Description; vertically stacked Perception DV, Elect/Sec Counter DV and Counter Time; Hazard Actor Token artwork/Choose icon plus NetArch AP/Create and current-token artwork preview. Effect Edit/Remove actions use labeled icons; Save/Delete use standard native buttons with save/trash icons. Local UI validation; live Foundry verification pending.

- Trigger checkbox orientation corrected to vertical. The movement-distance field remains always visible directly to the right of Move within Region. Local layout verification; live Foundry verification pending.

Hazard effect picker correction (2026-10-13, local/unreleased): removed the CT-styled native fallback. Effect selection requires active Combat Tools and opens its actual categorized picker. This supersedes the fallback behavior documented above. Live verification pending.

Hazards dependency (2026-10-13, local/unreleased): all Hazards functionality requires active Pneuma Combat Tools. Without it, the Hazards control explains the requirement, editor/API access and manual resolution are blocked, saved hazard chat-card buttons are disabled, and automatic triggers do not run. Existing hazard data is retained. Other Scene Tools features remain independent. Combat Tools will own shared attack, damage, effect and resolution-card workflows; further integration remains future work. Live Foundry verification pending.

Hazards summary layout (2026-10-13, local/unreleased): middle row is Triggers → Targets → Effects. Triggers uses a read-only configuration summary and Edit triggers popup. Targets remains directly editable. Effects uses Type/Details/Avoid summary columns with Add Effect, Edit, Delete and Move up controls; effect properties are edited only in a separate popup using the actual CT status picker. Popup Save updates the hazard draft; Cancel or window close discards popup changes, and Save Hazard persists the draft. This supersedes the inline effect editor. Live Foundry verification pending.

- Hazards opens as a compact 320px control panel. The selected scene hazard has attached Activated, Trigger now, Reveal/Hide, Open Actor and Edit controls. Activated saves immediately; gameplay controls use saved configuration independently of unsaved editor changes. Edit expands to the existing 1040px editor; closing it preserves the draft. Add hazard expands the editor directly. Presets and Save/Delete remain in the expanded editor. Local checks only; live verification pending.

- Hazard Reveal/Hide preserves the map view. A scoped libWrapper integration suppresses native v12 automatic pan during marked hazard visibility updates; explicit Locate and ordinary token control retain normal behavior. Local regressions cover native auto-control and failure cleanup. Live verification pending.

- Presets uses a compact yellow bar above the expanded editor: Presets label, dropdown, Load Preset and Save as preset on one line. Additional preset label/help text is removed. Save/Delete remain below the editor. Local layout verification; live Foundry verification pending.

- Expanded hazard editor: the blue Hazard box spans to the bottom of the window beside the progression and footer. Draft requirements occupies its own box immediately left of Save/Delete. Requirements and progression scroll when needed within the viewport-sized editor. Compact control-panel behavior is preserved. Local layout verification; live retest pending.

- Hazard cards no longer show a requirements list beneath their action buttons. The larger warning symbol sits at the right of the card heading, retains a tooltip explaining missing requirements, and detailed draft requirements remain in the expanded editor. Local layout checks; live verification pending.

- Locate on map is attached to each hazard card instead of the sidebar bottom. It locates that card's trigger Region without switching the selected hazard or discarding its draft. Missing/undrawn Regions disable the button. Local checks; live verification pending.

- Locate placement correction: a small crosshairs icon sits immediately beside Reveal/Hide in the selected hazard card action row. The separate labeled Locate button is removed. Local UI verification; live retest pending.

- Hazard Actor Token again includes an optional native mook/character template dropdown from SceneTools/Hazard Actor Templates, including child folders. Selecting a template updates the icon preview; Save creates/replaces the owned Actor using its native stats/equipment. Templates and chosen icons persist in presets. The preview is 64px with a thin outline. Local checks; live verification pending.

- Triggers and Targets stage headers occupy a narrow left column; all their summaries, incoming links, edit button and target choice sit to the right. Effects retains its existing header/table layout. Local layout checks; live verification pending.

- Expanded editor height fits its contents rather than reserving 820px, growing as content requires up to the viewport limit. The blue Hazard pane still aligns with the footer. Targets shows only its dropdown beside the stage header; the duplicate field label is removed and its accessible name retained. Local layout checks; live verification pending.

- Edit triggers sits directly below the Triggers stage header in the left header column. Down arrows are vertically centered in the gaps between stages. Stage data and Effects retain their placement. Local UI verification; live retest pending.

- Compact hazard gameplay panel uses Foundry-style dark translucent chrome, light text, subtle card borders and native-color hover accents. Transparency affects the background, preserving text/control readability. Expanded editor keeps its existing styling. Local layout checks; live theme verification pending.

- Incoming hazard links appear as read-only trigger bullets: Other hazard: <name>. Activated By and its empty None section are removed from both the summary and trigger popup. No incoming-link UI appears when none exist. Local UI verification; live retest pending.

- Targets dropdown is left-aligned with the Triggers information column, overriding native form-field growth that pushed it right. Local layout checks; live verification pending.

- Locate fix: the card crosshairs button locates/selects the physical hazard Actor, including hidden/destroyed Actors and hazards with blank or deleted trigger Regions. It falls back to a drawn trigger Region if the Actor is absent. Wrong-scene or missing-location cases report an explicit error. Reveal remains independent and does not pan. Local regression checks; live retest pending.

- Activated uses a power-icon toggle in the hazard action row, with aria-pressed and a green active state; text status remains on the card. On this scene sits beside the Hazards heading. The left control panel retains its translucent dark styling while the expanded editor uses a light surface. Activation still persists immediately and incomplete hazards cannot be activated. Local UI verification; live theme retest pending.

- Hazard card sizing remains fixed when opening/closing the editor: 280px sidebar, fixed heading and action-row heights. Edit/Close editor is right-justified in the action row. Long names truncate instead of resizing the card heading. Local layout checks; live theme verification pending.

- Collapsing the editor fits the window to the fixed card column plus its actual Foundry padding/borders, rather than reserving a hard-coded 320px width. Fitting runs after render, avoiding a leftover strip on the right. Card dimensions and normal window gutters remain unchanged. Local regression check; live theme verification pending.

- Scene hazard cards use their native trigger Region color for borders, translucent backgrounds and selected control-row tint. Changing the Region color updates the open panel automatically; missing Regions keep the neutral style. Card dimensions, light text and yellow warnings remain intact. Local UI checks; live theme verification pending.

- A second card action row separates Actor visibility, Region visibility for the GM and Region visibility for players, with Locate beside the Actor control. Region Hide uses Only on Regions Layer; GM Show uses Always for Gamemaster; player Show uses Always for Everyone, and hiding from players returns to GM-only visibility. Visibility leaves activation unchanged, and Save preserves Region visibility. Local regression checks; live retest pending.

When the weapon allowance is already spent, the activation records Weapon attack skipped and advances normally. This expected limit does not require review or prevent a new next-round trigger. Any remaining nonweapon effects still require their normal GM resolution.

Deactivating a hazard stops new automatic, linked and manual triggers. Existing activation cards may still be confirmed, and their effect cards may still apply damage/effects while Activated is off. Dismiss or end the source activation to cancel its outstanding effect. Deactivation is separate from deletion, destruction or invalid configuration, which retain their existing checks.

Hazard records use `flags.pneuma-scenetools.hazards.<id>` on the Scene. Regions contain no hazard configuration. Region deletion leaves the Scene record and its Actor available for repair on Save.
