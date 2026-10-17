import {HazardEditorView} from "./editor-view.js";
import {loadHazardEditorTemplates} from "./editor-templates.js";
import {validateHazardReadiness, type HazardIssue} from "./readiness.js";
import {HazardPopup} from "./editor-popup.js";
import {readEditorFields, readEffectFields} from "./editor-fields.js";
import {hazardVisibilityOptions, registerHazardVisibility} from "./visibility.js";
import {hazardsAvailable} from "./dependency.js";
import {MODULE_ID} from "../settings.js";
import {escapeHTML as esc} from "../netarch/model.js";
import {type Trigger, blankAction, blankTrap, exportPresets, parsePresets, portableTrap, validateTrap, type TrapAction, type TrapConfig, type ActionKind} from "./model.js";
import {type Hazard, sceneHazard, deleteHazard, hazardDeletionDocuments, findHazard, hazardForRegion, ensureRegionHazard, triggerRegion, hazardIssues, locateHazard, setHazardRegionVisibility, gm, hazardActorTemplates, createHazardAccessPoint, presets, savePreset, saveTrap, trapData, traps, updateTrap} from "./documents.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "../world-folders.js";
import {enqueue, manualTrigger} from "./runtime.js";
import {chooseHazardStatus} from "./status-picker.js";
const openHazardEditors = new Set<() => void>();
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
function mount(dialog: FormApplication, html: JQuery, handler: (action: string, id: string, form: HTMLFormElement) => Promise<void>): void {
  const form = (html[0]!.matches("form") ? html[0] : html[0]!.querySelector("form")) as HTMLFormElement;
  let busy = false;
  form.addEventListener("click", event => {
    const control = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!control || busy)
      return;
    busy = true;
    control.disabled = true;
    void handler(control.dataset.action!, control.dataset.id ?? "", form).catch(e => {form.querySelector("[role=alert]")!.textContent = errorText(e);})
      .finally(() => {busy = false; control.disabled = false; dialog.setPosition({height: "auto"});});
  });
}
function editableHazard(value: TrapConfig): TrapConfig {
  const t = validateTrap(structuredClone(value));
  t.check = "";
  t.dv = 0;
  t.targets = "all";
  return t;
}
export async function editTrap(initial?: Hazard, expandEditor = !!initial): Promise<void> {
  gm();
  const scene = initial?.parent ?? canvas.scene;
  if (!scene)
    throw Error("Open a scene first.");
  await ensureSceneToolsFolder("Actor", WORLD_FOLDERS.hazardActorTemplates);
  await loadHazardEditorTemplates();
  const configPath = `/systems/${game.system!.id}/modules/system/config.js`;
  const {default: systemConfig} = await import(configPath) as {
    default: {
      skillList: Record<string, string>;
    };
  };
  const skills = [...new Set(Object.values(systemConfig.skillList).map(key => game.i18n!.localize(key)))].sort((a, b) => a.localeCompare(b));
  new HazardEditor(scene, skills, initial, expandEditor).render(true);
}
class HazardEditor extends FormApplication {
  private get view(): HazardEditorView {return new HazardEditorView(this.scene, this.skillNames, this.draft, this.d, this.editorExpanded, this.presetFilesOpen);}
  private d: Hazard | undefined;
  private draft: TrapConfig;
  private presetFilesOpen = false;
  private editorExpanded: boolean;
  private renderIssues: HazardIssue[] = [];
  private selectedEffect = 0;
  private selectedPreset = "";
  private initialArmed!: boolean;
  private initialHP!: number;
  private savedDraft!: string;
  private activePopup?: FormApplication;
  constructor(private readonly scene: Scene, private readonly skillNames: string[], initial?: Hazard, expandEditor = !!initial) {
    super({});
    this.d = initial ?? traps(scene)[0];
    this.draft = editableHazard(this.d ? trapData(this.d) ?? blankTrap() : blankTrap());
    this.editorExpanded = expandEditor;
    this.rememberSavedDraft();
    this.options.width = Math.min(expandEditor ? 1040 : 320, window.innerWidth - 40);
    openHazardEditors.add(this.documentChanged);
  }
  static override get defaultOptions(): FormApplication.Options {
    return {...super.defaultOptions, title: "Scene Tools - Hazards", template: "modules/pneuma-scenetools/templates/hazard-editor.hbs", classes: [...super.defaultOptions.classes, "hazard-native-panel"], width: 1040, height: "auto", resizable: true, closeOnSubmit: false, submitOnChange: false};
  }
  override getData() {return this.content();}
  protected override async _updateObject(): Promise<void> {
    if (this.form instanceof HTMLFormElement)
      this.capture(this.form);
    gm();
    await this.persist();
    this.refresh();
  }
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    (html[0]!.closest(".window-app") ?? html[0]!).classList.add("hazard-native-panel");
    mount(this, html, this.handleAction);
    const form = (html[0]!.matches("form") ? html[0] : html[0]!.querySelector("form")) as HTMLFormElement;
    const mark = (field: string, message?: string, index?: number) => {
      const root = index === undefined ? form : form.querySelector(`[data-effect-index="${index}"]`);
      const control = root?.querySelector<HTMLElement>(field === "actions" ? '[data-action="add"]' : `[name="${field}"]`);
      const group = control?.closest<HTMLElement>(".form-group, .hazard-token-icon") ?? control;
      if (group) {
        group.classList.add("hazard-required");
        if (message) {
          group.classList.add("hazard-invalid");
          group.title = message;
          control?.setAttribute("aria-invalid", "true");
        }
      }
    };
    for (const field of ["name", "actions"])
      mark(field);
    const selected = this.draft.actions[this.selectedEffect];
    if (selected) {
      const field = ({damage: "formula", movePenalty: "formula", status: "status", spawnCondition: "actorTemplateId", attack: "weapon", triggerHazard: "hazardId"} as Partial<Record<ActionKind, string>>)[selected.kind];
      if (field)
        mark(field, undefined, this.selectedEffect);
    }
    for (const {message, field, effectIndex} of this.renderIssues)
      mark(field, message, effectIndex);
    html.find('[name="formula"], [name="weapon"], [name="status"], [name="actorTemplateId"], [name="hazardId"]').on("change", () => {this.capture(form); this.refresh();});
    html.find('[name="hazardActorTemplateId"]').on("change", () => {
      this.capture(form);
      const template = hazardActorTemplates().find(actor => actor.id === this.draft.hazardActorTemplateId);
      if (template)
        this.draft.tokenIcon = template.prototypeToken?.texture.src || template.img || this.draft.tokenIcon;
      this.refresh();
    });
    html.find('[name="apType"], [name="hazardTrigger"], [data-effect-index] [name="kind"], [data-effect-index] [name="actorId"]').on("change", () => {
      try {
        this.capture(form);
        this.refresh();
      }
      catch (error) {
        html[0]!.querySelector('[role=alert]')!.textContent = errorText(error);
      }
    });
    this.fitCompactPanel();
  }
  override async close(options?: Application.CloseOptions): Promise<void> {
    await this.activePopup?.close();
    openHazardEditors.delete(this.documentChanged);
    await super.close(options);
  }
  private readonly actions: Record<string, (id: string, form: HTMLFormElement) => Promise<void>> = {
    toggleEditor: () => this.toggleEditor(),
    add: (id: string) => this.editEffect("add", id),
    editEffect: (id: string) => this.editEffect("editEffect", id),
    editTriggers: () => this.editTriggerSelection(),
    remove: (id: string) => this.removeEffect(id),
    moveUp: (id: string) => this.moveEffectUp(id),
    save: () => this.saveDraft(),
    deleteHazard: () => this.deleteSelectedHazard(),
    toggleActivated: (id: string) => this.toggleActivated(id),
    activate: () => this.triggerSelectedHazard(),
    presetFiles: () => this.togglePresetFiles(),
    tokenIcon: () => this.chooseTokenIcon(),
    createAP: () => this.createAccessPoint(),
    bodySheet: () => this.openActorSheet(),
    reveal: (id: string) => this.setActorVisibility(id),
    regionVisibility: (id: string) => this.setRegionVisibility("regionVisibility", id),
    playerRegionVisibility: (id: string) => this.setRegionVisibility("playerRegionVisibility", id),
    locate: (id: string) => this.locateSelectedHazard(id),
    newHazard: () => this.startNewHazard(),
    selectScene: (id: string) => this.selectHazard(id),
    load: () => this.loadPreset(),
    presetSave: () => this.saveSelectedPreset(),
    export: () => this.exportSavedPresets(),
    presetDelete: () => this.deleteSelectedPreset(),
    import: (_id: string, form: HTMLFormElement) => this.importPresets(form)
  };
  private handleAction = async (action: string, id: string, form: HTMLFormElement): Promise<void> => {
    gm();
    this.capture(form);
    if (Object.hasOwn(this.actions, action)) await this.actions[action]!(id, form);
  };
  private async toggleEditor(): Promise<void> {
    this.editorExpanded = !this.editorExpanded;
    this.refresh();
  }

  private async editEffect(action: string, id: string): Promise<void> {
    const body=this.scene.tokens.get(this.draft.bodyId);
    const template=foundry.utils.getProperty(body??{},`flags.${MODULE_ID}.hazardActorTemplateId`)??"";
    if(!body?.actor||template!==this.draft.hazardActorTemplateId){
      await this.persist();
      this.refresh();
    }
    const index = action === "add" ? this.draft.actions.length : Number(id);
    const result = await this.editEffectPopup(action === "add" ? blankAction("damage") : this.draft.actions[index]!, index);
    if (result) {
      const current = this.element?.[0]?.querySelector<HTMLFormElement>('form');
      if (!current)
        return;
      this.capture(current);
      this.draft.actions[index] = result;
      this.refresh();
    }
  }

  private async editTriggerSelection(): Promise<void> {
    const result = await this.editTriggersPopup();
    if (result) {
      const current = this.element?.[0]?.querySelector<HTMLFormElement>('form');
      if (!current)
        return;
      this.capture(current);
      this.draft.triggers = result.triggers;
      this.draft.distance = result.distance;
      this.refresh();
    }
  }

  private async removeEffect(id: string): Promise<void> {
    this.draft.actions.splice(Number(id), 1);
    this.selectedEffect = Math.max(0, Math.min(this.selectedEffect, this.draft.actions.length - 1));
    this.refresh();
  }

  private async moveEffectUp(id: string): Promise<void> {
    const i = Number(id);
    if (i > 0)
      [this.draft.actions[i - 1], this.draft.actions[i]] = [this.draft.actions[i]!, this.draft.actions[i - 1]!];
    this.selectedEffect = Math.max(0, i - 1);
    this.refresh();
  }

  private async saveDraft(): Promise<void> {
    try {
      await this.persist();
      this.refresh();
      ui.notifications?.info("Hazard saved.");
    }
    catch (error) {
      this.refresh();
      ui.notifications?.error(errorText(error));
      throw error;
    }
  }

  private async deleteSelectedHazard(): Promise<void> {
    if (!this.d || !trapData(this.d))
      return;
    const source = this.d, apId = this.draft.apId, linked = hazardDeletionDocuments(source, apId);
    const names = [...linked.aps, ...linked.regions, ...linked.bodies].map(doc => `<li>${esc(doc.name ?? "Unnamed document")}</li>`).join("");
    const shared = traps(this.scene).some(h => h.uuid !== source.uuid && linked.regions.some(r => triggerRegion(h)?.id === r.id));
    if (!await Dialog.confirm({title: "Delete hazard", content: `<p>Delete <strong>${esc(trapData(source)!.name)}</strong> and its access point, trigger Region and owned hazard Actor?</p><ul>${names}</ul>${shared ? "<p>The trigger Region is also used by another hazard. That hazard will need a new Region.</p>" : ""}<p>Actor templates and target-only Regions are preserved. This cannot be undone.</p>`}))
      return;
    let failure: unknown;
    await enqueue(async () => {
      try {
        await deleteHazard(source, apId);
      }
      catch (error) {
        failure = error;
      }
    });
    if (failure) {
      this.refresh();
      throw failure;
    }
    this.d = traps(this.scene)[0];
    this.draft = editableHazard(this.d ? trapData(this.d)! : blankTrap());
    this.selectedEffect = 0;
    this.rememberSavedDraft();
    this.refresh();
    ui.notifications?.info("Hazard deleted.");
  }

  private async toggleActivated(id: string): Promise<void> {
    if (!this.d)
      throw Error("Select a saved hazard.");
    const saved = trapData(this.d)!, requested = id === "on";
    if (id !== "on" && id !== "off")
      throw Error("Invalid activation action.");
    if (requested && hazardIssues(saved, this.d).length)
      throw Error("Complete the hazard before activation.");
    await updateTrap(this.d, {armed: requested});
    this.draft.armed = requested;
    this.initialArmed = requested;
    const baseline = JSON.parse(this.savedDraft) as TrapConfig;
    baseline.armed = requested;
    this.savedDraft = JSON.stringify(baseline);
    this.refresh();
  }

  private async triggerSelectedHazard(): Promise<void> {
    if (!this.d)
      throw Error("Select a saved hazard.");
    if (hazardIssues(trapData(this.d)!, this.d).length || !trapData(this.d)?.armed)
      throw Error("Complete and activate the hazard before triggering it.");
    const source = this.d;
    enqueue(() => manualTrigger(source, canvas.tokens!.controlled.map(t => t.document)));
  }

  private async togglePresetFiles(): Promise<void> {
    this.presetFilesOpen = !this.presetFilesOpen;
    this.refresh();
  }

  private async chooseTokenIcon(): Promise<void> {new FilePicker({type: "image", current: this.draft.tokenIcon, callback: path => {this.draft.tokenIcon = path; this.refresh();}}).browse();}

  private async createAccessPoint(): Promise<void> {
    this.resetMissingReferences();
    const ap = await createHazardAccessPoint(this.scene, this.draft);
    this.draft.apId = ap.id!;
    this.refresh();
  }

  private async openActorSheet(): Promise<void> {this.scene.tokens.get(this.d ? trapData(this.d)?.bodyId ?? "" : "")?.actor?.sheet?.render(true);}

  private async setActorVisibility(id: string): Promise<void> {
    const body = this.scene.tokens.get(this.d ? trapData(this.d)?.bodyId ?? "" : "");
    if (!body)
      throw Error("Save the hazard first.");
    if (id !== "hide" && id !== "show")
      throw Error("Invalid hazard visibility action.");
    await body.update({hidden: id === "hide"}, hazardVisibilityOptions);
    this.refresh();
  }

  private async setRegionVisibility(action: string, id: string): Promise<void> {
    if (!this.d)
      throw Error("Select a saved hazard.");
    if (id !== "show" && id !== "hide")
      throw Error("Invalid Region visibility action.");
    const visibility = action === "regionVisibility" ? (id === "show" ? CONST.REGION_VISIBILITY.GAMEMASTER : CONST.REGION_VISIBILITY.LAYER) : (id === "show" ? CONST.REGION_VISIBILITY.ALWAYS : CONST.REGION_VISIBILITY.GAMEMASTER);
    await setHazardRegionVisibility(this.d, visibility);
    this.refresh();
  }

  private async locateSelectedHazard(id: string): Promise<void> {
    const source = findHazard(this.scene, id);
    if (!source)
      throw Error("Hazard no longer exists.");
    await locateHazard(source);
  }

  private async startNewHazard(): Promise<void> {
    if (!await this.discard())
      return;
    this.editorExpanded = true;
    this.d = undefined;
    this.draft = editableHazard(blankTrap());
    this.selectedEffect = 0;
    this.rememberSavedDraft();
    this.refresh();
  }

  private async selectHazard(id: string): Promise<void> {
    if (!await this.discard())
      return;
    const next = findHazard(this.scene, id);
    if (!next || !trapData(next))
      throw Error("Hazard no longer exists.");
    this.d = next;
    this.selectedEffect = 0;
    this.draft = editableHazard(trapData(this.d)!);
    this.rememberSavedDraft();
    this.refresh();
  }

  private async loadPreset(): Promise<void> {
    const preset = presets().find(p => p.name === this.selectedPreset);
    if (!preset)
      throw Error("Choose a preset.");
    if (!await this.discard())
      return;
    const bodyId = this.draft.bodyId;
    this.selectedEffect = 0;
    this.draft = editableHazard(portableTrap(preset));
    this.draft.bodyId = bodyId;
    this.refresh();
  }

  private async saveSelectedPreset(): Promise<void> {
    const name = this.draft.name.trim();
    if (!name)
      throw Error("Name the preset before saving.");
    if (presets().some(p => p.name === name) && !await Dialog.confirm({title: "Overwrite preset", content: `<p>Overwrite <strong>${esc(name)}</strong>?</p>`}))
      return;
    await savePreset(this.draft);
    this.selectedPreset = name;
    this.refresh();
  }

  private async exportSavedPresets(): Promise<void> {saveDataToFile(exportPresets(presets()), "application/json", "scene-tools-hazards.json");}

  private async deleteSelectedPreset(): Promise<void> {
    if (!this.selectedPreset)
      throw Error("Choose a preset.");
    if (await Dialog.confirm({title: "Delete preset", content: `<p>Delete ${esc(this.selectedPreset)}?</p>`})) {
      await game.settings!.set(MODULE_ID, "trapPresets", {presets: presets().filter(p => p.name !== this.selectedPreset)});
      this.selectedPreset = "";
      this.refresh();
    }
  }

  private async importPresets(form: HTMLFormElement): Promise<void> {
    const file = (form.elements.namedItem("presetFile") as HTMLInputElement).files?.[0];
    if (!file || file.size > 1000000)
      throw Error("Choose a JSON file smaller than 1 MB.");
    const incoming = parsePresets(await file.text()), saved = structuredClone(presets());
    if (saved.length + incoming.length > 200)
      throw Error("Import exceeds 200 presets.");
    for (const p of incoming) {
      const base = p.name;
      let n = 2;
      while (saved.some(s => s.name === p.name))
        p.name = base.slice(0, 110) + ` (${n++})`;
      saved.push(p);
    }
    await game.settings!.set(MODULE_ID, "trapPresets", {presets: saved});
    this.refresh();
  }
  private resetMissingReferences = () => {
    if (this.draft.triggerRegionId && !this.scene.regions.has(this.draft.triggerRegionId))
      this.draft.triggerRegionId = "";
    if (this.draft.apId && !this.scene.tokens.has(this.draft.apId))
      this.draft.apId = "";
  };
  private content = () => {
    this.resetMissingReferences();
    const view = this.view;
    const actorTemplates = hazardActorTemplates();
    const issues = validateHazardReadiness(this.draft, this.d ?? sceneHazard(this.scene, "draft"));
    this.renderIssues = issues;
    return {
      expanded: this.editorExpanded,
      sidebar: view.sidebar(),
      draft: this.draft,
      presetOptions: [["", "Choose preset"], ...presets().map(p => [p.name, p.name])].map(([id, name]) => ({id, name, selected: id === this.selectedPreset})),
      actorOptions: [{id: "", name: "Default hazard Actor", selected: !this.draft.hazardActorTemplateId}, ...actorTemplates.map(a => ({id: a.id!, name: a.name, selected: a.id === this.draft.hazardActorTemplateId}))],
      accessPoint: view.accessPoint(),
      triggerSummary: view.triggerSummary(),
      targets: view.targets(),
      effects: view.effects(issues),
      issues,
      canDelete: !!this.d && !!trapData(this.d)
    };
  };
  private capture = (form: HTMLFormElement) => {
    if (!this.editorExpanded)
      return;
    Object.assign(this.draft, readEditorFields(form));
    this.selectedPreset = (form.elements.namedItem("preset") as HTMLSelectElement).value;
  };
  private popup = <T>(title: string, body: () => object, read: (form: HTMLFormElement) => T, change?: (form: HTMLFormElement, action: string) => Promise<void>): Promise<T | null> => new Promise(resolve => {
    const child = new HazardPopup(title, body, read, change, result => {
      if (this.activePopup === child)
        this.activePopup = undefined; resolve(result);
    });
    this.activePopup = child;
    child.render(true);
  });
  private editEffectPopup = (original: TrapAction, index: number): Promise<TrapAction | null> => {
    let value = structuredClone(original);
    const read = (form: HTMLFormElement) => readEffectFields(form, value);
    return this.popup('Hazard effect', () => this.view.effectEditor(value, index), read, async (form, action) => {
      value = read(form);
      if (action === 'chooseStatus' && value.kind === 'status') {
        const selected = await chooseHazardStatus(value.status);
        if (selected !== null)
          value.status = selected;
      }
    });
  };
  private editTriggersPopup = () => {
    const value = structuredClone(this.draft);
    return this.popup('Hazard triggers', () => this.view.triggers(value), form => ({
      triggers: [...form.querySelectorAll<HTMLInputElement>('[name=hazardTrigger]:checked')].map(el => el.value as Trigger),
      distance: Math.max(0, Number(form.querySelector<HTMLInputElement>('[name=distance]')!.value) || 0),
    }));
  };
  private fitCompactPanel = () => {
    if (this.editorExpanded)
      return;
    const root = this.element?.[0], form = root?.querySelector<HTMLElement>('.hazard-editor-collapsed'), library = form?.querySelector<HTMLElement>('.hazard-library');
    if (!root || !form || !library)
      return;
    let width = library.offsetWidth;
    for (let element: HTMLElement | null = form; element; element = element.parentElement) {
      const style = getComputedStyle(element), horizontal = (keys: string[]) => keys.reduce((sum, key) => sum + (parseFloat(style.getPropertyValue(key)) || 0), 0);
      const inset = horizontal(['padding-left', 'padding-right', 'border-left-width', 'border-right-width']);
      width += inset;
      if (element === root) {
        if (style.boxSizing === 'content-box')
          width -= inset;
        break;
      }
      width += horizontal(['margin-left', 'margin-right']);
    }
    this.setPosition({width: Math.min(width, window.innerWidth - 40), height: "auto"});
  };
  private refresh = () => {
    this.render(false);
    if (this.editorExpanded)
      this.setPosition({width: Math.min(1040, window.innerWidth - 40), height: "auto"});
    else
      this.fitCompactPanel();
  };
  private discard = async () => JSON.stringify(this.draft) === this.savedDraft || await Dialog.confirm({title: "Unsaved hazard changes", content: "<p>Replace the unsaved draft?</p>"});
  private rememberSavedDraft(): void {
    this.initialArmed = this.draft.armed;
    this.initialHP = this.draft.hp;
    this.savedDraft = JSON.stringify(this.draft);
  }
  private persist = async () => {
    if (!this.d)
      this.d = sceneHazard(this.scene, foundry.utils.randomID());
    const current = trapData(this.d);
    if (current && (current.armed !== this.initialArmed || current.hp !== this.initialHP))
      throw Error("Hazard activation or HP configuration changed. Reopen before saving.");
    try {
      await saveTrap(this.d, this.draft);
    }
    catch (error) {
      const stored = trapData(this.d);
      if (stored) {
        this.initialArmed = stored.armed;
        this.initialHP = stored.hp;
      }
      throw error;
    }
    this.draft = editableHazard(trapData(this.d)!);
    this.rememberSavedDraft();
  };
  private documentChanged = () => {
    const form = this.element?.[0]?.querySelector<HTMLFormElement>('form');
    if (form)
      this.capture(form);
    const stored = this.d && trapData(this.d);
    if (stored && stored.armed !== this.initialArmed) {
      this.draft.armed = stored.armed;
      this.initialArmed = stored.armed;
      const baseline = JSON.parse(this.savedDraft) as TrapConfig;
      baseline.armed = stored.armed;
      this.savedDraft = JSON.stringify(baseline);
    }
    this.resetMissingReferences();
    this.refresh();
  };
}
export function openTraps(): void {void editTrap().catch(error => ui.notifications?.error(errorText(error)));}
export function registerTrapUI(): void {
  registerHazardVisibility();
  Hooks.on("updateToken", (_token: TokenDocument, changes: Record<string, unknown>) => {
    if (Object.hasOwn(changes, "hidden"))
      for (const refresh of openHazardEditors)
        refresh();
  });
  Hooks.on("updateScene", (_scene: Scene, changes: Record<string, unknown>) => {
    if (Object.keys(changes).some(key => key.startsWith(`flags.${MODULE_ID}.hazards`)) || foundry.utils.getProperty(changes, `flags.${MODULE_ID}.hazards`))
      for (const refresh of openHazardEditors)
        refresh();
  });
  for (const hook of ["createRegion", "updateRegion", "deleteRegion", "deleteToken", "createActor", "updateActor", "deleteActor"])
    Hooks.on(hook, () => {
      for (const refresh of openHazardEditors)
        refresh();
    });
  Hooks.on("getSceneControlButtons", (controls: SceneControl[]) => {
    if (!game.user?.isGM)
      return;
    for (const name of ["regions", "token"]) {
      const group = controls.find(c => c.name === name);
      group?.tools.push({name: "pneuma-traps", title: "Scene Tools - Hazards", icon: "fas fa-triangle-exclamation", button: true, onClick: () => openTraps()});
    }
  });
  if (!hazardsAvailable())
    return;
  Hooks.on("createRegionBehavior", (behavior: RegionBehavior) => {
    if (String(behavior.type) !== "pneuma-scenetools.trap") return;
    enqueue(async () => {
      const region = behavior.parent;
      if (region && game.user?.isGM && game.users?.activeGM?.id === game.user.id)
        await ensureRegionHazard(region);
    });
  });
  Hooks.on("renderRegionConfig", (app: {
    document: RegionDocument;
  }, html: HTMLElement) => {
    if (!game.user?.isGM || html.querySelector("[data-scene-tools-trap]"))
      return;
    const control = document.createElement("button");
    control.type = "button";
    control.dataset.sceneToolsTrap = "";
    control.textContent = hazardForRegion(app.document) ? "Configure hazard" : "Add Scene Tools hazard";
    control.addEventListener("click", () => {
      enqueue(async () => {
        const hazard = await ensureRegionHazard(app.document);
        await editTrap(hazard);
      });
    });
    html.append(control);
  });
}
