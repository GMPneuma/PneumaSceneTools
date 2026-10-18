# Implemented features

- Name dialogs advise duplicating starter tables for personal name lists.

- Bundled Mook name RollTables use a custom name-badge/dice icon. Existing starter tables with the default icon receive it automatically; custom artwork is preserved.

- Artwork name overrides are separated by a horizontal rule, with an inline checkbox and left-aligned label and guidance.

- Name generator and name-table configuration dialogs use Mook Maker section styling, horizontal table choices, compact Generate controls, and a full-width editable name.

- Name generation uses three horizontal RollTable dropdowns, without prefix/suffix fields. Bundled first-name, last-name, and handle tables each contain five editable entries and are provisioned once under RollTables → SceneTools → Mook Names.

- Mook Name RollTables appears in the MookMaker settings section; shared HUD settings use the Scene Tools HUD heading.

- Mook Maker has ordered three-part RollTable names, per-artwork-category overrides, instant rerolls, and a manual dialog with three table choices, Generate, editable name, and Save. The left Mook section uses Name/generation/Promote, Role/Level, and Display Name/Disposition rows. Names remain drafts until Apply.

- Scene Tools HUD icon sizing now samples native icon buttons instead of larger numeric controls such as elevation.

- Scene Tools HUD settings cover shared controls; configured patrol tokens have GM-only Edit Patrol and Start/Stop Patrol controls in the left HUD, with the toggle refreshed when the saved patrol changes.

- Mook Maker uses the left Scene Tools HUD group and shared HUD colors. Purge Unequipped Gear is available from the token HUD and Promote dialog; unsaved mooks have visibly greyed-out purge controls.

- Square-to-square patrols offer a per-square pause in seconds with one decimal place; 0 disables it. The pause begins after the step animation finishes.

- Regular token patrols offer Square-to-square movement: full grid steps, a preference for horizontal/vertical routes, and exact 45-degree diagonals when needed. Available for routes and roaming on square grids; vehicle steering is unchanged. Destinations snap to the token's grid spacing, side tracks are disabled, and collision checks remain active.

- POI right-click menus dismiss the hover preview and suppress it until the menu closes.

- Hazard Actor displays the current actor and template names. Replace Hazard Actor opens a template picker; cancellation preserves the draft and selection is applied when saving the hazard.

- Modular Place Tile/Edit Tile selection highlights the full target cell with a contrasting outline and translucent fill. The highlight follows canvas pan/zoom and is removed when building ends or the scene closes. This is a local editing overlay; no scene documents are created.

- POI import confirmation displays the requested world-backup warning before importing.

- POI JSON section values are strings containing either plain text or HTML. Removed the separate HTML object format; export, import, and dialog guidance use the same string layout.

- POI manager now has one Import / Export button. Its dialog explains the custom SceneTools POI JSON format, editable named journal sections, rich formatting, image paths, and copy-on-import behavior before offering Import JSON and Export JSON.

- POI audit fixes: journal pages own managed images; relinking never copies an old pin image into the destination. Native image edits are awaited and custom images on ordinary Notes survive import. All heading levels and rich section bodies export separately. Import validates Note settings before writing, batches document creation with stable fresh-ID mapping and partial-failure cleanup, and indexes source pages. Template page choices are derived from current pages. Journal Pan button eligibility caches links with Note/Scene invalidation. Local regression and browser coverage added.

- POIs use journal/page player visibility only. Removed section hiding and old-template cleanup. JSON export handles line breaks and both image layouts; Note hover fields export as comma-separated names.

- Automatic hazard validation, detection, and maintenance are scoped to the currently viewed scene, including startup, time updates, Actor/Token changes, combat turns, and Region events. Queued work skips scenes that are no longer viewed. Opening a scene checks destroyed bodies and expired effects; malformed records on other scenes no longer cause unrelated notifications. Local regression coverage added; live Foundry verification pending.

- Modular tile dimension checks update existing thumbnail controls in place rather than re-rendering the whole picker per file. Preview media, focus and loaded thumbnail nodes remain intact during scanning. Metadata is cached across picker reopenings for the current session; Refresh clears it. Images remain original map assets displayed at thumbnail size, not separately generated thumbnail files.

- New Modular Scene includes a performance warning recommending lower-resolution tiles and only a few animated tiles for large scenes, explaining the impact on players with slower devices.

- Modular tile thumbnails and video previews disable Picture-in-Picture and do not receive pointer events, preventing browser video controls from interfering with tile selection. Hover preview and placement remain on the thumbnail buttons.

- Place Tile only reads the selected scene and no longer builds a world scene list for the hidden setup dropdown. The separate setup screen still lists valid modular scenes.

- Modular tile picker ignores malformed modular layouts in unrelated scene-list entries instead of failing to render. The current scene still requires a valid layout; no scene data is repaired or rewritten.

- Quick Scene Importer labels distance per square as Scale; distance values and saving behavior are unchanged.

- Opening Add/Edit effect saves and spawns the selected Hazard Actor first when no body exists or the selected template changed. Its native weapons are immediately available. Reopening effects reuses the saved body; cancelling the effect leaves the saved hazard draft/Actor in place. Switching back to the built-in default correctly replaces the template body.

- In enabled POI scenes, GM double-click on an existing pin opens its Note editor. Pin creation ignores clicks that hit an existing visible pin, preventing the first click of a double-click from opening New Pin. Players and scenes without Map POI retain native journal activation.

- Open POI editors and the template settings refresh Hover Fields when their linked journal page is saved. Existing checkbox choices and other unsaved form values are preserved; new headings appear unchecked. No reload is required.

- POI picker hides its empty native dialog-button row so the icon list fills all remaining space beneath Search, including after resizing.

- New starter POI templates no longer include an empty Image heading at the top. The selected POI image still receives its Image heading at the bottom. Existing saved templates/pages are preserved.

- POI Hover Fields omits Image and Description, which are always displayed, and uses a plain heading/list instead of a nested fieldset. The editor resizes when preview dimensions change; its footer stays outside the scrolling content when viewport space is limited.

- POI icon picker opens taller (up to 720px within the viewport), with a fixed search field above the scrolling categories. Search matches icon names and categories, expands matches, reports no results, and restores category state when cleared. Built-in current-icon previews use theme text color; the appearance preview retains its tint with a light/dark outline for contrast.

- Hazard Actor attacks continue through the normal Combat Tools weapon-attack workflow. Hazard damage uses CT Add effects and its normal post-damage resistance/application cards; shared rendering improvements are in Combat Tools and Visual Tools.

- Restored the built-in Default hazard Actor option alongside saved templates. It remains available when the template folder is empty and includes the native Handgun skill fix. This supersedes the template-only dropdown decision.

- Default hazard Actors include the native Handgun skill required by their pistol. Hazard attacks detect a missing configured weapon skill and explain which skill to add instead of passing an incomplete Actor into CPR's native attack roll. Existing Actors/templates are not rewritten.

- Hazard Actor Template selection lists only saved templates in SceneTools / Hazard Actor Templates. The synthetic default option is removed. An empty list explains where to add templates; opening the editor does not recreate a deleted template.

- The active GM provisions Default Hazard Actor in Actors → SceneTools → Hazard Actor Templates on world startup. It has hazard artwork, 10 HP, and an equipped Very Heavy Pistol loaded with 200 Basic rounds. Subsequent loads preserve template edits and do not duplicate it; placed hazards remain independent copies.

- Quick Scene Importer review uses a full-width name field, grouped map/grid and lighting controls, a preview with readable grid/content summaries underneath, and collapsible import details. Shared settings have separate Lighting and Grid rows; native control styling is retained.

- Quick Scene Importer introduces map selection and explains that Next searches the same folder tree for variant maps and Foundry scene data, using plain language.

- New Modular Scene prompt uses a clear heading, a separated Recommended map pack section, and a distinct scene-name field with space before the Create Scene action. Styling changes are scoped to this prompt and retain native Foundry controls/colors.

- Scene thumbnail save verification reads stored source data and accepts Foundry's native thumbnail-file path and cache-busting prepared URL. Successful imports no longer report failure solely because the saved URL differs from the generated image. Empty generation results and cancelled saves still report failure; generation remains a single attempt.

- New Modular Scene dialog explains tile-based expansion and the need for consistently sized, matching map images. Includes the requested Solution Maps Modular Pack link in a new tab, followed by the native scene-name field and Create Scene action.

- Scenes sidebar uses Import (file-import icon) and Modular (construction-worker icon) on the second row. The row copies native action-row classes and has no custom button styling, preserving native button size, margins, font, colors and borders.

- Scenes sidebar places Scene Tools actions together on the second row, directly below native Create Scene/Create Folder and above search. Compact Import and Modular buttons use file-import and construction-worker symbols, with full tool names in tooltips and accessible labels. Import opens Quick Scene Importer; Modular opens Modular Scene Creator.

- Hazards toolbar uses a warning triangle. New Default hazard Actors and their tokens use matching warning-sign artwork and start with an equipped native Very Heavy Pistol, a 200-round magazine containing 200 Basic Very Heavy Pistol rounds, and the native installed-ammunition reference (no additional reserve rounds). Saves preserve ammunition already spent. Custom Actor templates retain their own equipment; existing hazard Actors are not rewritten.

