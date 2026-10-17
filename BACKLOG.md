# Master roadmap

- Addressed modular picker loading overhead: removed per-file full-window rebuilds, deferred media sources until dimension checks complete, and retained dimension metadata across reopenings. Browser regression measures render requests for a 35-image collection and verifies a warm reopen has no dimension probes. Live high-resolution asset timing still requires user retest.

- Added the requested large-scene performance warning to the modular scene creation prompt.

- Modular tile thumbnails and video previews disable Picture-in-Picture and do not receive pointer events, preventing browser video controls from interfering with tile selection. Hover preview and placement remain on the thumbnail buttons.

- Place Tile only reads the selected scene and no longer builds a world scene list for the hidden setup dropdown. The separate setup screen still lists valid modular scenes.

- Fixed Place Tile failing when another world scene has invalid modular metadata. Exclude invalid entries from the picker scene list while preserving strict validation of the current edited scene. Local browser regression; live retest pending.

- Quick Scene Importer labels distance per square as Scale; distance values and saving behavior are unchanged.

- Hazard effect editor now ensures the selected Actor is saved/spawned before opening, so new hazards can choose weapons immediately. Reuse existing matching Actors and synchronize changed templates. Local tests only; live retest pending.

- Fixed POI double-click creating a new pin: creation checks existing pin bounds and GM double-click edits the existing Note. Preserve native player/disabled-scene behavior. Local browser validation; live retest pending.

- Fixed stale Hover Fields in open POI/template settings by listening to native JournalEntryPage updates. Preserve checked/unchecked choices, remove deleted headings, resize after refresh, and unregister closed editors. Local browser verification; live retest pending.

- POI picker half-height list corrected: native empty button row no longer reserves half of the window. Browser fixture includes the native child-flex rule and checks list bottom and resize growth.

- Removed the starter template empty Image placeholder; image synchronization appends the actual image section at the bottom. Existing templates/pages require manual removal of an unwanted empty heading.

- POI editor cleanup: removed Image checkbox and nested Hover Fields border; resize the window as the appearance preview grows and retain a visible footer. Local verification only; live retest pending.

- POI picker improved with taller viewport-aware sizing, icon/category search and no-results feedback. Current icon contrast follows the theme; tinted appearance preview gains a contrasting outline. Local browser verification; live retest pending.

- Hazard card presentation and Add effects workflow use shared Combat Tools/Visual Tools behavior. Damage applies before resistance/application for effects attached through CT Add effects. Explicit hazard damage-avoidance checks still run before their own damage. Live retest pending.

- Restored the built-in Default hazard Actor option alongside saved templates. It remains available when the template folder is empty and includes the native Handgun skill fix. This supersedes the template-only dropdown decision.

- Corrected missing Handgun skill in generated default hazard Actors. Existing affected Actors and templates need Handgun added manually; new defaults include it. Native source confirms the missing-skill name dereference; live activation retest pending.

- Hazard editor now lists saved Actor templates only, with an explanatory empty-list option instead of the synthetic default Actor choice. Startup still provisions the default template.

- Default Hazard Actor now pre-populates Hazard Actor Templates on active-GM startup, with the existing loaded pistol and hazard artwork. Preserve user edits across reloads. Live world verification pending.

- Importer review layout simplified: grouped settings, wider scene naming, notes beneath the preview, clear scene-content counts, and expandable import details. Build/browser checks only; live review pending.

- Simplified the Quick Scene Importer introduction to explain map selection and automatic discovery without filename-matching jargon.

- Modular creation prompt layout refined: heading, map-pack recommendation section, aligned name field and separated action footer. Preserve native styling. Local browser validation; live retest pending.

- Thumbnail import warning corrected locally: native Scene updates transform/store thumbnail data and add a cache-busting timestamp. Verify saved source and native update acceptance rather than exact prepared-URL equality. Regressions cover cache-busting, overwriting an existing thumbnail file, no-op updates and cancelled saves. Live import retest pending.

- Modular scene creation introduction expanded with tile-sizing guidance and the user-provided Solution Maps Modular Pack link. Native naming/creation flow remains unchanged. Local browser verification; live retest pending.

- Scenes sidebar uses Import (file-import icon) and Modular (construction-worker icon) on the second row. The row copies native action-row classes and has no custom button styling, preserving native button size, margins, font, colors and borders.

- Scenes sidebar action layout: shared second row for Import and Modular, using file-import and construction-worker icons and full Scene Tools names on hover. Preserve the native creation row and search placement. Local browser verification; live retest pending.

- Default hazard equipment and artwork: warning-triangle toolbar, portrait and token; new Default hazard Actors carry an equipped Very Heavy Pistol loaded with 200 Basic rounds in a 200-round magazine. Native ammo installation, independent copies and preservation of spent ammo have local coverage. Existing Actors are not migrated. Live attack verification pending.

- Patrol controller/editor auto-grow with content: no internal scrollbars on token lists, history, waypoints or window content. Preserve the narrow controller width and mode-dependent sections. Local browser validation; live retest pending.

- Patrol editor places Mode above all mode-specific controls. Loop/Back & Forth show route pauses and side-track options; Random shows Region, distance preference and movement limit. Irrelevant groups are hidden while switching modes retains draft values. Shared speed and vehicle controls remain available.

- Patrol controller editor entry restored with a header pencil icon beside the scene Play/Pause icon. Individual patrol stop states remain unchanged by scene pause/resume. Local browser verification; live retest pending.

