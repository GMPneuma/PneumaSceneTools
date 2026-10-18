# Map pin JSON export/import

Open **Scene Tools Map POI** on an enabled scene, then click **Import / Export**. The dialog explains the custom SceneTools POI format and offers both actions. **Export JSON** downloads all scene Notes and the complete journals they link to, including all pages. **Import JSON** adds copies to the manager's scene and creates journals under **SceneTools/Imported POIs**. Existing documents are never overwritten. Importing twice adds two copies.

The file is ordinary, indented JSON. Edit it with a text editor. JSON requires double quotes and does not support comments or trailing commas. Keep `format` and `version` unchanged. `scene.name` is informational; it does not select the import destination or scale coordinates.

Journal and page `key` values are file-local identifiers. Each journal key must be unique; page keys must be unique within their journal. Notes reference these keys with `journal` and `page`. Import creates fresh Foundry IDs and remaps these links, including SceneTools hover image/description page references.

`data` contains native Foundry document fields. Common edits:

- Journal/page `name` and page `sections`, an object mapping heading names to strings containing plain text or HTML. Headings are created in the order written. Use `\n` within a string for additional paragraphs. Plain text becomes paragraphs; strings containing HTML retain their formatting.
- Note `text`, `x`, `y`, `iconSize`, `texture.src`, and `texture.tint`.
- Page `ownership.default`: `0` hides it from players; `2` grants read access; `-1` inherits the journal. Export omits world-specific user grants.

Images, audio, video, UUID links inside journal prose, and other external references are not packaged or rewritten. Supply these files and update paths/references for the destination world. Native Foundry document validation still applies during import. Invalid reference keys are rejected before any documents are created. Failed imports attempt to remove only their newly created documents and report any retained partial results.

Minimal editable example:

```json
{
  "format": "pneuma-scenetools-map-pins",
  "version": 1,
  "scene": { "name": "Night City" },
  "journals": [{
    "key": "locations",
    "data": { "name": "City Locations", "ownership": { "default": 2 } },
    "pages": [{
      "key": "market",
      "data": {
        "name": "Night Market",
        "type": "text",
        "ownership": { "default": -1 }
      },
      "sections": {
        "Description": "Add your information here.",
        "Factions": "Local fixers.",
        "NPCs": "Rogue, the market organizer.",
        "Contacts": "Vendor contact details.",
        "Services": "Weapons, food, and cyberware."
      }
    }]
  }],
  "notes": [{
    "journal": "locations",
    "page": "market",
    "data": {
      "text": "Night Market", "x": 800, "y": 600,
      "iconSize": 40, "global": true,
      "texture": { "src": "icons/svg/book.svg", "tint": "#ffffff" }
    }
  }]
}
```

Named `sections` belongs to each journal page, beside `key` and `data`. It is distinct from the Note's `flags.pneuma-scenetools.mapPin.sections`, which selects fields for hover previews.

Exports recognize heading levels 1–6, including headings with editor attributes. Plain paragraphs become text strings. Formatted content stays inside its named section, for example `"Details": "<p>Some <strong>bold</strong> text</p>". The image is a separate field on the page, beside `sections`:

```json
"image": {
  "src": "pchassets/Art/Businesses/Piesans/Piesans-Crop.png",
  "alt": "PieSan's"
}
```

Import recreates the bottom Image section. Managed POI images belong to the journal page; Note flags do not store a second image path. Ordinary Notes can retain their custom image override. Duplicate heading names retain `data.text.content` because an object cannot contain repeated keys without losing content. Existing HTML-format files still import. A page must use either `sections` or `data.text`, never both.

Section containers do not add visibility rules. Named sections import as ordinary journal text; player visibility is controlled by journal/page permissions only. Note hover fields export as comma-separated names, for example `"sections": "Factions, NPCs, Services"`. An empty array selects no extra fields; an empty string selects all. Headings containing commas use a JSON array to preserve their names.

Import validates hover selections and POI settings before creating documents. Pages are created in one batch per journal and Notes in one scene batch. Fresh IDs are assigned before writing, so returned order and partial cancellation cannot mislink pins or evade cleanup.