- Patrol controller and editor grow vertically with their contents. Removed scroll limits from the patrol list, operations log and waypoint table, and override native dialog height clamps/content scrolling for these two windows. The controller retains its narrow width.

- Patrol editor places Mode above all mode-specific controls. Loop/Back & Forth show route pauses and side-track options; Random shows Region, distance preference and movement limit. Irrelevant groups are hidden while switching modes retains draft values. Shared speed and vehicle controls remain available.

- Patrol controller header uses a Play/Pause scene icon and a pencil icon to its right that opens the Patrol editor, including when no patrols exist yet. Individual patrol edit icons remain. Scene pause still preserves individually stopped patrols.

- Vehicle Patrol yields for moving tokens: native movement/rotation animations and active Patrol movement reservations identify traffic. A blocked next step stops for up to five seconds, resumes immediately when clear, then replans around traffic if still blocked. Repeated token updates do not extend the deadline. Stationary blockers route around immediately. Planning can look past moving bodies; final movement checks retain full collisions. No persistent flags/settings added. Local regression coverage; live multiplayer verification pending.

- Patrol editor removes the current-status line beneath Token and timestamps from Recent operations. History remains an eight-entry, automatically refreshed message list.

- Patrol editor layout: aligned settings and compact speed/range inputs, grouped Side tracks and Maximum deviation below Mode, and removed explanatory paragraphs. Artwork front stays visible but disabled/grey for non-vehicles, including after Save/Stop, without resetting its saved value. Existing two-column operations and waypoint controls remain.

- Access Point Types fixes Foundry v12's full-height notes flex rule inside its column form. The introduction and headings keep their natural height, the type list scrolls, and Add Type / Save Types remain visible. The browser fixture reproduces the native rule and checks the layout; live UI confirmation remains pending.

- Vehicle Patrol timing: disabled waypoint pauses and zero pause ranges continue to the next leg in the same scheduler tick, including Loop wrap and Back & Forth endpoints. Movement and collision reservations use the remaining native animation time after document updates, avoiding a second full-duration wait. Coincident stops have bounded processing. Automated regression coverage; live Foundry retest pending.

- Pre-release cleanup: removed the older Combat Tools picker import, AP template update/restore paths, hazard reference backfills and orphan adoption, startup/reconnect vehicle-seat recovery sweeps, no-GM seating and vehicle footprint guessing. New vehicles save their artwork footprint when spawned. Thumbnail creation makes one attempt. Current save rollback, permission checks, Undo, native defaults and patrol obstacle routing remain supported. No existing world data is migrated or purged.

- Storage ownership: all hazard configuration and saved state now live only in Scene flags `flags.pneuma-scenetools.hazards.<id>`. Regions provide native shapes, elevation, visibility and behavior, native Region controls create/reuse the linked Scene record. Hazard UUIDs use SceneToolsHazard IDs. Vehicle boarding/exiting requests and acknowledgements use transient module socket messages with bounded duplicate tracking, timeouts, GM handoff/disconnect handling, and queued permission/capacity checks. Requesting owners perform the native writes after a GM grant; socket-supplied identities never authorize GM document writes. Only resulting seat assignments and layouts are persisted. GM layout editing remains local; boarding and exiting require an active GM. Local verification is separate from live Foundry/multiplayer verification.

- Scene Tools data compatibility cleanup (unreleased): removed legacy folder flags/name aliases and folder renames, Drawing-to-Region hazard migration and backup flags, old Scanner settings, Mook template version upgrades, container-vehicle conversion and template equipment/artwork upgrades, POI template/image backfills and comma-separated hover selections, and hazard link-list/single-trigger/combined-effect editor conversions and retired patrol cards. Current documents/settings remain the only supported formats. Existing world records are not rewritten or purged on startup. Native Foundry Scene import remains supported.

- Hazard Triggers includes a read-only Activated by list derived from other scene hazards. Effects is one ordered, appendable list of direct effects and Trigger another hazard entries, with edit/remove/move-up controls. Each linked effect creates a separate GM confirmation when resolved; cyclic activation is suppressed. Presets clear scene-specific effect destinations.

- Access Point Types uses compact rows with shared column headings and current-icon previews. Previews update when typing an artwork path or selecting a file; unavailable artwork shows the generic icon.

- MookMaker always shows Display Name and Token Disposition controls and always purges unused ammunition with unused gear. Removed the two settings and their conditional behavior; the separate weapon-ammunition retention setting remains supported.

## Hazards and hazard actors (local, unreleased)

- Hazard code organization: the editor and draft popups use native v12 FormApplication windows, Handlebars layouts, and FormDataExtended parsing. Trigger selection, activation processing/state, chat rendering, and effect cleanup are separate modules. CombatTools calls share a typed adapter; action kinds have separate TypeScript shapes, with saved input normalized at the boundary. Unused drawing-mode scaffolding and preset-device placement were removed. Existing GM confirmation, deactivation/card behavior, native attack allowance, layout, and popup cancellation remain covered by local automated/browser fixtures; live Foundry verification is pending.
- Shared artwork loading uses native FilePicker, ImageHelper, and VideoHelper across spawning, vehicle configuration, MookMaker, and artwork previews. Gear purge protects installation relationships in one pass and uses CPR owned-item lookup with the existing synthetic-reference fallback.

- Hazard status selection requires Combat Tools' public statusPicker API v1. Missing, inactive or unsupported APIs report an error; no private-file import or substitute picker is used. Supported native IDs and cancellation remain covered by local checks; selection does not apply effects or bypass GM confirmation.

- Innate hazard Actors: Hazard Actor Token can select a native mook/character template from SceneTools/Hazard Actor Templates (including child folders); the default creates an Actor from native system defaults. Save creates an independent owned Actor and hidden token. Repeated saves preserve identity, damage and equipment; changing templates replaces the owned Actor after a successful save while preserving the source template. The 64px outlined token preview supports Choose icon. Presets retain the selected template and icon, and clear instance references. Local checks pass; live verification pending.

- Hazard document controls: Save supplies one native GM-only blank trigger Region named `<hazard>-Tigger` for a new hazard. Later saves reuse its saved reference. Missing saved Regions or hazard Actors report an error; delete and recreate the affected hazard. Cancelled initial reference writes remove the newly created Region. Create NetArch AP remains explicit and requires an existing selected AP template.

- Hazard skill checks: Counter skill and Skill to avoid share the installed CPR system skill dropdown, with an adjacent DV field. Previously saved custom skills remain selectable.

- Hazard save verification accepts native no-diff updates returning no Document when stored values already match; cancelled writes with missing changes still fail. Regression fixtures model this native return behavior.

- Hazard saving: Activated and Trigger now appear in the bottom-left controls section; Save Hazard has a separate bottom-right box. Trigger now requests GM confirmation for the saved hazard against selected tokens, requires edits to be saved first, and does not save automatically. Save creates the scene hazard and its default trigger Region, including incomplete drafts; Add Hazard starts a new editor draft. Hazards use scene records independently of Regions; Save automatically creates or reuses a native GM-only trigger Region when no existing trigger is selected. Native Region controls create linked Scene hazard records. The native form hint flex-size override keeps the list visible. Import / Export beneath Add Hazard opens a compact preset-file panel. Hazard body creation verifies persisted HP, and rollback shares Actor cleanup to avoid duplicate deletion.

- Hazard editor styling: compact MookMaker blue/green/gold tinted boxes with accent borders, short numeric fields, tighter rows and no section/header divider lines.

- Current layout: scene hazard list at left. Full-width Hazard at top with identity/description beside checks, token icon and NetArch AP. Middle: combined Triggers and Targets/Area on the left, Effects on the right. Bottom: Controls, Presets and Save/Delete. Window width remains 1040px. Local layout checks; live verification pending.

- Hazard elevation is configured only in the native Region editor. Hazard saves and preset application preserve its bounds; camera detection reads those bounds directly.



- Terminology: Hazards and Hazard actor throughout controls, messages, defaults and documentation. Current storage identifiers, Region Behavior type and preset format use the Scene Tools namespace; no legacy label conversion runs.

- Hazard Region Behavior is declared in the module manifest as well as registered during init; source/build checks verify the declaration. Install the updated manifest and restart Foundry before retesting creation. Live validation remains pending.

- Native Region editing, multiple shapes/holes/elevation, membership and segmented movement events. Hazards use Scene records exclusively; Regions hold their native geometry and behavior.

- Native Region entry/crossing, distance-inside, token start-of-turn and actor-turn triggers with membership checks; active-GM confirmation, per-effect resistance, roll-then-apply damage and persisted duplicate/stale-click guards. Camera/end-turn/manual triggers are supported by the runtime.
- Direct native damage/status/MOVE effects, target-attached destructible condition instances, innate template-backed hazard Actors for attacks, and linked-hazard effects. Condition destruction removes only owned effects. Counter/notice timing remains GM adjudication.
- Each configured Region has its own hidden native Actor/token and HP, revealed for player targeting. Zero HP stops activation. Attacking drones/turrets have separate HP. Scanner links use existing icons and marker behavior.
- World presets with validated JSON import/export and overwrite confirmation; no compendiums or official stats. Scene-specific actor/area/effect destinations are cleared for portability.
- Combat Tools optional: its versioned scene-attack API reuses its existing combat workflow; native CPR sheet rolls work independently. Item-based trigger exemptions are backlog. Camera LOS needs the active GM to view the scene; discovery/disarm adjudication remains with the GM. Live Foundry/multiplayer verification pending. See [Hazards guide](docs/traps.md).

