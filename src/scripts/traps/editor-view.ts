import {MODULE_ID} from "../settings.js";
import {accessPointTypes, typeImage} from "../netarch/types.js";
import {traps, trapData, triggerRegion, type Hazard} from "./records.js";
import {validateHazardReadiness, type HazardIssue} from "./readiness.js";
import {actionFormula, hasTrigger, type Trigger, type TrapConfig, type TrapAction, type ActionKind} from "./model.js";
import {hazardStatusChoices} from "./status-picker.js";

type Option = [string, string];
const triggerOptions: [Trigger, string][] = [["enter", "Enter / cross Region"], ["move", "Move within Region"], ["deviceTurn", "Hazard Actor's turn (target still in Region)"], ["turnStart", "Token in Region at start of turn"]];
const kinds: [ActionKind, string][] = [["damage", "Direct Damage"], ["movePenalty", "MOVE Penalty"], ["status", "Apply Status Effects"], ["spawnCondition", "Spawn Condition Instance"], ["attack", "Hazard Actor will attack"], ["triggerHazard", "Trigger another Hazard"]];
const options = (value: string, choices: Option[]) => choices.map(([id, name]) => ({id, name, selected: id === value}));
const input = (name: string, label: string, value: unknown, type = "text") => ({name, label, value, type, checkbox: type === "checkbox", number: type === "number"});
const select = (name: string, label: string, value: string, choices: Option[]) => ({name, label, select: true, options: options(value, choices)});
const button = (action: string, label: string, icon: string, id = "", disabled = false) => ({action, label, icon, id, disabled});
const toggle = (action: string, label: string, icon: string, id: string, pressed: boolean, disabled = false) => ({...button(action, label, icon, id, disabled), hasPressed: true, pressed});

/** Data only: templates own markup, escaping, and conditional attributes. */
export class HazardEditorView {
  constructor(private readonly scene: Scene, private readonly skillNames: string[], private readonly draft: TrapConfig,
    private readonly hazard: Hazard | undefined, private readonly expanded: boolean, private readonly presetFilesOpen: boolean) {}

  private skillCheck(action: TrapAction) {
    const choices: Option[] = [["", "None"], ...this.skillNames.map(name => [name, name] as Option)];
    if (action.resistSkill && !this.skillNames.includes(action.resistSkill)) choices.push([action.resistSkill, `${action.resistSkill} (saved)`]);
    return {skill: select("resistSkill", "Skill to avoid", action.resistSkill, choices), dv: input("resistDV", "DV", action.resistDV, "number")};
  }

  effectEditor(action: TrapAction, index: number) {
    const fields: object[] = [select("kind", "Type", action.kind, kinds.some(([kind]) => kind === action.kind) ? kinds : [...kinds, [action.kind, `Saved: ${action.kind}`]]), input("name", "Label / instructions", action.name)];
    let note: string | undefined;
    let status: {id: string; name: string; img?: string} | undefined;
    switch (action.kind) {
      case "triggerHazard":
        fields.push(select("hazardId", "Hazard to trigger", action.hazardId, [["", "Choose hazard"], ...traps(this.scene).filter(h => h.id !== this.hazard?.id).map(h => [h.id!, trapData(h)!.name] as Option)]));
        break;
      case "attack": {
        const actor = this.scene.tokens.get(this.draft.bodyId)?.actor;
        fields.push(select("weapon", "Weapon", action.weapon, [["", "Choose native weapon"], ...(actor?.items.filter(i => String(i.type) === "weapon").map(i => [i.name, i.name] as Option) ?? [])]));
        break;
      }
      case "spawnCondition":
        fields.push(select("actorTemplateId", "Template Hazard Actor", action.actorTemplateId, [["", "Choose Actor template"], ...(game.actors?.filter(a => ["mook", "character"].includes(String(a.type))).map(a => [a.id!, a.name] as Option) ?? [])]));
        note = "Spawns an unlinked mini token attached to each target, using the template's HP and active effects.";
        break;
      case "damage": {
        const choices: Option[] = [["", "Choose dice"], ...Array.from({length: 9}, (_, i) => [`${i}d6`, `${i}d6`] as Option)];
        if (!/^([0-8])d6$/.test(action.formula) && action.formula) choices.push([action.formula, `Saved: ${action.formula}`]);
        fields.push(select("formula", "Damage", action.formula, choices), input("interactArmor", "Interact with Armor", action.armor !== "ignore", "checkbox"), input("halfArmor", "Half Armor", action.armor === "half", "checkbox"));
        break;
      }
      case "movePenalty":
        fields.push(input("formula", "MOVE penalty", action.formula || action.moveReduction, "number"), input("seconds", "Duration seconds (0 = until removed)", action.seconds, "number"), input("untilExit", "Remove on exit", action.untilExit, "checkbox"));
        break;
      case "status": {
        const selected = hazardStatusChoices().find(effect => effect.id === action.status);
        status = {id: action.status, name: selected?.name || action.status || "Choose effect", img: selected?.img};
        break;
      }
      default:
        note = `Saved effect: ${action.kind}.`;
        fields.push(input("formula", "Formula", actionFormula(action)), input("elevation", "Landing elevation", "elevation" in action ? action.elevation : 0, "number"));
    }
    return {effectEditor: {index, fields, note, status, avoid: ["damage", "status", "movePenalty"].includes(action.kind) ? this.skillCheck(action) : undefined}};
  }

