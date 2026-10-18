import {MODULE_ID} from "./settings.js";

const FEATURES = [
  {title:"Quick Scene Importer", keys:["defaultGrid","defaultDarkness","defaultGlobalLight"]},
  {title:"Map POI", keys:["mapPinDefaultsMenu"]},
  {title:"Artwork", keys:["mookArtworkMenu","vehicleArtworkMenu"]},
  {title:"Vehicle HUD", keys:["vehicleHudColorMode","vehicleHudColor"]},
  {title:"MookMaker", keys:["skillClassificationsMenu","confirmPurgeGear","retainWeaponAmmunition"]},
  {title:"NetArch Scanner", keys:["manageTypes","revealStyle","visionRadius","scannerRadius","showRevealAll","autoPulse","pulseCount","pulseDuration","autoScanner"]},
] as const;

export function groupFeatureSettings(html:JQuery|HTMLElement):void {
  const root=html instanceof HTMLElement?html:html[0];
  if(!root||root.querySelector(".pneuma-feature-settings"))return;
  const groups=FEATURES.map(feature=>({title:feature.title,rows:feature.keys.map(key=>
    (()=>{const control=root.querySelector(`[name="${MODULE_ID}.${key}"], [data-key="${MODULE_ID}.${key}"]`);
      return control?.closest<HTMLElement>(".pneuma-ap-reveal-settings")??control?.closest<HTMLElement>(".form-group");})()
  ).filter((row):row is HTMLElement=>Boolean(row))})).filter(group=>group.rows.length);
  const rows=new Set(groups.flatMap(group=>group.rows));
  const anchor=[...root.querySelectorAll<HTMLElement>(".form-group,.pneuma-ap-reveal-settings")].find(row=>rows.has(row));
  if(!anchor)return;
  // Keep native controls and listeners intact, including settings-menu buttons.
  for(const group of groups){
    const section=document.createElement("fieldset");section.className="pneuma-feature-settings";
    const legend=document.createElement("legend");legend.textContent=group.title;section.append(legend);
    anchor.before(section);
  }
  [...root.querySelectorAll(".pneuma-feature-settings")].forEach((section,index)=>{
    for(const row of new Set(groups[index]!.rows))section.append(row);
  });
}

export function registerSettingsLayout():void {
  Hooks.on("renderSettingsConfig",(_app:SettingsConfig,html:JQuery)=>groupFeatureSettings(html));
}