- Module settings are grouped under Quick Scene Importer, Map POI, MookMaker, and NetArch Scanner. Map POI contains a GM-only Map POI Defaults menu, shared with the pin manager and available without an active scene. The per-scene enable switch remains in Scene configuration.

## Scene Tools Map POI (unreleased)

- The Map POI toolbar button opens **Scene Tools Map POI**, showing all scene pins in a dedicated list, with a Map POI Defaults button opening a separate screen for world defaults for city icon, size, tint, global visibility, hover preview, and journal template/hover layout. Defaults affect future Scene Tools pins only. **Place pin on map** closes the manager and arms one map click; Escape cancels. The creation form rounds clicked coordinates to whole pixels and uses saved defaults. X/Y inputs use whole-number steps; note creation and updates on enabled scenes round coordinates to whole pixels. Cancelling creates no journal.
- On enabled scenes, every native Note editor uses a single **Scene Tools Map POI** form for GMs, including ordinary notes without module flags. It retains native location/journal controls and listeners, with the city-icon picker, appearance preview, and per-pin hover/page/heading settings together. Duplicate native appearance controls are hidden; saving uses the native form. Changing the linked journal refreshes the available preview pages and clears stale mappings.

- 61 filled wayfinding pictograms: standard Material Design Icons plus tailored Cargo Container, H Landing Pad (solid H with a thin circular boundary), Cyberware Dealer (cyberarm), Ripperdoc (single surgical scalpel and medical cross), and NetRunner (solid chip with two contacts on each of its four sides) symbols. Cargo Container is under Residential; NetRunner is under Shopping. The set uses familiar transport, service, location and activity symbols with natural proportions. SVGs are normalized to white fill on transparency for native Foundry Icon Tint; upstream icon path geometry is preserved. Checked at 48px and 32px; existing location names, categories and asset paths are retained. Upstream source revision, attribution and Apache 2.0 license are included with the artwork.
- Opt-in `Scene Tools Map POI` checkbox in Scene configuration. Enabled scenes gain a Map POI button in Journal Notes controls and a scene-directory context action. Other scenes and Foundry's global icon dropdown are unchanged; this supersedes the earlier global icon registration.
- Scene configuration inserts the checkbox into the Basics content panel, not the same-named navigation link. Browser regression checks preserve tab navigation layout and prevent duplicate controls.
- Dedicated searchable/category-filtered icon grid, location creation, appearance editing, tint/size/position/global visibility, journal opening, pan, native configuration, and confirmed pin deletion (journal retained). Native note documents preserve placement, links and native functions.
- New POIs use one text page each in a shared `SceneTools / Scene Name - POIs` journal. Scene-ID identity reuses the journal after renaming and separates same-named scenes. Template HTML and images become editable sections; other media retain native page links. Existing POIs are unchanged; no consolidation or migration is provided.
- The private default template has one POI page with Description, Factions, NPC's, Contacts, and Services. GM notes is excluded from hover fields and previews, including older templates. Existing journal content is preserved. New POI pages grant player Observer access without copying template editing grants. Template edits affect future pins only. Inline images can be used in hover previews; secret images and content remain permission-filtered. Failed note creation removes only its new page, preserving other POIs.
- Template defaults and native pin options list actual headings from the selected Description page as checkboxes. The Description section always appears in full across the bottom of the hover card; selected other sections appear as labeled fields to the right of the image in the top row. Every heading level defines a section, through the next heading. Pages without headings use their full content as Description. Selections use JSON arrays, supporting commas in names and selecting no extra fields.
- Crafted hover cards preserve rich text and allow scrolling through full descriptions when the card exceeds the viewport. Moving onto the card keeps it open; leaving dismisses it. Hover cards check journal and page Observer permissions, omit unrevealed secret sections for players, and discard pending content after hover exit or document changes.
- Self-contained labeled, recolorable preview: `docs/city-icons.html`. Source selection: `scripts/city-wayfinding-selection.json`; pinned path data: `scripts/vendor/city-wayfinding.json`; names/categories: `scripts/city-icon-catalog.json`; offline generator: `scripts/generate-city-icons.mjs`; assets and license notices: `src/assets/city-icons/`. Only explicit source refreshes (`scripts/fetch-city-wayfinding.mjs`) need network access.
- Automated data/browser fixtures cover creation rollback/retry, missing templates/pages, shared journal identity, scene scope, search, saved template configuration, form failure retention, permissions, secret sections, and hover cancellation. Live Foundry appearance and multiplayer verification remain pending.

## Sustainability fixes (0.2.5)

- Guard Apply, Purge and Promote against overlapping operations on the same token within a client.
- Delete unfinished Scene imports after failure; retain completed Scenes and preserve retry state when cleanup itself fails. Import original JSON before applying overrides.
- Preserve moved and current-version Mook templates, including intentionally empty templates; bound default-template fetches.
- Isolate feature loading/registration and run ready tasks independently.
- Filter and batch Scanner refreshes; resolve referenced documents without scanning the entire world on every panel render.
- Add cancellable folder scanning and media preparation, bounded reads, and four concurrent JSON reads.
- Move MookMaker markup into Handlebars and split view data, typed input validation, and event wiring.
- Expand failure, rollback, cancellation, startup-isolation and rendered-form regressions. Live Foundry and multiplayer verification remains pending.


- Import then overrides (v0.2.4): untouched JSON is imported first, followed by changed field updates, embedded asset rematches, and selected overlay tiles. As of v0.2.5, failed imports are cleaned up; pending Scenes are reused only if cleanup fails. Browser tests verify ordering and preservation; live-world verification remains pending.
- JSON-first creation (v0.2.3): use imported JSON settings in an editable review with no preliminary mode dialog; assign each layout a reusable Scene JSON; preload JSON values and preview imported walls/light sources. Native migration and JSON import receive complete Scene data. Core import policies handle identities/state; the module no longer strips journal/playlist or other fields. The v0.2.5 cleanup policy supersedes unconditional pending-destination reuse. Browser regressions cover four variants/two JSONs; live persistence remains pending.
- The creator renders selection and review through one native Handlebars template. Scene preparation returns plain data; one builder validates and applies form values. Saved batch entries are marked and locked during retry (v0.2.2).
- Scene creation reads the registered form with final per-scene field names; missing numeric fields and invalid dimensions/grid values are rejected before saving (v0.2.1). Verified with the native v12 form serializer in an isolated browser; live-world persistence remains unverified.

## Module foundation

- Foundry v12 manifest targeting Cyberpunk RED.
- Strict TypeScript, compiler-based build, manifest validation, and CI.
- Init registration for settings and the Scenes sidebar control.
- Integrated MookMaker and NetArch Scanner startup, settings, assets, templates, styling, and APIs; per-feature registration and ready error reporting. libWrapper is required for scanner wrappers.
- Scanner runtime resolves native Foundry lexical globals; startup browser coverage verifies module loading, menus/API, the sidebar button, and seven template Actors.

## In-world folder convention

- Shared document-type-aware `SceneTools` root creation, with concurrent feature calls reusing one root.
- Imported Scenes use `SceneTools/Imported Scenes`.
- MookMaker uses `SceneTools/MookMaker Templates` and `SceneTools/MookMaker Promoted Actors`.
- AP template Actors use `SceneTools/NetArchAPs`.
- The same helper is available for future world Items, Journals, RollTables, and Playlists; embedded Items remain in their parent Actor.

## MookMaker

Imported the existing v0.93.4 functionality: versioned default character template, embedded equipment and skills, random token artwork, unlinked-template token tagging, native Token HUD control, identity/stats/HP/MOVE changes, Combat Number skill adjustments, secondary/tertiary skill settings, Role and armor changes, two weapon selections, Unchanged/REF 8/Reflex Co-Processor options with native item installation and rollback, gear/ammunition purge, and promotion to linked Actors. Preserved the compact form and skill classification settings. Runtime asset paths and module storage use `pneuma-scenetools`.

## NetArch Scanner

Imported the existing v0.9.0 functionality and ported runtime source to TypeScript: six private AP templates, custom/disabled AP types and artwork, AP editor/HUD/double-click controls, native Scanner roll-card wrapper, GM discovery panel with original roll-card display, Netrunner ownership/selection and grid-aware radius filtering, individual/bulk private/public reveals, Hide All, accumulated runner recipients, per-AP names, configurable finite/looping pulses, stable Architecture colors and per-Scene unassigned colors, local above-fog artwork/optional vision circles, and cleanup on concealment or canvas teardown. Runtime asset paths, settings, flags, and libWrapper registrations use `pneuma-scenetools`.

## Modular Scene Creator


