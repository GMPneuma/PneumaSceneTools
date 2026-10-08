import {getCurrentArmorSelections} from "./armor.js";
import {getCurrentCombatNumber} from "./skills.js";
import {getWeaponInventoryChoices} from "./weapons.js";
import {areTokenControlsVisible, getCivilianCombatNumber} from "./skill-settings.js";
import type {AvailableRole} from "./roles.js";
const key = "PNEUMA_MOOK_MAKER.Form.";
function radios(name: string, values: string[], selected: string, labels: Record<string,string> = {}) {
  return {name, className: "pneuma-mook-maker-radio-column", choices: values.map(value=>({value,label:labels[value]??value,selected:value===selected}))};
}
export function mookFormData(token: Token, availableRoles: AvailableRole[]) {
  const actor=token.actor!;
  const get=(path:string)=>foundry.utils.getProperty(actor,path);
  const civilian=getCivilianCombatNumber(), combat=getCurrentCombatNumber(actor);
  const selection=combat===civilian?"Civilian":combat!==null&&combat>=10&&combat<=14?String(combat):combat!==null?"custom":"No change";
  const armor=getCurrentArmorSelections(actor), inventory=getWeaponInventoryChoices(actor);
  const role=availableRoles.find(role=>role.name.toLowerCase()===String(get("system.roleInfo.activeRole")??"").toLowerCase());
  const active=actor.items.find(item=>String(item.type)==="role"&&item.name===role?.name);
  const armors=["None","Leathers","Kevlar","LightArmorJack","MedArmorJack"];
  return {
    name:token.document.name??actor.name, noRole:!role, roles:availableRoles.map(entry=>({key:entry.key,name:entry.name,selected:entry===role})),
    activeRoleLevel:active?foundry.utils.getProperty(active,"system.rank")??0:0,
    tokenControls:areTokenControlsVisible(),
    tokenFields:[{name:"displayName",label:key+"DisplayName",choices:["Never","Control","OwnerHover","Hover","Owner","Always"].map((label,i)=>({value:i*10,label:key+"DisplayName"+label,selected:token.document.displayName===i*10}))},
      {name:"tokenDisposition",label:key+"TokenDisposition",choices:["Secret","Hostile","Neutral","Friendly"].map((label,i)=>({value:i-2,label:key+"Disposition"+label,selected:token.document.disposition===i-2}))}],
    combat:{customChoice:true,customCombat:selection==="custom",customCombatValue:selection==="custom"?String(combat):"",...radios("combatNumber",["No change","Civilian","10","11","12","13","14"],selection,{Civilian:game.i18n!.format(key+"CivilianCombatNumber",{number:civilian})})},
    hp:radios("hitpoints",["20","25","30","35","40","45","50"],String(get("system.derivedStats.hp.value")??"")),
    move:radios("move",["2","3","4","5","6","7","8"],String(get("system.stats.move.value")??"")),
    bodyArmor:radios("bodyArmor",armors,armor.body),headArmor:radios("headArmor",armors,armor.head),
    weapons:[1,2].map((number)=>({number,label:game.i18n!.format(key+"WeaponNumber",{number}),choices:inventory.weapons,selected:inventory.selectedWeaponIds[number-1]??""})),
    bulletChoices:[{value:"unchanged",label:key+"Unchanged"},{value:"reflex",label:key+"DodgeReflex"},{value:"coprocessor",label:key+"DodgeCoprocessor"}]
  };
}