- Vehicle Patrol traffic wait implemented locally: stop for moving tokens for up to five seconds before rerouting, resume early if clear, and route around stationary tokens immediately. Uses native movement animations and Patrol movement reservations; coordinate updates cannot reset the deadline. Does not predict future manual moves or add traffic priority/deadlock handling. Live multiplayer retest pending.

- Patrol editor removes the current-status line beneath Token and timestamps from Recent operations. History remains an eight-entry, automatically refreshed message list.

- Patrol editor cleanup: remove help paragraphs, align controls, move Side tracks/deviation below Mode, and show disabled Artwork front for non-vehicles. Preserve disabled state after actions and retain its saved value. Local browser verification; live retest pending.

- Access Point Types layout corrected locally: override native full-height notes flex sizing within this column form so the rows and Add/Save controls remain visible. Regression fixture reproduces the native v12 form rule; live confirmation pending.

- Vehicle Patrol timing corrected locally: zero-duration waypoint transitions no longer consume an idle tick. Animation deadlines and movement reservations account for native animation time already elapsed while a document update resolves. Loop, Back & Forth, active/completed animations and coincident-stop regressions pass locally; live Foundry retest pending.

- Pre-release cleanup: removed the older Combat Tools picker import, AP template update/restore paths, hazard reference backfills and orphan adoption, startup/reconnect vehicle-seat recovery sweeps, no-GM seating and vehicle footprint guessing. New vehicles save their artwork footprint when spawned. Thumbnail creation makes one attempt. Current save rollback, permission checks, Undo, native defaults and patrol obstacle routing remain supported. No existing world data is migrated or purged.

- Storage ownership: all hazard configuration and saved state now live only in Scene flags `flags.pneuma-scenetools.hazards.<id>`. Regions provide native shapes, elevation, visibility and behavior, native Region controls create/reuse the linked Scene record. Hazard UUIDs use SceneToolsHazard IDs. Vehicle boarding/exiting requests and acknowledgements use transient module socket messages with bounded duplicate tracking, timeouts, GM handoff/disconnect handling, and queued permission/capacity checks. Requesting owners perform the native writes after a GM grant; socket-supplied identities never authorize GM document writes. Only resulting seat assignments and layouts are persisted. GM layout editing remains local; boarding and exiting require an active GM. Local verification is separate from live Foundry/multiplayer verification.

- Scene Tools data compatibility cleanup (unreleased): removed legacy folder flags/name aliases and folder renames, Drawing-to-Region hazard migration and backup flags, old Scanner settings, Mook template version upgrades, container-vehicle conversion and template equipment/artwork upgrades, POI template/image backfills and comma-separated hover selections, and hazard link-list/single-trigger/combined-effect editor conversions and retired patrol cards. Current documents/settings remain the only supported formats. Existing world records are not rewritten or purged on startup. Native Foundry Scene import remains supported.

## Patrol - implemented locally; live verification pending

- Scene controller implemented: semi-transparent list of configured token patrols with Start/Stop/Edit, configuration entry point, and persistent scene pause/resume preserving individually stopped patrols. Toolbar renamed Scene Tools - Patrol; Access Points toolbar renamed Scene Tools - Access Points.

- Vehicle wall-edge tolerance implemented: up to a quarter grid square per side, while full token/vehicle collision and boundary checks remain. Supersedes full-footprint wall clearance for vehicle Patrol only. Live narrow-passage verification pending.

- Vehicle stationary-turn fallback implemented: supersedes the absolute no-in-place-turn rule when driving/reversing cannot progress. Checked 45-degree rotations must unlock onward travel and retain collision reservations.

- Artwork front calibration added for vehicles (Up/Right/Down/Left). Blocked destinations now allow safe partial approaches and retry the same destination; this supersedes waiting at the origin or rerolling solely because a destination became blocked. Partial approach endpoints are not waypoint arrivals.

- Vehicle Patrol implemented locally: eight headings, moving turns, forward/reverse maneuvers, conservative vehicle/body clearance, and shared in-flight movement reservations. Uses SceneTools vehicle provenance; square/gridless only. Manual movement collision enforcement and traffic deadlock resolution are outside this implementation. Live performance and multiplayer verification remain pending.

- Superseding controls: Loop, Back & Forth and Random. Route options now include waypoint pause range, path pause range/frequency and side-track distance. Random includes distance preference, maximum movement time and pause range. Movement speed applies to all. Per-stop waits and the separate Wandering route choice are replaced.

- Corrected false "Movement cancelled; retrying" during token animation: verify committed source coordinates and plan the next segment from those coordinates. Keep both committed/displayed footprints occupied for stopping checks. Local regressions reproduce the false warning and preserve detection of rejected moves; live retest pending.