- Picker remembers the last collection, Static/Animated tab, and each collection/tab scroll position locally for the current world and user, including reopening and reloads. It stays open after placement; click a canvas space to change its target. Done Building saves the thumbnail and closes the picker.
- Once the first tile establishes dimensions, incompatible or unreadable tiles are hidden. Show incompatible tiles displays them disabled. Dimensions are checked with four concurrent loads and cached while the picker is open; Refresh retries.
- One-step Undo restores the latest successful placement/replacement, rotation, removal, expansion, or shrink, including deleted edge tiles and translated native contents. There is no redo or multi-step history. Cancelled/no-op actions retain the previous step; outside changes to scene geometry or native contents invalidate it. Undo is session-only.


- Done Building regenerates and saves the native scene thumbnail before closing live controls. Failures leave editing available for retry.

- New scenes use 0.15 padding outside the playable area. Tiles, rotation, edge warnings, and live controls use playable-area coordinates. Expansion/shrink adjust native content for changes to Foundry’s padding origin without including padding in tile sizes.

- New scenes use `SceneTools/Modular Scenes`. Active-GM startup renames the earlier misspelled folder, or moves its scenes/subfolders into an existing Modular Scenes folder and removes the empty duplicate. Failed moves retain the old folder for retry.
- The Scenes directory Modular Scene Creator button prompts only for a name, creates a blank scene under `SceneTools/Modular Scenes`, views it locally, and enables live tile controls. The first placed tile sizes the scene; expansion is disabled until then. The Tiles toolbar resumes the current modular scene. This replaces reference-image setup for the directory button. Existing scenes and folders are retained.
- Static and Animated tabs above the three-column thumbnail grid filter by extension. Static: AVIF/JPEG/PNG/SVG/WebP; Animated: GIF/APNG/WebM/MP4/M4V/OGV. Filename search combines with the selected tab. Video thumbnails use native video elements and large previews play muted/looping. Tab changes clear the previous preview/reference selection. Classification is by extension, so WebP/PNG remain Static even if their contents happen to animate.
- A minus control beside each canvas edge arrow removes that outer row/column. Empty edges shrink immediately; edges intersecting placed native Tiles show a default-cancel warning with the deletion count. Left/top shrink translates remaining scene contents and modular cell assignments. The last row/column cannot be removed. Scene changes during confirmation are rejected, and failed resize/deletion operations attempt to restore tiles and dimensions. Non-Tile documents are preserved, including those outside the reduced bounds. Automated coverage; live verification pending.
- GM-only native Scene/Tile builder, available in the Scenes directory and Tiles toolbar; editing is restricted to the active GM to avoid competing builders.
- World-saved named image-folder collections, native folder selection with source/bucket preservation, thumbnail picker, filename filter, refresh, and collection removal without deleting files or existing Tiles.
- Creates a blank Scene sized from the reference image under `SceneTools/Modular Scenes`; no tile is placed during creation. Mix collections with matching image dimensions when placing tiles later.
- Live canvas controls sit on actual scene spaces. Place Tile opens a Collection / Tile picker with three small image-only thumbnails per row and a larger preview to the right. Hover/focus updates the preview and displays Place Tile over the thumbnail; clicking immediately places/replaces the tile and keeps the picker open. No filename captions/tooltips or separate Place Tile button. New-scene setup still selects a reference before Create Blank Scene. Edit Tile selects an occupied space and shows on-scene replacement, repeated 90-degree rotation, and confirmed removal controls. No miniature layout editor.
- Four arrows at the actual scene edges add complete rows/columns. Controls follow pan/zoom, stay GM-only, and clean up on scene changes or Done Building. Left/up expansion translates native scene contents and initial view with the layout in one Scene update. Persistence checks detect cancelled writes.
- Resume building the viewed modular scene from the Tiles toolbar, or select an existing scene in setup and use Build on Scene. Native locked Tiles remain usable without the creator. [Usage and limits](docs/modular-scenes.md).
- Local automated geometry/document and browser-fixture validation; live Foundry/multiplayer verification pending.
- Live canvas controls establish fixed/absolute positioning before DOM attachment, independently of stylesheet loading. A browser regression reproduces the sidebar shift when the module stylesheet is absent and verifies that the controls no longer participate in Foundry's body flex layout.
- Canvas buttons use a semi-transparent HUD-style background. The compact picker displays three 70px-high image-only thumbnails per row beside a larger hover preview. Initial collection browsing waits for the window render to finish; pending refreshes are replayed, and the existing picker is explicitly unlocked after operations so Foundry's render suppression cannot leave it disabled. Browser fixtures cover the render race, tile selection/placement, thumbnail layout, and transparency; live retest pending.

## Quick Scene Importer

- GM-only button in the native Scenes sidebar opens the three-step wizard with an embedded folder browser.
- Scene button uses native header actions, supports specific and generic sidebar render hooks, and attaches to an already-rendered sidebar at ready; duplicate controls are prevented.
- Recursive import discovery, explicit import choice, and filename-match suggestion.
- Native Scene JSON migration and import, plus Universal VTT walls, portals, and lights conversion.
- Editable scene dimensions, grid types/distance/units, lighting, token vision, and fog exploration.
- Common grid-size ranking, filename hints, Custom/Gridless choices, and square-grid preview.
- Grid type offers only Squares and Gridless. Foundry JSON grid size, supported grid type and distance are selected by default and marked (Imported); fallback sizes are marked (Suggested).

- World defaults for grid size, darkness, and global illumination.
- Same-folder overlay thumbnails, opt-in tiles with placement/dimensions, and one full-map foreground.
- Unambiguous nearby asset rematching, scan warnings, and inactive creation; native Scene configuration remains available afterward.
- Case-insensitive Foundry/Foundry Walls/FoundryWalls/FoundryScenes folder recognition and regex ranking for the provided Train Assault and Corporate Eatery naming conventions.
- Explicit bulk variant selection, per-variant media assignments, Static/Animated import checkboxes (select either or both), and image/video-only layout variants.
- Trailing resolution labels (720, 1080, 1440, 2160, 4320, optionally suffixed p) are ignored when grouping map variants, so static and animated Brineworks files share one selection row.
- Matching OVERLAY/Foreground image and video suggestions, preserving floor and zoom layout differences.
- The Foreground / overlay dropdown lists every image/video in the map folder, plus the current imported foreground only if it was found in the scanned files, so differently named files can be selected manually. Selection updates the preview and saved path, persists through Back, and clears only the replaced foreground warning. Unavailable JSON foregrounds appear as a disabled Missing foreground placeholder, not a selectable file. None removes the foreground. JSON foregrounds automatically rematch by filename in the selected map folder first, then beside the Scene JSON, before using an unambiguous scanned-file match. The resolved foreground is composited over the map in the import preview, with its path shown; loading failures are reported beside the preview. Native JSON import is followed by the foreground path update.

- Video-capable picker, video metadata dimensions, and video frame grid preview.
- Thumbnails regenerate after import and asset overrides, replacing inherited thumbnails. Generation or save failures retry twice; persistent failure warns the GM while preserving the saved Scene. Automated regression coverage; live Foundry verification pending.

Type checks, imported regressions, folder/startup checks, and browser fixtures pass. These checks use mocked Foundry APIs. Live Foundry, hosting-provider file browsing, multiplayer visibility, and real map-pack alignment verification are pending. Existing standalone world data is not automatically migrated. See README.md for limits and feature guides.


The embedded native picker uses image/video thumbnail mode so map files remain visible; Next selects the current folder, not an individual file.

Quick Scene Importer opens at 1100 × 850 pixels, capped to the viewport with a 40-pixel margin, and remains resizable. The embedded folder browser fills the available window height. Quick Scene Importer uses a three-step wizard in one FormApplication: native Foundry FilePicker template and controls embedded for folder browsing, with inline cancellable discovery, aligned map-selection rows with bold map headings; unchecking a map disables and greys out its child controls while retaining their values, with compact File buttons, then a scene pick-list on the left and the selected preview/editable fields on the right. Shared lighting/vision controls sit above the review. Explanatory text, counts, source/foreground paths and missing-asset warnings sit in a separately scrolling right sidebar; the center contains the preview and editable controls. Applying shared settings disables and greys out every Scene's lighting/vision controls; unchecking restores their editable values. The per-scene shared-setting exception is removed. Editable text/number inputs and dropdowns have visible backgrounds, borders and focus outlines; disabled controls are muted. Review fields use compact control widths, with scene dimensions side by side and custom grid size shown only when Custom is selected. Distance per square is one dropdown (1 m, 2 m, 4 m), without a separate units field. An unusual imported distance/unit pair remains available as the selected imported option until changed. Back returns from review to map selection and from selection to folder browsing; the same folder retains the batch, selections and review edits when assignments are unchanged; changing assignments prepares a new review. Back is disabled after any Scene is saved or has an incomplete pending save to prevent duplicate imports. One batch submission creates the selected Scenes. Empty overlay steps and automatic Scene configuration popups are removed. Failure retains form values and retries only unsaved scenes. World collection membership is checked before reporting success. SceneTools/Imported Scenes is provisioned by the active GM at world startup.

Folder lookup and creation are shared by all features and recognize existing renamed folders by the current SceneToolsFolder flag. Scanner uses native Foundry types plus explicit AP, pulse, discovery, settings, and UI data types; global/constructor proxies and untyped global declarations are absent. Compatibility policy is centralized in the module entry point. The API exposes only openSceneCreator and netArchScanner.