  private effectSummary(action: TrapAction): string {
    switch (action.kind) {
      case "damage": return `${action.formula || "Choose dice"} � ${{full: "Full armor", half: "Half armor", ignore: "Ignore armor"}[action.armor]}`;
      case "status": return hazardStatusChoices().find(e => e.id === action.status)?.name || action.status || "Choose effect";
      case "movePenalty": return `MOVE -${action.formula || action.moveReduction} � ${action.seconds ? action.seconds + "s" : "Until removed"}${action.untilExit ? " � On exit" : ""}`;
      case "attack": return action.weapon || "Choose weapon";
      case "spawnCondition": return game.actors?.get(action.actorTemplateId)?.name || "Choose template";
      case "triggerHazard": return traps(this.scene).map(h => ({id: h.id, name: trapData(h)?.name})).find(h => h.id === action.hazardId)?.name || "Choose hazard";
      default: return actionFormula(action) || action.kind;
    }
  }

  effects(issues: HazardIssue[]) {
    return this.draft.actions.map((action, index) => ({index, canMoveUp: index > 0, kind: kinds.find(([kind]) => kind === action.kind)?.[1] || action.kind,
      name: action.name, summary: this.effectSummary(action), avoid: action.resistSkill ? `${action.resistSkill} / ${action.resistDV}` : "�",
      error: issues.filter(issue => issue.effectIndex === index).map(issue => issue.message).join(" ")}));
  }

  private incomingTriggers() {
    return traps(this.scene).filter(h => h.id !== this.hazard?.id && trapData(h)!.actions.some(a => a.kind === "triggerHazard" && a.hazardId === this.hazard?.id))
      .map(h => `Other hazard: ${trapData(h)!.name}`);
  }

  triggers(value = this.draft) {
    return {triggerEditor: {distance: value.distance, incoming: this.incomingTriggers(), options: triggerOptions.map(([id, label]) => ({id, label, checked: hasTrigger(value, id), movement: id === "move"}))}};
  }

  triggerSummary() {
    return {selected: triggerOptions.filter(([id]) => hasTrigger(this.draft, id)).map(([id, label]) => `${label}${id === "move" ? ` (${this.draft.distance || "any"} scene units)` : ""}`), incoming: this.incomingTriggers()};
  }

  targets() {return {...select("targetMode", "", this.draft.targetMode, [["region", "All Actors in Region"], ["triggering", "Only triggering Actor"]]), ariaLabel: "Targets"};}

  accessPoint() {
    const ap = this.scene.tokens.get(this.draft.apId), template = game.actors?.find(a => foundry.utils.getProperty(a, `flags.${MODULE_ID}.templateType`) === this.draft.apType);
    return {field: select("apType", "NetArch Access Point", this.draft.apType, [["", "Not an access point"], ...accessPointTypes().map(t => [t.id, t.label] as Option)]),
      artwork: this.draft.apType || ap ? ap?.texture.src || template?.prototypeToken.texture.src || typeImage(this.draft.apType) : undefined,
      alt: ap ? "Current AP token icon" : "Selected AP template icon", title: ap?.name || "Selected AP template", disabled: !!ap || !this.draft.apType};
  }

  private controls(source: Hazard, saved: TrapConfig, issues: HazardIssue[]) {
    const body = this.scene.tokens.get(saved.bodyId), region = triggerRegion(source, saved);
    const regionShown = !!region && region.visibility !== CONST.REGION_VISIBILITY.LAYER, playersShown = region?.visibility === CONST.REGION_VISIBILITY.ALWAYS;
    return {
      primary: [toggle("toggleActivated", saved.armed ? "Deactivate hazard" : "Activate hazard", "fa-power-off", saved.armed ? "off" : "on", saved.armed, !saved.armed && !!issues.length),
        {action: "activate", label: "Trigger now", text: "Trigger now", disabled: !!issues.length || !saved.armed},
        button("bodySheet", "Open hazard actor", "fa-user", "", !body),
        {...button("toggleEditor", this.expanded ? "Close editor" : "Edit hazard", this.expanded ? "fa-chevron-left" : "fa-pen"), hasExpanded: true, expanded: this.expanded}],
      visibility: [toggle("reveal", body?.hidden ? "Show hazard Actor" : "Hide hazard Actor", body?.hidden ? "fa-eye-slash" : "fa-eye", body?.hidden ? "show" : "hide", !!body && !body.hidden, !body),
        button("locate", "Locate on map", "fa-crosshairs", source.id!, !body && !region?.shapes.length),
        toggle("regionVisibility", regionShown ? "Hide Region (only on Regions Layer)" : "Show Region to GM", "fa-draw-polygon", regionShown ? "hide" : "show", regionShown, !region),
        toggle("playerRegionVisibility", playersShown ? "Hide Region from players" : "Show Region to players", "fa-users", playersShown ? "hide" : "show", playersShown, !region)]
    };
  }

  sidebar() {
    const entries = traps(this.scene).map(source => {
      const saved = trapData(source)!, issues = validateHazardReadiness(saved, source), selected = this.hazard?.id === source.id;
      const color = triggerRegion(source, saved)?.color;
      const hex = color == null ? "" : typeof color === "string" ? color : `#${Number(color).toString(16).padStart(6, "0")}`;
      return {id: source.id, name: saved.name || "Untitled hazard", selected, color: /^#[0-9a-f]{6}$/i.test(hex) ? hex : undefined,
        status: issues.length ? "Incomplete - inactive" : saved.armed ? "Activated" : "Inactive", error: issues.map(issue => issue.message).join(" "),
        controls: selected ? this.controls(source, saved, issues) : undefined};
    });
    return {entries, closeEditor: !this.hazard && this.expanded, presetFilesOpen: this.presetFilesOpen};
  }
}