- GM Token Controls > Patrol configures individual scene tokens. Ordered routes support Loop and Back & forth; Random within Region chooses random destinations and pauses; Wandering route follows stops in order with occasional small side detours and pauses only at the designated stops. This supersedes random ordering of designated stops.
- Region roaming retains its chosen destination across movement segments and unrelated token flag updates. Obstructions trigger checked adjacent routing toward that destination; only an occupied/unreachable destination is replaced. Foundry movement collision is checked before submitting updates. Longer random trips are preferred, with shorter fallbacks for small Regions. Local regression coverage; live retest pending.
- Bounded wall-aware routing respects the full token footprint, native Region boundaries/holes and elevation limits. Tokens may pass through one another, but destinations must be clear of all token footprints and other patrol reservations. Occupied destinations are reselected; an occupied pause is cancelled.
- Save stores a stopped configuration; Start saves and runs; Stop and Stop scene halt patrols. Stop positions are placed on the map, editable/reorderable, and stored per token without changing its Actor.
- Runtime is owned by the active GM on the currently viewed scene. Game pause and started scene combat suspend movement; it resumes when those conditions clear. No background-scene or GM-free execution. Manual moves invalidate the current path.
- Uses conservative two-dimensional movement-wall geometry: closed/locked doors block, open doors pass; directional walls block from both sides and wall-height extensions are not interpreted. Furniture needs walls to be an obstacle. Unreachable or full spaces wait instead of teleporting. Live Foundry v12/CPR and multiplayer validation pending. See [Patrol](docs/patrol.md).
- Patrol Region roaming refinement: prefer longer trips (four grid spaces or half the longest Region dimension), retaining short trips for small Regions; use up to one-second travel segments and 25 ms scheduling checks. Saved arrival pauses are preserved. Live animation verification remains pending.

- Hazard Triggers includes a read-only Activated by list derived from other scene hazards. Effects is one ordered, appendable list of direct effects and Trigger another hazard entries, with edit/remove/move-up controls. Each linked effect creates a separate GM confirmation when resolved; cyclic activation is suppressed. Presets clear scene-specific effect destinations.

- Access Point Types uses compact rows with shared column headings and current-icon previews. Previews update when typing an artwork path or selecting a file; unavailable artwork shows the generic icon.

- MookMaker always shows Display Name and Token Disposition controls and always purges unused ammunition with unused gear. Removed the two settings and their conditional behavior; the separate weapon-ammunition retention setting remains supported.

## Hazards and hazard actors - implemented locally, live verification pending

- Hazard status selection requires Combat Tools' public statusPicker API v1. Missing, inactive or unsupported APIs report an error; no private-file import or substitute picker is used. Supported native IDs and cancellation remain covered by local checks; selection does not apply effects or bypass GM confirmation.

- Innate hazard Actors: choose a native mook/character template from `SceneTools/HazardActor Templates` (including its subfolders). Save automatically creates an independent, hidden Actor/token copy with an automatically supplied trigger Region. HP, equipment and weapons come from the template; no HP field is exposed. Repeated saves preserve damage and the Actor identity. Changing templates replaces the owned Actor only after the new copy is successfully saved; rollback preserves the old Actor and all templates. Attack effects always use the hazard's innate Actor and only require a weapon choice. Presets retain the template reference and clear instance references. Empty drafts remain saveable but inactive until a template/Actor is available. Build/runtime/browser validation is local; live retest is pending.

- Hazard document controls: Save supplies one native GM-only blank trigger Region named `<hazard>-Tigger` for a new hazard. Later saves reuse its saved reference. Missing saved Regions or hazard Actors report an error; delete and recreate the affected hazard. Cancelled initial reference writes remove the newly created Region. Create NetArch AP remains explicit and requires an existing selected AP template.

- Hazard skill checks: Counter skill and Skill to avoid share the installed CPR system skill dropdown, with an adjacent DV field. Previously saved custom skills remain selectable.

- Hazard save verification accepts native no-diff updates returning no Document when stored values already match; cancelled writes with missing changes still fail. Regression fixtures model this native return behavior.

- Hazard saving: Armed and Activate Now appear in the bottom-left controls section; Save Hazard has a separate bottom-right box. Activate Now requests GM confirmation for the saved hazard against selected tokens, requires edits to be saved first, and does not save automatically. Save creates the scene hazard and its default trigger Region, including incomplete drafts; Add Hazard starts a new editor draft. Hazards use scene records independently of Regions; Save automatically creates or reuses a native GM-only trigger Region when no existing trigger is selected. Native Region controls create linked Scene hazard records. The native form hint flex-size override keeps the list visible. Import / Export beneath Add Hazard opens a compact preset-file panel. Hazard body creation verifies persisted HP, and rollback shares Actor cleanup to avoid duplicate deletion.

- Hazard editor styling: compact MookMaker blue/green/gold tinted boxes with accent borders, short numeric fields, tighter rows and no section/header divider lines.

- Current layout: scene hazard list at left. Top row: Hazard (name, description, perception DV, Hazard Actor template, counter DV/time and NetArch AP) beside Effects. Middle row: Triggers/Activated By beside Targets/Area. Fixed bottom row: red Controls (Armed, Activate Now, Reveal/Hide and Open Hazard Actor), Presets, and compact Save Hazard and Delete Hazard buttons. All boxes have headings and equal heights within their row. Counter checks always use Electronics/Security Tech; saved/imported configurations normalize that skill and no skill selector is shown. HP comes from the native Hazard Actor template; the HP input is removed. Build, runtime and browser checks pass; live verification remains pending.

- Hazard elevation is configured only in the native Region editor. Hazard saves and preset application preserve its bounds; camera detection reads those bounds directly.



- Terminology: Hazards and Hazard actor throughout controls, messages, defaults and documentation. Current storage identifiers, Region Behavior type and preset format use the Scene Tools namespace; no legacy label conversion runs.

- Fixed missing manifest declaration for the hazard Region Behavior subtype, which caused native document validation to reject creation. Regression checks cover source and built declarations; live retest requires the updated manifest and a Foundry restart.