The browser suites run in CI. They cover startup, native-form contracts, static/animated batches, shared settings, invalid forms, failed persistence and retry. Live Foundry verification remains pending because browser attachment reports Debugger unattached.

Follow-up reliability fixes: promoted Actors drop default-template identity; promotion verifies token linking and rolls back an unused Actor after cancellation. Confirmed Purge waits for deletion before refreshing the form. Switching JSON preview to editing rematches foreground, tile, token and sound assets while preserving the original native import source. Targeted regression tests cover these failure paths; live Foundry validation remains pending.

- Compact hover layout: image widened by 10%; right-aligned detail labels and their values share rows to its right. No divider below the title; the divider below the image remains. The journal-opening hint uses 10px text at the bottom of the card. Blank editor paragraphs do not stretch detail rows. Full Description text appears below without a repeated Description heading.

- City icon menus use expandable category folders, following the Combat Tools status-menu layout. Each expanded category shows compact icons with names; the selected category starts open. Picker artwork inherits the native text color; saved pin tint is unchanged. This replaces the category dropdown and search grid in creation and native pin settings.

- Visual defaults include icon size/tint, font family/size, text color, and text anchor. New Scene Tools pins inherit them. Load defaults on the left of the appearance controls loads saved defaults into the fields without saving. Apply on the right saves the displayed appearance fields to an existing pin and keeps the editor open. New pins use the native Save button first. The icon choice, journal links, coordinates, and hover settings are preserved.

- Visual defaults apply to every newly created native pin on enabled scenes, including direct journal placement. New native editors begin with those defaults and preserve subsequent form choices. Icon artwork is not a default: the defaults screen has no icon picker, and creation chooses an icon per pin. Icon selection belongs to each pin.

- Native pin Scene Tools tab splits its lower area into hover settings at left and a live icon/label preview with visual controls at right. Size, tint, font, text color, and anchor controls mirror the Basic fields in both directions without additional saved fields. Apply Visual Defaults sits in the appearance panel. Native Save commits the changes.

- Fixed the Map POI editor freeze caused by cloning native Foundry color-picker elements: their value setters emit input/change events, recursively feeding the appearance synchronization. The appearance panel now uses plain mirror inputs, suppresses unchanged writes, and avoids duplicate custom-input events. A bounded native-setter regression reproduces the old loop and checks edits/default application.

- Pin appearance preview uses the configured icon and font pixel sizes without scaling or a fixed oversized frame. Preview height fits the icon and anchored label; the editor minimum width is 580px.

- Map POI editor category lists inherit the active Foundry/CPR theme instead of forcing dark colors. Icon artwork uses the same color as its button text, keeping it visible on native light and dark button backgrounds. Selection uses a text-color outline.

- Map POI dialogs use native theme surfaces and consistent form rows across defaults, creation, template settings, and the pin editor. Defaults opens at 480px with hex color fields and compact swatches; the manager opens at 540px. Hover cards use native window-content styling, preserving the crafted layout. Appearance previews retain actual pin size and configured colors.

## Mook and Vehicle artwork spawning - implemented locally

- Shared Token Artwork Categories settings menu maps separate Mook/Vehicle category names to Foundry data folders with native folder pickers.
- Dropping unlinked Mook and Vehicle templates creates tokens directly without a Category prompt, even when artwork categories are configured.
- Drops retain native prototype artwork/random selection and synchronize the synthetic Actor portrait with the resolved token image. World template artwork stays unchanged. Artwork categories remain available in the Mook Maker and vehicle configuration editors.
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

- Both vehicle seat editors offer Snap to other seats, enabled by default. Placing or moving within ten displayed pixels of another seat aligns the row or column exactly. Each axis snaps independently; hold Shift or uncheck the option for free placement.

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
- Exits use the nearest perimeter grid position to the rotated seat. If a movement wall blocks that exit, or the handling client cannot check scene collisions, the passenger exits onto a grid square overlapping the vehicle instead. Normal appearance is restored and the passenger is detached.

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

- Vehicle templates represent car types; vehicle drops use template artwork without the former category prompt. Mook drops also use template artwork without a category prompt.
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

### Compact artwork categories with inline seats

- Search and kind filtering sit above the category list. Category name and kind share a row; vehicle scale has a synchronized slider and numeric input.
- The right pane previews sample folder artwork for both Mooks and Vehicles. Vehicle seats can be placed, selected and moved, renamed, and removed directly on the preview. Save categories persists the draft; vehicle capacity stays on the vehicle type.
- Local browser checks cover inline editing, Mook previews, retained drafts and scale controls. Live Foundry verification pending.

### Unselected vehicle HUD seats

- Scene Tools controls also mount on standalone Combat Tools HUDs, which have no native left column. With a character selected, right-clicking an unselected vehicle exposes Enter/Exit and preselects that character without changing token selection. Configure remains GM-only.
- Local browser fixture covers native and standalone HUD placement and opening seats as GM/player. Live Foundry verification pending.

### Separate Mook and Vehicle artwork dialogs

- Replaced the combined artwork settings menu with Mook Artwork and Vehicle Artwork. Both use the same list/details/preview style and search; Kind selectors and filters are removed.
- New categories inherit the dialog type. Mooks show folder artwork previews; Vehicles also show footprint, scale and inline seat controls. Existing shared category storage is retained, and each save merges the other type's latest saved categories.
- Supersedes the combined category editor above. Build, both-dialog browser checks, and 14 targeted tests passed; live Foundry verification pending.

### Artwork folder browser previews

- Both artwork dialogs use a native folder picker with a scrollable image thumbnail grid and filenames for the current directory. Images are preview-only; native folder navigation and folder-only selection remain intact. Empty or inaccessible previews show a status message. Live Foundry verification pending.

### Compact Mook Maker trial

- Compact horizontal radio rows for Combat Number, HP, MOVE, armor, skill adjustments and existing bullet-dodging choices. Removed duplicate title banner; moved Purge/Promote to a bottom utility row. Category radios and an exact selected-artwork preview sit beside identity controls.
- Keep current is the default. Selecting a Mook artwork category prepares one random image; Apply uses that exact image for the token and synthetic Actor portrait. Preview/Cancel do not mutate documents; loading/empty folders prevent Apply, stale preview responses are ignored, and artwork participates in Apply rollback.
- Build, browser checks and six Mook workflow checks passed; live Foundry verification pending. Trial rollback snapshot: D:\OneDrive\Development\Git\.rollback\scenetools-mook-compact-20261012.

### Compact Mook Maker layout refinement

- Narrowed identity, display/disposition and weapon fields. Category is a visible pick-list left of the preview; Choose image opens only images from that category. Purge/Promote sit beneath the preview, with original section and utility-button colors restored. Removed the selected-artwork caption; loading/errors remain visible.

### Mook Maker manual artwork and control placement

- Removed Civilian Combat Number and its configuration setting; Custom handles other values. No Change is at the far right.
- Category list fills the Mook section height and begins with Keep Current and Manual. Manual enables unrestricted native image/video folder browsing; category choices retain folder-specific selection. Choose Image is under the preview; Purge/Promote are at the bottom left of the Mook section.

- Mook Maker purge action, confirmation title, and related setting hint now use the label Purge Unequipped Gear; behavior unchanged.

- Combat Number now defaults to No Change every time Mook Maker opens; changing skill targets requires an explicit preset or Custom selection.

- Mook Maker category options, including selected Keep Current, inherit the themed select text color with a neutral selection tint.

- Combat Number uses the Unchanged label. All Unchanged radio choices (combat, bullet dodging, secondary and tertiary skills) align to the right edge of their rows.

- Purge Unequipped Gear sits at the right of the weapon selectors in the Gear section; Promote remains in the Mook section.

- Hazard deletion: the bottom-right Save box uses compact Save Hazard and Delete Hazard buttons. Delete requires confirmation and removes the saved hazard, linked NetArch AP, trigger Region, hazard token and owned Actor. Actor templates and target-only Regions are preserved. Shared trigger Regions are identified in confirmation. Cancelled native deletions retain a disarmed record for retry. Local automated verification; live Foundry verification pending.

- Trigger Regions start with no shapes; draw the area using native Foundry Region controls. Deleting a scene hazard's trigger Region preserves its record, Actor and AP and makes it inactive with a missing-Region warning. Save Hazard to create a blank replacement; repeated saves reuse it and preserve Actor HP. Region edits refresh the editor warning. Local checks only; live verification pending.

- Hazard readiness: required fields have an asterisk, missing values use yellow outlines, and Controls lists specific missing requirements. Effect rows identify incomplete effects. Activated replaces Armed; Trigger now replaces Activate Now. Incomplete hazards save inactive; Activated and Trigger now are disabled until requirements are complete. Runtime also rejects incomplete/inactive manual triggers. Zero-valued optional perception/counter/avoidance checks remain optional. Local automated validation only; live verification pending.

- Hazard editor width reduced from 1320px to 1040px, with a narrower scene list, effect list and footer columns. Existing two-column workflow, field sizes and fixed controls are retained. Local layout verification; live Foundry verification pending.

