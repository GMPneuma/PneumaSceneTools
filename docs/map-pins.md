# Scene Tools Map POI

1. Open Scene configuration, enable **Scene Tools Map POI**, and save.
2. In **Journal Notes** controls, click **Scene Tools Map POI** to open the manager. It lists every pin on this scene, including ordinary Foundry notes. The scene-directory context action opens the same manager.
3. Choose **Map POI Defaults**, then **Journal template & hover layout**. Use the supplied template or select a world Journal Entry. All pages are copied. Select the image page and Description text page. **Hover fields** lists the page's section headings as checkboxes; select the fields to display beside the image. Description always appears below.
4. Set default icon size/tint, font family/size, text color/anchor, global visibility, and hover switch, then click **Save defaults**. Visual defaults also apply to native new pins on enabled scenes. Icon artwork is chosen per pin; existing pins remain unchanged.
5. Choose **Place pin on map**, then click where the pin belongs. Press Escape to cancel placement. The creation form opens with the clicked coordinates and saved defaults. Add a name and create the pin. Closing without saving creates nothing. Use native Select Notes to move existing pins.

The same **Map POI Defaults** screen is available in **Configure Settings → Pneuma Scene Tools → Map POI → Configure Map POI Defaults**. It can be used before opening or enabling a scene.

Each new pin receives an independent journal under the Journal directory's `SceneTools / Scene Name` folder. The default template is private and stored directly under the Journal `SceneTools` root. Location copies grant players view-only access, while GMs can edit. Extra template pages, formatting, and order are preserved. Template changes affect future pins only.

The pin list provides native configuration, pan, journal opening, and pin deletion. Deleting a pin keeps its journal. Editing any normal pin on an enabled scene shows **Basic** and **Scene Tools Map POI** tabs for GMs. Basic holds Foundry's original fields. The Scene Tools tab contains the city icon picker, hover image/text page mappings, heading selection, and hover switch. Both tabs use Foundry's Save button. Changing the linked journal immediately refreshes the preview-page choices and clears the old mappings; select the desired pages before saving. Editing or cancelling an ordinary pin does not create or replace its journal.

On the Description page, use a **Description** heading for the main text and other headings for fields such as **Faction**, **NPC**, and **Plot Point**. Each heading, at any level, defines a section through the next heading. The hover card places the image at top left, checked fields at top right, and the full Description section across the bottom. Pages without headings display their full content as Description. Selecting no extra fields keeps the image and Description.

Hover cards read the journal's current content. Journal and individual page permissions are checked, and players do not see unrevealed secret blocks. Move onto a long card to scroll through its full text; leaving the card dismisses it. Double-click the pin to open the journal. Native player note-display settings and journal visibility still apply. Globally Visible bypasses token vision, not journal permissions.

Disabling Scene Tools Map POI restores the ordinary workflow for that scene. Existing pins and journals remain. SceneTools must remain installed for its icon asset paths to resolve.

Validation: local data tests and rendered browser fixtures. Live Foundry v12 and multiplayer behavior still require verification.

- Compact hover layout: image widened by 10%; detail labels and values share rows to its right. Blank editor paragraphs do not stretch detail rows. Full Description text appears below without a repeated Description heading.

- City icon menus use expandable category folders, following the Combat Tools status-menu layout. Each expanded category shows compact icons with names; the selected category starts open. Picker artwork is white on a dark background; saved pin tint is unchanged. This replaces the category dropdown and search grid in creation, defaults, and native pin settings.

- Visual defaults include icon size/tint, font family/size, text color, and text anchor. New Scene Tools pins inherit them. Apply Visual Defaults in the native editor Scene Tools tab fills those Basic fields; the native Save button commits them. The icon choice, journal links, coordinates, and hover settings are preserved.

Map POI interfaces inherit Foundry/system theme colors. Defaults and creation use aligned native form rows with hex color fields and compact swatches; hover cards use native window surfaces. Pin previews retain configured colors and actual pixel size.