- Approved scope: generic GM-authored hazards; hidden map areas; always GM-confirmed resolution; mobile Actor-backed drones/hazard actors; observation-camera links; ordinary Scanner access points with existing AP icon choices; attackable/destroyable hazard actors; world presets and file import/export. No official hazard stats/descriptions are shipped.
- Implemented: native Regions, Region Behavior events and segmented movement, configurable timing/area/effect/check criteria, native body damage/status/weapon/door-closing/fall actions, effect lifetime cleanup, camera-linked activation, persistent confirmation/review cards, repeating hazard actor turn proposals, Scanner markers and portable presets with native hazard actor snapshots. Full behavior and implementation boundaries: [docs/hazards.md](docs/traps.md).
- Superseding decisions: no fully automatic resolution option; no compendium preset storage. Drones are included as mobile native Actors with equipment, sensors and native token movement; not deferred as a separate feature area.
- Backlog: item-based trigger exemptions/credentials. Until then, the GM dismisses exemptions or stops tracking a target on its confirmation card.
- Remaining validation: live Foundry v12/CPR and multiplayer testing, including damage, ActorDelta hazard actor stats, native effect hooks, camera illumination and Scanner hazard actor discovery. Discovery/disarm timing and equipment-specific exceptions are GM adjudication; autonomous pathfinding/pursuit is not implemented.

## Training group - dropped

- Dropped at user request on 2026-10-16. No training workflow implemented or planned.
- Superseded concept: enter a Region to visit a training scene with an unlinked character token, experiment without changing the normal Actor, and enter an exit Region to return. The alternative of teleporting, unlinking and renaming the existing token was also rejected.

## City-map pins

- Pin manager/defaults separation: implemented locally. The main Scene Tools window focuses on all scene pins; Map POI Defaults opens a shared defaults screen also exposed in module settings under Map POI. Defaults do not require an active or enabled scene.

- Icon visual direction supersedes the hand-drawn sets: conventional filled wayfinding symbols with natural proportions, selected consistently from Material Design Icons. All 61 names/categories and tintable asset paths are preserved.

- Native pin editor tabs and manager/defaults UI: implemented locally. The toolbar button now opens **Scene Tools Map POI** with all scene pins and defaults; every native pin editor on enabled scenes has Basic and Scene Tools tabs. This supersedes the standalone appearance editor and selectable toolbar placement tool. Click-to-place remains available through the manager's **Place pin on map** action, with clicked coordinates, saved defaults, and Escape cancellation.

- 61 custom tintable Cyberpunk city-location SVGs: implemented locally, unreleased.
- Opt-in per-scene Map Pinning UI with searchable categories and icon selection, appearance editing, native note configuration, and journal management: implemented locally. Global icon registration is superseded and removed.
- GM-selected journal templates, default Image/Description/Factions structure, independent view-only player copies under SceneTools / Scene Name, and configurable hover page/section mappings: implemented locally.
- Optional linked journal-page hover content with journal/page permissions and unrevealed-secret filtering: implemented locally. Existing native notes and journal/page links remain in use.
- Crafted hover layout and heading checklist: implemented locally. Image at top left, selected non-Description sections as fields at top right, full Description section below. This supersedes free-text heading selection and clipped journal previews; long cards support scrolling.
- Live Foundry and multiplayer verification pending; automated data and browser fixtures do not establish live verification.

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

## Quick Scene Importer — implemented locally; live verification pending

- Map-folder browsing: implemented inside step 1 with the actual native FilePicker template, navigation listeners, source tabs and favorites; the initial picker and separate scan-progress dialog are removed.
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

- Consolidate folder lookup/creation and preserve renamed folders carrying current SceneToolsFolder identities.
- Centralize compatibility checks and reduce the public API to the actual tools.
- Restore native Foundry typing and explicitly type Scanner data.
- Replace repeated dialogs with one native batch-review form, shared settings and per-scene overrides.
- Scan Scene JSON in the selected folder tree and keep manual file-picker overrides.
- Require saved-document confirmation; retain form values and skip saved entries on retry.
- Run the shared browser contract suites in CI. Live persistence verification remains pending.

## Limits and deferred work

- Import/override execution (0.2.4): native import receives original JSON; overrides execute afterward using native Scene/embedded-document updates. Supersedes modifying the JSON import payload itself.
- Scene import wizard: three steps (embedded folder browser, map selection, scene review), inline scan progress/cancel, aligned selection dropdowns and compact File buttons; Back navigation; editable review with a left scene list, right preview/fields, and shared settings above. Shared settings disable individual lighting/vision controls for all Scenes; individual values return when unchecked. Implemented with browser-fixture coverage; live Foundry verification pending.
- JSON-first workflow (0.2.3): native import/migration, reusable per-map JSON assignment, complete payload preservation, and preview of imported settings/geometry implemented. Supersedes custom field stripping and JSON-centered selection rows. Live-world verification remains pending.
- Form refinement (0.2.2): generated HTML, field-name rewriting, and stored builder closures removed. Native template rendering and partial-batch retry regressions pass; matching behavior retained.
- Submission correction (0.2.1): final field names, direct form reads, root-form selection setup, and pre-save numeric validation implemented. Native serializer and browser regressions pass; live-world confirmation remains pending.
- Live Foundry v12 verification and representative real map-pack imports remain pending.
- Archive/compendium extraction, UVTT embedded-image extraction, and visual grid-line detection are not implemented.
- Hex alignment uses native Scene configuration; the creator previews square grids.


- City icon menus use expandable category folders, following the Combat Tools status-menu layout. Each expanded category shows compact icons with names; the selected category starts open. Picker artwork is white on a dark background; saved pin tint is unchanged. This replaces the category dropdown and search grid in creation, defaults, and native pin settings.