- Trigger choices use a 2�2 grid. Hazard Actor template selection has been removed; every saved hazard gets an owned native Actor automatically. Token icon preview and native file picker use `icons/svg/hazard.svg` by default. Icon changes preserve HP, equipment and Actor identity; presets retain the icon.

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

Hazards layout (2026-10-13, local/unreleased): Effects receives approximately 62% of the shared row, leaving 38% for Triggers/Targets, to give effect properties more room.

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

- Hazard combat integration: CombatTools weapon API v2, one native weapon attack per hazard Actor per round (including native sheets), and one weapon dispatch per activation outside combat. Direct damage/status/MOVE effects use grouped CombatTools cards with shared rolls and SceneTools cleanup. Condition instances retain GM-confirmed spawning and publish result cards. Native weapon AoE uses existing CombatTools placement/response/damage flow. Local tests only; live Foundry/multiplayer verification pending.

- A repeated weapon trigger after the hazard has attacked this round skips the weapon effect with an explanatory card message. It does not enter Review or block a new next-round activation. Other effects remain available; uncertain failures still require review.

- Deactivation now prevents new hazard triggers only. Existing pending GM confirmations and CombatTools effect cards can finish, including damage application, while Activated is off. GM confirmation, stale-card protection and destruction/configuration checks remain enforced.

- Purge Unequipped Gear resolves native CPR installation UUIDs and bare item IDs before protecting installed cyberware/upgrades. Cancelled unloads stop deletion; partial purges report the actual removed count and never restore magazine references to deleted ammunition.
- MookMaker Apply verifies saved source values for ActorDelta, Item and token updates, accepts already-saved no-op updates, and rolls back partial writes. Incomplete rollback is reported to the GM.
- Scene import verifies saved overrides, asset rematches and added overlays before marking a scene complete. Cancelled/partial writes use the existing cleanup/retry workflow. Local regression coverage; live Foundry verification remains pending.

- Hazard editor markup uses Handlebars partials with data-only view models and named action handlers. Structured readiness issues are computed once per draft render and reused for rows and field markers; save and activation still validate current state. Actor lifecycle, access-point integration, hazard records, and readiness validation have separate modules, with existing document API exports retained. Player eligibility uses native `Actor.hasPlayerOwner`. Local automated validation; live Foundry verification pending.

- Hazard avoidance uses CombatTools sceneEffects API v2 with per-target skill/DV checks. Target owners (or the GM) roll through CPR native skill dialogs and Luck handling; totals above DV skip the effect automatically, while failed checks permit GM application. GM-only resistance pass/fail controls are removed. Weapon defenses and GM-confirmed condition spawning remain separate. Automated checks only; live multiplayer validation pending.

- CombatTools sceneEffects API v3 exposes `getAvoidanceResult({cardId, provider, source, index, target})`. SceneTools uses this supported query rather than reading CombatTools chat flags. Avoidance requires the v3 query capability; no fallback to internal storage.

Quick Scene Importer: Imported image paths appears only for existing tile/token image references. Replacement files preserve imported placement. Folder-discovered optional overlay creation controls were removed; foreground selection remains separate. Live Foundry verification pending.

Quick Scene Importer review places compact settings to the left of a larger map preview, with notes retained in the far-right sidebar. The window defaults to 1400px wide, capped to the viewport. Preview resolution is 960x540.

Quick Scene Importer starts with a required native image/video selection. Discovery uses the chosen map's normalized filename family (including numbered layouts and media/resolution variants), excluding unrelated families in the same folder. Back retains the file and unchanged assignments; choosing another file rebuilds the selection.

Grid suggestions now include all integer pixel sizes of at least 50px that divide both map dimensions evenly, alongside the common sizes, filename hints, and imported/default size. Options identify Exact fit; common sizes have no extra qualifier. Imported remains the default when JSON supplies a size. Exact fit describes whole-square dimensions, not artwork alignment.

Scene review includes native grid style choices, thickness, color, opacity, and padding percentage (0-50%, stored as Foundry 0-0.5). Imported values populate individual controls. Shared settings start from the first scene and apply these values to every scene, disabling individual appearance/padding controls while enabled. Native post-import updates persist these fields. The preview remains a high-contrast alignment guide.

Each pin's Scene Tools tab has its own POI image path and native image-file picker, saved on that pin. Managed POIs automatically use their own linked page for description/inline-image fallback; journal-wide page selectors are hidden for these pins. Explicit POI images override inline images and still require access to the POI page.

POI images now also appear in a managed image block at the bottom of their own journal page. Saving the pin image replaces only that block; clearing it removes only that block. Journal images update when the pin image or journal/page reference changes. New default templates include an NPC's section. Existing custom template text is unchanged.

The bottom POI image section has an Image heading. Image synchronization replaces the heading and image together, avoiding duplicates and removing both when the image is cleared.

On scenes with Scene Tools Map POI enabled, the Notes layer stays visible and interactive on every client across layer switches, regardless of the client's notes-display toggle. Native per-note journal/page permissions and line-of-sight checks remain intact. Disabling POI or viewing another scene restores the client's normal visibility behavior; no personal settings are rewritten. Verified against cached Foundry 12.343 source and automated fixtures, not live multiplayer.

- City Icon controls in new-pin and edit-note forms now show a compact current-icon image and Choose icon button. The categorized picker starts closed, opens on demand, and closes after selection while updating the preview and existing form fields.

- The default Map POI journal template includes an Image heading above Description. Opening/reusing the module default template adds the section if missing while preserving its existing content.

- GMs can right-click a POI pin on enabled scenes to allow/remove all players' read access or edit the pin. The POI manager has the same permission toggle on each row. Linked-page permissions change independently of sibling pages, using native Observer/None ownership; explicit player grants are updated and GM grants preserved. Notes without a linked page use their journal permissions. Hover previews follow native linked-page access and close when permissions change.

- POI manager rows support multi-selection and Select all. Style selected applies icon size/color, font family/size/color, text anchor, global visibility, hover preview, and hover headings through native batch Note updates. Fields default to Unchanged; only chosen fields and selected pins are updated. POI images and journal/page links are preserved. GM-only on enabled scenes.

- POI context menus open after right-button release and its native context-menu event, rather than on pointer-down. A normal right-click leaves the menu available for a left-click action; holding the button is unnecessary.

- On POI-enabled scenes, GM Note configuration uses one Scene Tools editor instead of Basic/Scene Tools tabs. Location and journal links remain native controls; city/custom icon, appearance, image, and hover settings appear together. Duplicate native appearance controls are hidden while retained for native form submission. Other scenes retain Foundry's editor.

- The unified POI editor places Icon on the left and compact Location controls on the right, with X/Y coordinates sharing one row. Original coordinate inputs and native save behavior are preserved.

- Icon settings now contain Text label followed by Journal Entry/Page. Location keeps coordinates, elevation, sort, and a single-line Globally Visible label. The appearance preview renders icon and text at half scale without changing saved sizes.

- The bulk POI editor lists the selected pin names on the left and compact edit controls on the right. City icon selection is removed from bulk editing; each pin retains its icon artwork.

- Choose icon opens a separate native dialog in both POI create and edit forms. Selecting an icon closes the popup and updates the compact preview; closing without a selection preserves the existing icon.

- New POIs now use the same native NoteConfig-based Scene Tools layout as editing, including appearance preview, popup icon picker, coordinates/elevation/sort, POI image, and hover heading controls. New forms start from saved defaults and display the automatic journal/page destination. Submit creates the POI page and pin; cancelling creates neither. Creation saves custom images and per-pin hover headings immediately.

- Foundry's Create Map Note tool opens the shared Scene Tools POI creation form for GMs on POI-enabled scenes, preserving native grid-centered placement. Other tools and disabled scenes retain native behavior.

- On ST POI-enabled scenes, note icons and labels stop growing above 100% canvas zoom. Their configured icon/font sizes are the screen-size cap; zooming out still shrinks them. Rendering and hit targets scale together without changing saved sizes or map positions. Applies on every client and restores normal scaling when ST POI is disabled.

- POI hover cards match the native Players panel's translucent canvas UI surface, including its texture, background alpha, border, and text color. Text and images remain fully opaque; window-content backgrounds and extra opacity layers are removed.

- POI hover backgrounds add a modest opaque dark blend beneath the native texture for readability (native 50% opacity becomes 65%). Text and image opacity remain unchanged.

- Quick Scene Importer shared settings use compact wrapping rows for lighting/vision and grid appearance, with narrower numeric fields and single-line labels. The sticky footer uses the CPR window surface instead of a hard-coded light fallback, removing the white strip in dark mode.

- Quick Scene Importer inputs and dropdowns now inherit native Foundry/CPR theme styling. Removed custom enabled/disabled colors, backgrounds, borders, focus outlines, and disabled-fieldset styling that conflicted with dark-mode option menus. Layout sizing remains scoped to Quick Scene Importer.

- Quick Scene Importer and Artwork Editor UI surfaces use native theme colors: removed gray preview fills and selected-row fills, restored native artwork category/seat button styling, and changed panel separators to native border tokens. Selection uses inherited-color outlines/accents. POI hover styling and scene preview grid/wall/light indicators are unchanged.

