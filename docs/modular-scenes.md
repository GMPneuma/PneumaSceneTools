# Modular Scene Creator

Open **Modular Scene Creator** in the Scenes directory. The active GM edits; players do not receive these controls.

1. Click **Modular Scene Creator** in the Scenes directory, enter a name, and choose **Create Scene**. A blank scene is saved under **SceneTools / Modular Scenes**, viewed locally, and given live tile controls.
2. Click **+ Place Tile** to open the picker. Add named folder collections with folder-plus if needed. The first tile sets the scene's dimensions; expansion is disabled until it is placed. Existing scenes and folders are retained.
3. Click **+ Place Tile** directly on an empty space in the live scene. Choose a Collection, then hover a small thumbnail to see the larger preview on the right and **Place Tile** over that thumbnail. Clicking the thumbnail immediately places it and keeps the picker open. Keyboard focus also previews; Enter activates placement. Collections may be mixed freely when their image dimensions match the scene's tile size.
4. Click **Edit Tile** on an occupied space. Its live controls provide **Replace Tile**, repeated 90-degree rotation in either direction, and confirmed removal. Replacement preserves rotation.
5. Use the four arrows at the scene edges to add a complete row or column. New spaces get their own Place Tile control. Controls follow canvas pan and zoom; offscreen expansion arrows stay within the viewport.
   The adjacent **minus** button removes that edge's outer row or column. Empty edges shrink immediately. If any placed Tiles intersect the removed strip, a confirmation warns how many will be deleted; Cancel keeps the scene unchanged. The final row and column cannot be removed. Shrinking left/top shifts remaining content back into alignment. Other document types are preserved and may end up outside the reduced scene bounds. Source image files are never deleted.
6. Click **Done Building** to regenerate and save the scene thumbnail, then remove the editing controls. If thumbnail generation or saving fails, the controls remain available for retry. Resume the viewed modular scene using **Modular Scene Creator** in the native Tiles toolbar. To resume another saved modular scene, view it first, then use the Tiles toolbar button.

This is a live canvas workflow, not a miniature layout editor. Its controls are client-side GM UI and are never saved as Tiles or other scene documents. They clean up on scene changes and canvas teardown, and restore after redraws of the same scene.

Canvas controls establish their positioning before being attached to the page, even if the module stylesheet has not loaded. They do not occupy space in Foundry's sidebar layout. Reload Foundry after updating the module to load its latest stylesheet and scripts.

Tiles are ordinary, locked, non-overhead Foundry Tiles. Add native walls, lighting, tokens, drawings, sounds, notes, templates, and Regions normally. Expansion shifts native contents and initial view coordinates to preserve their playable-area positions as padding changes; left/up expansion also moves them by one tile. Expansion uses one Scene update with automatic repositioning disabled.

Collection refresh rereads its folder. Removing a collection keeps its files and existing scene Tiles. The picker supports filename filtering and lazy thumbnails. Supported formats: AVIF, GIF, JPEG, PNG, SVG, and WebP.

The **Static** and **Animated** tabs sit above the three-column grid and filter by file extension. Static contains AVIF, JPEG, PNG, SVG, and WebP; Animated contains GIF, APNG, WebM, MP4, M4V, and OGV. Search applies within the selected tab. Video previews are muted and looping. PNG/WebP files remain in Static because this filter uses their extensions rather than inspecting animation frames.

Canvas buttons use a semi-transparent HUD-style background. The picker has three small image-only thumbnails per row on the left and a larger preview on the right. Filenames remain searchable but are not displayed as captions or hover tooltips. There is no separate Place Tile button. New scenes need only a name; the first placed tile determines their size. Folder loading begins after the picker renders, and operations unlock the existing controls before refreshing the window.

Square tiles provide the seamless workflow. Rectangular tiles preserve aspect ratio and fit inside their original space when rotated, leaving gaps on quarter-turns. Different image sizes are rejected. Grid size should match the publisher's pixels per square.

New scenes use 0.15 padding outside the playable area. Tile positions and live controls are relative to the playable area; padding never enlarges tile spaces. Resizing preserves alignment using Foundry’s playable-area origin. Keep scene dimensions unchanged in native Scene Configuration. Native manual Tile movement does not change its assigned space; rotation or replacement restores its assigned position. Limits: 400 spaces and 32,768 pixels per side. Expansion does not translate other modules' private coordinate flags.

Validation: TypeScript, document/geometry tests, and browser fixtures covering blank creation, on-scene placement, mixed collections, rotation, expansion, pan, resuming, and scene-switch cleanup. Fixtures simulate Foundry APIs; live Foundry/multiplayer verification is still pending.


- Picker remembers the last collection, Static/Animated tab, and each collection/tab scroll position locally for the current world and user, including reopening and reloads. It stays open after placement; click a canvas space to change its target. Done Building saves the thumbnail and closes the picker.
- Once the first tile establishes dimensions, incompatible or unreadable tiles are hidden. Show incompatible tiles displays them disabled. Dimensions are checked with four concurrent loads and cached while the picker is open; Refresh retries.
- One-step Undo restores the latest successful placement/replacement, rotation, removal, expansion, or shrink, including deleted edge tiles and translated native contents. There is no redo or multi-step history. Cancelled/no-op actions retain the previous step; outside changes to scene geometry or native contents invalidate it. Undo is session-only.

Automatic wall generation is not included. Use native Foundry wall tools. Existing scene walls remain native documents.