- New native pins inherit visual defaults on enabled scenes. Default icon selection is removed; icon artwork remains a per-pin choice. Implemented locally.

- Fixed the Map POI editor freeze caused by cloning native Foundry color-picker elements: their value setters emit input/change events, recursively feeding the appearance synchronization. The appearance panel now uses plain mirror inputs, suppresses unchanged writes, and avoids duplicate custom-input events. A bounded native-setter regression reproduces the old loop and checks edits/default application.

## Mook and Vehicle artwork spawning - implemented locally

- Shared Token Artwork Categories settings menu maps separate Mook/Vehicle category names to Foundry data folders with native folder pickers.
- Dropping unlinked templates prompts for a category when categories exist for that kind. Cancel creates nothing. Empty/inaccessible artwork folders report errors without creating partial tokens.
- Foundry wildcard browsing resolves folder artwork; the selected concrete image is written to the token texture and its synthetic Actor portrait in the same creation. World template artwork stays unchanged. With no categories, existing prototype artwork/random selection remains in use and the portrait is synchronized.
- SceneTools / Vehicle Templates contains a native CPR container Actor with a Vehicle Item. Customize its native vehicle fields and duplicate it within that folder for additional templates; no vehicle stats are invented.
- Copied, already spawned tokens retain their chosen art. Linked actors and unrelated templates are unaffected.
- Local automated validation only; live Foundry drop, portrait, and multiplayer verification remains pending.

## Vehicle rotation - implemented locally; live verification pending

- Applies only to scene tokens stamped as spawned from SceneTools / Vehicle Templates. Actor type/name/current folder alone does not enable it.
- Native rotation-only updates preserve an adjustable rear-axle pivot; vehicle HUD provides 15-degree turns, Shift for 5 degrees, and a pivot editor with an on-map marker.
- Default pivot: 50% across, 75% down the unrotated token footprint; center rotation is available at 50% / 50%. Coordinates include transparent artwork padding.
- Artwork sizing and texture scale are preserved. The earlier fixed-footprint behavior is superseded by the cardinal footprint updates described below. New default templates use 2 by 3 squares.
- Sequential HUD turns, ownership/lock/pause checks, native player center-point wall checks, and marker cleanup on close/deletion/scene teardown. Explicit position updates and Undo are not re-pivoted.
- This is token rotation, not vehicle driving physics or full-body collision. Native selection bounds remain axis-aligned and now swap dimensions at cardinal cutoffs. Seats/passengers are implemented below. See docs/vehicle-rotation.md.

## Vehicle footprint rotation - implemented locally; live verification pending

- Only tokens spawned from SceneTools / Vehicle Templates. On square/gridless maps, width/height swap at 45, 135, 225, and 315 degrees; slight turns keep the same footprint. Hex footprints remain unchanged.
- Artwork is fitted against persisted original dimensions through the native mesh resize helper, independent of the rotated footprint. Texture scale, mirroring, padding, and image aspect ratio remain native; no repeated scaling adjustments accumulate.
- Axle pivot and artwork center remain consistent when the footprint ticks. Saved dimensions survive reload/copy; intentional resizing establishes a new reference. Explicit positions and Undo remain authoritative.
- Added cutoff, repeated-rotation, mirrored/padded-artwork, persistence, resize, Undo, and rendered footprint regressions. Live Foundry/multiplayer verification remains pending.

## Stationary square-grid vehicle footprints - supersedes square-grid axle movement

- Confirmed sequence for a 2 by 3 vehicle: 0/15/30 degrees retains 2 by 3; 45 degrees uses 3 by 3; 60/75/90 degrees uses 3 by 2. Repeats through all orientations. Fine-turn diagonal bands are centered on 45/135/225/315, with 7.5 degrees to either side.
- Rotation keeps the same snapped top-left grid corner. It no longer continuously translates square-grid tokens around an axle. Previously off-grid tokens snap once on the next turn. Explicit movement updates and Undo retain their supplied positions.
- Original artwork sizing is unchanged. Gridless/hex retain prior pivot behavior; the pivot editor is only shown where axle rotation applies.
- Local build, 139 automated tests, and targeted browser regression validate the correction; live Foundry verification of this correction remains pending.

## Vehicle seats (local implementation; live Foundry verification pending)

- Vehicle HUD chair opens seat management. GM Define seats supports click placement, naming, moving and removing markers on the original image. Optional template defaults are saved separately for each artwork image. Native Vehicle Item capacity is honored when greater than zero.
- Character HUD chair opens vehicle/seat selection or exits an occupied seat. An active GM serializes assignments and checks ownership, availability, and pause state.
- Passengers retain their existing tokens and actors; artwork displays at 60% of its original scale above the vehicle. Image-relative positions follow movement, actual rotation and changing grid footprints. Occupants retain their original orientation, including during animation; their artwork does not turn with the vehicle. Exit restores scale, facing, elevation and sort order at a clear adjacent position.
- Deleting a vehicle restores its seated riders; explicit Exit also restores a rider whose vehicle is missing. Startup and reconnect do not scan for orphaned assignments. One failed rider update does not prevent others from following. Copied passenger tokens are detached and restored.
- No automatic driving permission or shared vision is granted. Selection footprints retain the character token dimensions. Multiplayer and native animation require live Foundry testing.

### Reusable vehicle template seats