- Quick Scene Importer recognizes pixel-density filename hints such as 140ppi, 140_PPI, 108pixels, and DPI/px variants. A companion file named Grid Offset 108 (with or without an extension/unit suffix) suggests a 108-pixel grid for maps in that same folder; it does not shift the image. Imported grid settings take priority, followed by map filename hints. Conflicting companion sizes are ignored, and companion images are excluded from map variants. Grid choices identify filename/folder hints.

- Mook Maker disables Purge Unequipped Gear until Apply has successfully saved that token. A persistent token flag records successful Apply; failed Apply does not unlock Purge. The purge operation also enforces this guard with confirmation enabled or disabled. Mooks without a saved flag require Apply once.

### Repository audit reliability fixes

- Access-point batch actions and detail saves verify persisted values and report cancelled or partial writes instead of success.
- Hazard detection refreshes for wall creation, edits, and deletion in the viewed scene. Scene maintenance combines queued requests, skips unrelated Actor/Scene changes, scopes Actor cleanup to affected scenes, and indexes hazards and tokens during effect cleanup.
- Modular controls and the picker ignore changes in other scenes and combine repeated refresh requests. Undo still checks scene contents before restoring; ordinary UI refreshes reuse availability instead of repeatedly cloning the scene.
- Regression fixtures reflect the saved-Mook requirement and current foreground selector; the standard browser runner includes access-point type management.

- Quick Scene Importer grid-color pickers default to black, including when a companion Scene JSON specifies red or another color. Individual and shared custom color selections remain available.

### Map pin journal access

- Managed POI images no longer force JSON journal exports back to HTML: text remains in named sections, and a separate page image object exposes src/alt. Import recreates the image block and synchronizes its Note image path.

- Map POI Defaults includes template journal selection, Edit selected journal, Use default template, and hover-field choices in the same form as pin appearance. Removed the separate Journal Template dialog and redundant image/description page selectors. One Save persists appearance and template defaults; hover choices reflect all template pages and refresh when journal text changes.

- Journal Template guidance explains editing template headings, new-POI-only changes, page-level permissions, and where to find JSON import/export; removed the obsolete GM-secret-section introduction.

- Editable JSON journal pages support `sections: {"Description": "Text", "Factions": "Text", "NPCs": "Text"}` alongside page key/data. Import converts plain text into headings and paragraphs. Simple pages export in this form; complex HTML and secrets retain native text content. Ambiguous pages supplying both formats are rejected before writes.

- Map POI manager includes Export JSON and Import JSON for all scene Notes and their linked journals/pages. Files are indented, manually editable JSON; import adds fresh documents and remaps Note/hover page links without overwriting existing content. Native artwork paths and default permissions are retained; user-specific grants and media files are not transferred. See [format and example](docs/map-pin-transfer.md).

- Pan to Note is inserted above each linked POI journal page without changing saved journal content. The associated Note is resolved on click. Players on another scene receive a message without moving their view; GMs view the destination scene first. Current-scene players must have journal access and a visible Note. Missing Notes produce a message.

- Upgrade cleanup removes GM Notes from existing module-created default POI templates on active-GM world startup and before template use. Other sections are retained; custom unflagged templates and existing scene POI journals are untouched. Repeated cleanup makes no further writes.

- On enabled Map POI scenes, right-click offers Open Journal to GMs and players with read access. Permission and Edit POI actions remain GM-only.
- Double-click on the Token layer opens the linked journal page for GMs and players. Double-click on the Journal Notes layer opens Note configuration for authorized editors. Journal permissions are rechecked when opening, and the hover hint reflects the active layer.
- Automated browser fixture coverage; live Foundry verification pending.

### Vehicle promotion

- GM vehicle configuration includes Promote for unlinked SceneTools vehicles. Confirmation saves pending edits, creates an Actor under SceneTools/Promoted Vehicles, and links the placed token to it.
- The permanent Actor preserves current stats and equipment. Its prototype retains vehicle provenance, artwork/scale, dimensions, rotation, pivot, and local/default seat layouts, so subsequent drops remain functioning vehicles. Template identity and scene-specific position, visibility, rider assignment, and patrol state are excluded from the prototype.
- Promoted vehicles remain configurable: stats and player permissions affect the linked Actor; artwork and seat placement edits affect the placed token. Promotion captures the prototype setup at promotion time. Failed linking removes an unused newly created Actor.
- Validated with automated fixtures and build checks; live Foundry and multiplayer verification remain pending.

### Vehicle configuration layout

- Vehicle HUD buttons match the rendered native HUD button dimensions, margins, and icon size. Seat SVG and car/gear artwork scale with native icons. Vehicle HUD settings offer Native or Custom icon colors, plus Match to Combat Tools when that module is active.

- Patrol controller widget saves its position per world/user in browser storage as it moves, restores it when reopened, and clamps restored coordinates to keep the header accessible. Session memory remains available if browser storage is blocked.

- Patrol editor also uses Mook Maker compact form styling: green settings, blue recent operations, gold waypoint panels, compact labeled rows, and aligned footer actions.

- Vehicle configuration reuses Mook Maker's compact form and section styles, label typography, row separators, and action-button layout. Promote uses the same gold button and hover/focus colors as Mook Maker.

- MookMaker places Cancel on the left and Apply on the right. Its dialog fits the form without an unused native footer; vertical scrolling remains available when the window is constrained. Automated browser layout checks only; live Foundry verification pending.
- Vehicle configuration shows an Artwork Category pick list above compact stats on the left, with a live artwork/seat preview on the right. Category entries include token width, height, and defined seat count. MookMaker uses the same Artwork Category label.
- The preview includes a footprint grid, manual image/video selection, editable token width/height and artwork scale, and inline seat placement, naming, removal, and alignment snapping. Save applies the previewed image and local seat edits; template-save controls are omitted.
- New vehicle templates use a basic top-down car outline. Existing templates keep their artwork.

- Vehicle configuration preview includes one extra grid square on every side of the footprint. Seat alignment independently snaps X and Y within five percentage points of artwork dimensions, regardless of preview size; Shift and the Snap checkbox still bypass alignment.

- GM vehicle HUD includes a Player Control toggle with an active state and Enable/Disable tooltip. It grants or removes player ownership on that unlinked vehicle only, preserving GM permissions and source templates.

- Vehicle configuration seat rows show name, trash icon, current rider, and Enter/Eject. Enter opens a scene-character picker and explicitly saves pending vehicle edits before boarding; cancel leaves the draft untouched. Eject uses normal exit rules, and occupied seats cannot be deleted.

- Vehicle Enter/Exit HUD uses a side-view bucket-seat silhouette with a separate headrest, reclined back, cushion, and mounting rail, inheriting the native HUD icon color.

- Vehicle HUD always opens its seat list, including without a selected character. Occupied seats show a muted rider name and disabled entry; the chosen passenger gets Exit on their current row. Seated-character HUD opens the same list. Enter on an empty seat switches an existing rider within the same vehicle, preserving their original exit appearance and rejecting occupied destinations.

- Player boarding requires the character footprint to touch or overlap the vehicle footprint (corners count, with one-pixel rounding tolerance). The authoritative seat request checks proximity; GMs bypass it. Existing riders may switch seats and exit normally.

- Vehicle configuration uses three columns: filterable Artwork Category table (Name, Footprint, Seats), stats and seat controls, and a separate far-right grid preview. Category and seat lists scroll independently when long; the dialog fits its content without an unused native footer.

- Vehicle editor category headers inherit native table colors. Snap controls and placement instructions sit below the far-right preview; Place a new seat follows the existing seat rows.

- Vehicle configuration uses a Players Can Drive checkbox reflecting current player permissions. Checking or clearing it immediately enables or disables player control; failed updates restore the displayed permission state.

- Vehicle editor Artwork Category, Stats, Seats, and Preview panels reuse Mook Maker section styling: blue/green/gold tints, compact legends, and accent borders. Players Can Drive sits inside Stats.

- Vehicle configuration supports native window resizing with the bottom-right resize handle.

- Replacing vehicle artwork warns before discarding an existing seat setup or pending artwork/footprint/scale edits, including saved local seat layouts. Confirmation defaults to No; cancellation preserves the category, preview, and draft. Selecting the current category does nothing. Manual artwork replacement uses the same guard.

- Vehicle scale uses a native range slider with a live multiplier. Preview shows a contrasting dashed token-footprint outline that remains fixed while artwork scale changes; the outline never intercepts seat clicks.

- Vehicle editor height grows with the seat list, with its scrolling threshold calculated from the viewport and rendered stats/footer height. Adding/removing seats or changing artwork recalculates the fit; native manual resizing remains available.

- Vehicle replacement confirmation compares actual seat names/positions and footprint/scale against the loaded setup (or selected category defaults), rather than warning merely because seats exist or a category was selected. Reverted edits do not warn. Tab and Shift+Tab retain browser focus navigation instead of reaching native Dialog/game keyboard handlers.

- Enter/Exit HUD opens an inline seat panel inside the token HUD, using Combat Tools panel palette tokens with standalone fallbacks. It shows occupancy and current-passenger Exit, supports seat switching, and closes on the seat icon, outside click, Escape, or HUD replacement. No Vehicle Seats application window is created by the HUD.

