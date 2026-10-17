import {validateAction, type TrapAction, type TrapConfig} from "./model.js";
const editorFields = ["name", "notes", "spotDV", "disarmDV", "disarmSeconds", "hazardActorTemplateId", "tokenIcon", "apType", "targetMode"] as const;
export function readEditorFields(form: HTMLFormElement): Partial<TrapConfig> {
  const data = new FormDataExtended(form, {dtypes: {spotDV: "Number", disarmDV: "Number", disarmSeconds: "Number"}}).object;
  // Only this form's editable configuration fields may change the draft.
  return Object.fromEntries(editorFields.filter(key => key in data).map(key => [key, data[key]]));
}
export function readEffectFields(form: HTMLFormElement, previous: TrapAction): TrapAction {
  const data = new FormDataExtended(form, {dtypes: {resistDV: "Number", seconds: "Number", elevation: "Number", untilExit: "Boolean", interactArmor: "Boolean", halfArmor: "Boolean", formula: "String"}}).object;
  const next = {...previous, ...data};
  if (previous.kind === "damage")
    Object.assign(next, {armor: !data.interactArmor ? "ignore" : data.halfArmor ? "half" : "full"});
  return validateAction(next);
}