- Define seats can save a standard layout on the source Actor prototype for all artwork, or an artwork-specific layout. Newly spawned vehicles inherit these defaults; existing scene tokens retain their layouts. Local layouts take priority, followed by artwork-specific template layouts and then the standard template layout.
- Seat positions are proportional to the image. Use similarly framed artwork for a common standard; different framing can use an image-specific override.

### Vehicle HUD and exits update

- Removed rotation/pivot HUD buttons. Vehicle seats and character enter/exit now occupy the former rotation row below the middle HUD column. Native token rotation remains available.
- Exits rank all perimeter grid positions by distance to the rotated seat and choose the nearest wall-clear position.

### Ownership-based vehicle use

- Boarding requires ownership of both passenger and vehicle. A GM-only Allow players to use HUD control grants OWNER to all players on the unlinked vehicle synthetic Actor, preserving the template.
- An active GM coordinates when available. Without a GM, owners board/exit directly and an elected active owner persists each passenger movement; players cannot update characters they do not own. Simultaneous seat conflicts converge by token ID, with the other rider exiting. Offline passengers resync when an authorized owner or GM returns.
- Live multiplayer validation remains pending. This supersedes the earlier active-GM requirement.

### Mook-based vehicle template

- The default Vehicle Template now uses the native CPR Mook Actor for normal HP, equipped armor and damage handling. HP is the combat durability field; the Vehicle Item remains for seats, speed and vehicle data.
- An existing default Container template receives a new Mook replacement, preserving prototype artwork, seat layouts, ownership and embedded Items. Existing SDP seeds HP when positive; otherwise existing Container HP is retained. Container armor becomes equipped body armor. The original remains a named backup; existing scene vehicles are not rebound.
- New blank templates use native Mook defaults; set vehicle HP and armor before spawning. This does not implement vehicle-specific injury rules or automatic SDP/HP synchronization. Live Foundry verification is pending.

### Vehicle seat movement accounting fix

- Seat placement updates do not spend walking MOVE or optional AoE movement. They preserve existing expenditure and rebase the reset origin; seated characters cannot reset out of a vehicle.
- Seat positions persist as integer pixels, compare against committed source coordinates, and do not recursively synchronize from internal seat writes. Rendering retains the precise seat position. Live combat verification remains pending.

### Targeted seat synchronization

- Document seat synchronization runs only for geometry, artwork transforms and seat-layout/assignment changes; unrelated HP, movement counters and appearance metadata do not trigger scans. Internal position writes do not requeue synchronization. Removed a duplicate vehicle sync handler and restored deletion cleanup.
- Visual alignment uses the native Token render-flag method, skips bars/effects/target/nameplate-only refreshes, and refreshes only the affected passenger when a passenger refreshes. User connection and role changes do not run seat recovery sweeps.

### Armored Chassis

- Active GM startup provisions Armored Chassis (armor), a native body armor Item with SP 13, zero initial ablation and zero penalty, in the world Items SceneTools root.
- Default vehicle templates receive an equipped copy, including existing Mook/character templates. Identity flags prevent duplicate creation; subsequent user edits are preserved. Existing placed vehicles are not modified.

### Vehicle configuration HUD

- Vehicle templates represent car types; vehicle drops use template artwork without the former category prompt. Mook drops retain their category prompt.
- Bottom vehicle HUD order: Configure (car/gear), Enter/Exit (bucket-seat outline), Allow Players (GM only). Configure exposes vehicle-only artwork categories, current/max HP, current/max chassis body SP, actor MOVE, player access and seat definition.
- Changes apply to the placed unlinked Actor; armor ablation represents the difference between current/max SP. A category change randomly selects artwork and copies it to the synthetic Actor portrait. Occupants must exit before changing artwork.
- Template stat and world armor edits remain separate from placed vehicle edits. No vehicle stats are inferred from artwork. Local automated verification does not establish live Foundry behavior.

- Configure includes Seats, stored on the native Vehicle Item. Enter/Exit displays occupancy/capacity and missing seat positions. Boarding is limited to the first N layout markers; reducing capacity requires occupants of removed seats to exit first. Zero capacity permits no boarding.

### Artwork category geometry and CTH placement

- Vehicle artwork categories store folder, unrotated footprint width/height in grid squares, artwork scale and numbered visual seat positions. The seat editor uses a sample from the folder; Save categories persists the draft. Vehicle capacity remains on the car-type template; excess markers are unused and insufficient positions block category application.
- Selecting a category applies footprint, scale, actual image dimensions and seat layout together; token and synthetic portrait use the chosen image. Existing categories remain readable.
- Configure is GM-only and Enter/Exit is available to all users in the CombatTools CTH; actual boarding still checks ownership. Removed bottom-token controls and standalone Allow Players; access grants remain inside Configure. Requires the updated CombatTools CTH render integration.

### Artwork category manager layout

- Replaced the wide editable table with a bounded searchable list, kind filter and single selected-category editor. List and editor scroll independently; footprint dimensions and folder browse remain inline. Draft edits and seat positions persist across category changes until Save categories. Tested with 48 entries.

- CTH vehicle controls also mount through native HUD rendering, observing asynchronous CTH insertion when the installed CombatTools lacks the new integration event. Observation stops once mounted, on HUD replacement/close, or canvas teardown. No polling and no controls beneath the token.

### Independent vehicle HUD menu (supersedes CTH placement)