- Inline vehicle HUD uses dedicated compact markup rather than a native form: whole-row Enter targets, muted occupied rows with rider names, and Exit only for the selected rider. Explicit inherited text colors and bounded row widths prevent native HUD form sizing from clipping controls or creating horizontal scrolling.

- Vehicle HUD seat list matches CTH menu spacing and action styling: bordered heading, 24px seat/action icon columns, transparent borderless rows, and compact icon-only exit controls with accessible labels.

- Vehicle HUD seat menu uses plain Enter/Exit text without seat/action icons, normal font weight, and the native primary UI font.

- Players use their single currently selected owned character token for vehicle entry, switching, and exit. No passenger dropdown or automatic fallback to another owned character is shown. Actions recheck selection; missing/ambiguous selection prompts the player. GMs retain the dropdown.

## Patrol

- Movement verification and subsequent path segments use committed token coordinates rather than animation-interpolated coordinates. Occupancy considers both saved and currently displayed footprints. Regression fixtures distinguish animation lag from genuinely cancelled moves; live retest pending.

- GM Token Controls > Patrol offers Loop, Back & Forth and Random. Loop/Back & Forth share optional waypoint pause ranges, optional path pauses with a movement-time interval and separate pause range, and optional side tracks with a maximum deviation distance. This supersedes Ordered/Wandering route choices and individual stop pauses.
- Region roaming retains its destination during travel and replans around new obstructions using checked adjacent directions. Native collision preflight supplements footprint checks. Unrelated flags no longer reset route progress. Random sampling prefers trips of at least four grid spaces or half the longest Region dimension, whichever is larger when available, retaining shorter fallbacks in small Regions.
- Map-click waypoint placement with numbered previews, coordinate editing and reordering/removal. Random exposes favor-distant-locations, maximum movement time (0 = unlimited) and a pause range. All modes share movement speed. Timed pauses defer until the stopping footprint is clear.
- Full-footprint wall routing and Region containment; tokens can pass through each other but reserve clear destinations and recheck occupancy before dwelling. Invalidated paths are replanned and unavailable destinations wait/retry.
- Saved token flags, Start/Stop/Stop scene controls, active-GM authority, viewed-scene execution, pause during started scene combat/game pause, and manual-move invalidation. Actor/prototype data is untouched. Conservative 2D walls; no directional-wall traversal or wall-height extension support.
- Local implementation and automated fixtures; live Foundry/multiplayer verification pending. See [Patrol usage](docs/patrol.md).

- Region roaming uses up to one-second linear travel segments with 25 ms scheduling checks; saved arrival pauses are preserved. Live animation smoothness remains unverified.

### Vehicle Patrol

- SceneTools-stamped vehicles use eight-heading driving with half-grid positioning on square/gridless scenes. Moving turns allow up to 90 degrees, with a route-cost preference for 45-degree turns; retained heading-aware A* favors forward travel and supports reverse maneuvers when needed. Blocked routes wait.
- Conservative body/turn/footprint clearance, pedestrian obstacles, and in-flight passage reservations prevent Patrol-issued crossings involving vehicles; pedestrians still cross one another. Own passengers are excluded and existing seat synchronization is reused.
- Vehicle editor guidance explains facing/rotation requirements, snapped waypoint positions, and step-boundary pauses. Pedestrian side tracks are hidden for vehicles. Planning is limited to one vehicle per tick with bounded searches and delayed retries.
- Automated geometry/runtime/editor validation only; live vehicle animation, multiplayer, seat rendering and crowded-scene performance remain pending. See [Patrol limits](docs/patrol.md).

- Hazard effect cards (local/unreleased): shared Combat Tools button styling now includes hazard approvals and effect actions. New direct-damage effects require sceneEffects API v4 and reuse native CPR damage rolls, Combat Tools recorded-target application/Shift-click options, and embedded native damage receipts/Undo. GM approval, per-target avoidance, shared rolls, stale-source validation and effect cleanup remain enforced. Generic MOVE/status effects keep their provider workflow. Live Foundry verification pending.

- Vehicle Patrol provides an Artwork front selector in 90-degree increments, independent of artwork rotation and footprint geometry. Blocked destinations now use safe partial approaches for both vehicles and pedestrians, retain their original destination, and retry without advancing waypoint order. Partial stopping points have separate reservations so approaching a reserved waypoint does not steal it.

- Stuck vehicle maneuvers can fall back to stationary 45-degree turns when forward/reverse planning cannot make progress. Full-body turn clearance and swept-area reservations still apply; rotations are retained as explicit animation steps and must unlock onward travel. Pure spinning without progress is rejected.

- Vehicle Patrol wall tolerance allows up to a quarter grid square of clipping per side, with a nonzero core for small vehicles. Only the wall sweep shrinks; vehicle/token collisions, reservations, Region/scene bounds and native movement checks remain unchanged. Tests cover narrow passages, closed-wall crossings, full token clearance and unchanged saved vehicle dimensions.

### Scene Patrol controller

- Token toolbar labels: Scene Tools - Patrol and Scene Tools - Access Points. Patrol opens a compact semi-transparent controller using the VisualTools Soundboard panel styling, listing all configured scene tokens with clickable patrol-name Start/Stop toggles and pencil-icon Edit controls.
- The top scene Start/Stop toggle persists a separate scene-level pause. It never changes individual patrol enablement; stopped patrols remain stopped after scene restart and reload. The editor Stop scene control uses the same pause. Controller rows/statuses refresh while open and close on scene teardown.
- Local runtime and browser fixture validation passed; live Foundry visual/multiplayer verification remains pending.

- Patrol editor uses two columns: token, speed, pause controls, mode and detected vehicle/artwork front on the left; the last eight operations and a compact waypoint list with Place Waypoints on the right. History is temporary on the GM client that records it, refreshes while open, and clears on scene teardown. Existing independent pause ranges and automatic vehicle detection are preserved. Automated validation only; live Foundry verification pending.

- Patrol controller is 160 px wide by default, with tight spacing and a 22 px edit button. Long names/statuses truncate with full text on hover. Patrol names toggle individual Start/Stop, with status beneath the name and an adjacent pencil edit icon. The scene toggle uses the same semi-transparent button style; Configure patrol is removed. Scene pause continues to preserve individually stopped patrols.

- Vehicle Patrol permits moving 90-degree turns with an extra route cost equivalent to three grid spaces, favoring modestly longer routes with 45-degree turns. Intermediate body clearance is checked across the full turn. Stationary fallback still turns in 45-degree steps.

- Vehicle wall clearance now follows movement and rotation in swept intervals of at most 7.5 degrees, instead of applying the largest turning footprint to the entire move. Planning and the final movement guard use the same checks. Existing wall-edge tolerance, full-body token/Region/bounds checks and passage reservations remain enforced. Automated regression coverage includes turning away from a wall; the reported live scene still needs verification.

- Vehicle pathfinding rewrite: retained heading-aware A* with a priority queue replaces short searches that returned greedy partial approaches. Search slices target 8 ms / 256 states, one per tick with fair scheduling, and a 40,000-state total cap. Half-grid positioning and whole-grid moves share the same graph; reversing no longer has a three-step cap. Moving 45-degree turns are preferred over 90-degree turns; stationary turns have a high cost. Wall collision uses swept oriented chassis geometry with up to a quarter grid square of edge clipping per side and a nonzero core, independent of empty diagonal selection-box corners. Full native/body footprints still govern token, Region and scene-bound checks. The planner, final write guard, arrival-heading checks and swept movement reservations agree. Patrol supplies explicit center-preserving position/size/rotation updates, so manual vehicle rotation behavior is unchanged. Static geometry edits invalidate retained searches; dynamic movement is rechecked before each step. This supersedes earlier three-phase, whole-grid and whole-maneuver rectangle routing. Automated checks only; the reported live scene remains unverified.

- Vehicle Patrol retains planned routes during internal rider position synchronization, avoiding repeated planning pauses after turns. Boarding/exiting and manual movement still invalidate plans; live step collision checks remain active. Automated regression coverage only; live Foundry verification pending.

- Hazard attack/effect links now navigate to and highlight the existing card in chat instead of opening an empty ChatMessage sheet. Unloaded older cards report that chat history must be loaded first.

- Modular tile browser uses generated WebP still thumbnails with a maximum 160-pixel edge for images and videos. Two concurrent generators cache the thumbnails and original dimensions in this browser across reloads (session-only if browser cache storage is unavailable). Initial generation reads originals once; preview/placement retain original paths. Refresh regenerates the collection thumbnails. Failed thumbnails remain placeholders, without loading originals into the thumbnail grid. Browser fixture verification covers still/video generation, persistent reuse, refresh and placement; live Foundry performance remains unverified.

- A deleted selected POI template no longer blocks new pins: the default template is recreated/reused and selected with fresh page references. Existing templates and POI pages remain unchanged. The new default has no empty Image heading; a selected POI image is appended at the bottom.

- Hazard validation errors identify the scene, hazard, and invalid list field instead of a generic Invalid links message. Invalid saved data remains unchanged.
