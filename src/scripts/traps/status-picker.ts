import {chooseCombatStatuses} from "./combat-tools.js";


export function hazardStatusChoices():{id:string;name:string;img:string}[]{
  return CONFIG.statusEffects.flatMap(effect=>typeof effect==="string"||!effect.id?[]:[{
    id:effect.id,name:game.i18n!.localize(effect.name??effect.id),img:effect.img??"icons/svg/aura.svg"
  }]);
}

/** Selection only. Resolution still uses native effects and GM confirmation. */
export async function chooseHazardStatus(current:string):Promise<string|null>{
  const choices=hazardStatusChoices(),allowedIds=choices.map(effect=>effect.id);
  const selected=allowedIds.includes(current)?[current]:[];
  const result=await chooseCombatStatuses(selected,allowedIds);
  if(result===null)return null;
  const id=result[0]??"";
  if(id&&!allowedIds.includes(id))throw Error("The selected native status is unavailable.");
  return id;
}