- Configure (GM only) and Enter/Exit now use their own native-styled vertical column immediately to the left of the native Token HUD. Player access remains inside Configure.
- Works without CombatTools. CTH retains its existing position on the right. No asynchronous CTH hook or DOM observation is required.
- Local browser fixture checks standalone rendering, GM/player visibility, duplicate renders, configuration actions and column placement. Live Foundry verification remains pending.


### Vehicle HUD context correction

- Enter/Exit appears on a vehicle HUD only with an owned character selected. An unseated character has no vehicle menu on their own HUD; a seated character has Exit vehicle. GM Configure remains available on vehicle HUDs.
- The extra vehicle menu no longer uses native column classes, preventing integrations targeting `.col.left` from inserting duplicate controls such as D/V.

- Implemented locally: compact artwork category editor with search/kind filter above the list, name/kind inline, scale slider plus numeric input, Mook/Vehicle sample previews, and inline vehicle seat editing. Build/browser validation passed; live Foundry verification pending.

- Implemented locally: Scene Tools Enter/Exit on unselected vehicle standalone HUDs while a character remains selected; local browser validation, live Foundry verification pending.

- Implemented locally: separate Mook Artwork and Vehicle Artwork configuration dialogs with shared styling and no Kind selectors; preserves existing category data. Supersedes the combined artwork configuration menu. Live Foundry verification pending.

- Implemented locally: image previews inside the Mook/Vehicle artwork folder browser while retaining folder-only selection. Live Foundry verification pending.

- Implemented locally for trial: compact Mook Maker with category radios and exact artwork preview. Pre-trial affected files saved under .rollback/scenetools-mook-compact-20261012; layout and mechanics browser checks passed. Live Foundry verification pending.

- Compact Mook Maker refinement: category pick-list and specific image selection, tighter fields, utility buttons under preview, original colors restored.

- Implemented: Mook Maker Manual artwork browsing, full-height category list, revised utility-button placement, and removal of Civilian Combat Number and its setting.

- Hazard deletion: the bottom-right Save box uses compact Save Hazard and Delete Hazard buttons. Delete requires confirmation and removes the saved hazard, linked NetArch AP, trigger Region, hazard token and owned Actor. Actor templates and target-only Regions are preserved. Shared trigger Regions are identified in confirmation. Cancelled native deletions retain a disarmed record for retry. Local automated verification; live Foundry verification pending.

- Trigger Regions start with no shapes; draw the area using native Foundry Region controls. Deleting a scene hazard's trigger Region preserves its record, Actor and AP and makes it inactive with a missing-Region warning. Save Hazard to create a blank replacement; repeated saves reuse it and preserve Actor HP. Region edits refresh the editor warning. Local checks only; live verification pending.

- Hazard readiness: required fields have an asterisk, missing values use yellow outlines, and Controls lists specific missing requirements. Effect rows identify incomplete effects. Activated replaces Armed; Trigger now replaces Activate Now. Incomplete hazards save inactive; Activated and Trigger now are disabled until requirements are complete. Runtime also rejects incomplete/inactive manual triggers. Zero-valued optional perception/counter/avoidance checks remain optional. Local automated validation only; live verification pending.

- Hazard editor width reduced from 1320px to 1040px, with a narrower scene list, effect list and footer columns. Existing two-column workflow, field sizes and fixed controls are retained. Local layout verification; live Foundry verification pending.

- Superseding hazard UI decision: 2�2 trigger choices; remove innate Actor template dropdown. Every hazard automatically gets a native Actor. Default hazard token icon is editable through the native image picker and persists in world/file presets. Existing Actors and their edited stats/equipment are preserved. Local checks pass; live retest pending.

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

Hazards Effects width (2026-10-13, implemented locally/unreleased): widen Effects beyond half of the shared row; now approximately 62% Effects and 38% Triggers/Targets.

Hazards summary layout (2026-10-13, local/unreleased): middle row is Triggers → Targets → Effects. Triggers uses a read-only configuration summary and Edit triggers popup. Targets remains directly editable. Effects uses Type/Details/Avoid summary columns with Add Effect, Edit, Delete and Move up controls; effect properties are edited only in a separate popup using the actual CT status picker. Popup Save updates the hazard draft; Cancel or window close discards popup changes, and Save Hazard persists the draft. This supersedes the inline effect editor. Live Foundry verification pending.

Hazard progression layout (2026-10-13, local/unreleased): Triggers, Targets and Effects now share one bordered box. Numbered headings and connecting arrows show their left-to-right progression; popup editing and summary columns remain unchanged.

Hazard visibility correction (2026-10-13, local/unreleased): Hide hazard always sets hidden=true and Reveal hazard always sets hidden=false, even if the displayed button is stale. Native token visibility updates refresh the button label while preserving unsaved form fields.

Hazards layout correction (2026-10-13, local/unreleased): Hazard details are on the left, with the shared Triggers → Targets → Effects box on the right. Within that box the progression runs top to bottom with downward arrows. Controls remain below both boxes. Supersedes the horizontal progression.

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

- Implemented locally: hazard functions call CombatTools for weapon attacks, native weapon AoE, grouped direct effect cards and condition-spawn results. User-confirmed limits apply only to native weapon attacks: one per combat round and one per activation outside combat. Other effects retain independent resolution and native cleanup. Live Foundry/multiplayer verification pending.

- Fixed locally: spent native weapon allowance skips the effect instead of leaving an unfinished Review activation that blocks subsequent rounds. Deactivation and outstanding effect-card behavior remain as accepted by the user. Live verification pending.

- Implemented clarification: Activated controls new triggers only; deactivating a hazard does not cancel existing activation/effect cards or prevent their damage application. Supersedes earlier direct-effect deactivation blocking. Live verification pending.

- Implemented locally: hazard skill/DV avoidance now uses player-owned CombatTools responses and automatic pass/fail resolution through sceneEffects API v2. Supersedes the GM resistance roll/pass/fail workflow; retains GM trigger confirmation, native weapon defenses, and confirmed condition spawning. Live multiplayer verification pending.

## Modular Scene Creator — implemented locally

- Automatic wall detection removed at user request (2026-10-16): pixel tracing produced impractical wall counts on the supplied artwork. A replacement approach requires a new plan; no automatic wall generation is currently included.


- Picker remembers the last collection, Static/Animated tab, and each collection/tab scroll position locally for the current world and user, including reopening and reloads. It stays open after placement; click a canvas space to change its target. Done Building saves the thumbnail and closes the picker.
- Once the first tile establishes dimensions, incompatible or unreadable tiles are hidden. Show incompatible tiles displays them disabled. Dimensions are checked with four concurrent loads and cached while the picker is open; Refresh retries.
- One-step Undo restores the latest successful placement/replacement, rotation, removal, expansion, or shrink, including deleted edge tiles and translated native contents. There is no redo or multi-step history. Cancelled/no-op actions retain the previous step; outside changes to scene geometry or native contents invalidate it. Undo is session-only.


- Scene creation is now a name-only prompt from the directory button, saved under `SceneTools/Modular Scenes`. The first tile sets the blank scene dimensions; the Tiles toolbar resumes editing. Supersedes reference-image setup for new scenes. Existing scenes/folders remain intact.
- Edge shrinking implemented: minus controls, occupied-edge tile deletion warning, minimum one-row/column limits, preserved remaining alignment, stale-confirmation rejection, and restoration after failed writes. Live retest pending.
- Named folder collections; blank scene creation sized from a reference tile; mixed-collection placement; live canvas placement/replacement/removal and 90-degree rotation controls; scene-edge row/column expansion arrows; saved scene reopening. Supersedes the miniature layout editor and automatic first-tile placement.
- Native theme controls and world-folder conventions preserved. See [usage and limitations](docs/modular-scenes.md).
- Remaining verification: live Foundry v12 creation, folder access, repeated expansion with native content, and multiplayer rendering.

- Patrol editor uses two columns: token, speed, pause controls, mode and detected vehicle/artwork front on the left; the last eight operations and a compact waypoint list with Place Waypoints on the right. History is temporary on the GM client that records it, refreshes while open, and clears on scene teardown. Existing independent pause ranges and automatic vehicle detection are preserved. Automated validation only; live Foundry verification pending.

- Patrol controller is 160 px wide by default, with tight spacing and a 22 px edit button. Long names/statuses truncate with full text on hover. Patrol names toggle individual Start/Stop, with status beneath the name and an adjacent pencil edit icon. The scene toggle uses the same semi-transparent button style; Configure patrol is removed. Scene pause continues to preserve individually stopped patrols.

- Vehicle Patrol permits moving 90-degree turns with an extra route cost equivalent to three grid spaces, favoring modestly longer routes with 45-degree turns. Intermediate body clearance is checked across the full turn. Stationary fallback still turns in 45-degree steps.

- Vehicle wall clearance now follows movement and rotation in swept intervals of at most 7.5 degrees, instead of applying the largest turning footprint to the entire move. Planning and the final movement guard use the same checks. Existing wall-edge tolerance, full-body token/Region/bounds checks and passage reservations remain enforced. Automated regression coverage includes turning away from a wall; the reported live scene still needs verification.

- Vehicle pathfinding rewrite: retained heading-aware A* with a priority queue replaces short searches that returned greedy partial approaches. Search slices target 8 ms / 256 states, one per tick with fair scheduling, and a 40,000-state total cap. Half-grid positioning and whole-grid moves share the same graph; reversing no longer has a three-step cap. Moving 45-degree turns are preferred over 90-degree turns; stationary turns have a high cost. Wall collision uses swept oriented chassis geometry with up to a quarter grid square of edge clipping per side and a nonzero core, independent of empty diagonal selection-box corners. Full native/body footprints still govern token, Region and scene-bound checks. The planner, final write guard, arrival-heading checks and swept movement reservations agree. Patrol supplies explicit center-preserving position/size/rotation updates, so manual vehicle rotation behavior is unchanged. Static geometry edits invalidate retained searches; dynamic movement is rechecked before each step. This supersedes earlier three-phase, whole-grid and whole-maneuver rectangle routing. Automated checks only; the reported live scene remains unverified.

- Vehicle Patrol retains planned routes during internal rider position synchronization, avoiding repeated planning pauses after turns. Boarding/exiting and manual movement still invalidate plans; live step collision checks remain active. Automated regression coverage only; live Foundry verification pending.

- Fixed hazard attack/effect navigation: explicit View in chat buttons replace ChatMessage sheet links and highlight the loaded card.

- Modular tile browser uses generated WebP still thumbnails with a maximum 160-pixel edge for images and videos. Two concurrent generators cache the thumbnails and original dimensions in this browser across reloads (session-only if browser cache storage is unavailable). Initial generation reads originals once; preview/placement retain original paths. Refresh regenerates the collection thumbnails. Failed thumbnails remain placeholders, without loading originals into the thumbnail grid. Browser fixture verification covers still/video generation, persistent reuse, refresh and placement; live Foundry performance remains unverified.
