import {MODULE_ID} from "./settings.js";

declare global {interface SettingConfig {
  "pneuma-scenetools.vehicleHudColorMode":string;
  "pneuma-scenetools.vehicleHudColor":string;
}}

export function styleVehicleHud(root:HTMLElement):void {
  const controls=root.querySelector<HTMLElement>('.pneuma-vehicle-controls');
  if(!controls)return;
  const native=root.querySelector<HTMLElement>(':scope > .col .control-icon:not(.pneuma-vehicle-controls .control-icon)');
  if(native){
    const style=getComputedStyle(native);
    if(native.parentElement)controls.style.rowGap=getComputedStyle(native.parentElement).rowGap;
    for(const button of controls.querySelectorAll<HTMLElement>(':scope > .control-icon')){
      for(const property of ['width','height','min-width','min-height','padding','margin','box-sizing','font-size','line-height','border-radius'])button.style.setProperty(property,style.getPropertyValue(property));
    }
    const icon=native.querySelector('i');
    controls.style.setProperty('--vehicle-hud-icon-size',icon?getComputedStyle(icon).fontSize:style.fontSize);
  }
  const mode=game.settings?.get(MODULE_ID,'vehicleHudColorMode');
  const color=mode==='combat' && game.modules?.get('pneuma-combattools')?.active
    ? 'var(--pneuma-cth-icon-color, currentColor)'
    : mode==='custom'?game.settings?.get(MODULE_ID,'vehicleHudColor'):undefined;
  if(color)controls.style.setProperty('--vehicle-hud-color',color);
  else controls.style.removeProperty('--vehicle-hud-color');
}

export function registerVehicleHudStyle():void {
  const refresh=()=>{const root=document.getElementById('token-hud');if(root)styleVehicleHud(root);};
  game.settings!.register(MODULE_ID,'vehicleHudColorMode',{
    name:'Vehicle HUD icon color',hint:'Use native colors, a custom color, or match Combat Tools when active.',scope:'world',config:true,type:String,default:'native',
    choices:{native:'Native',custom:'Custom',...(game.modules?.get('pneuma-combattools')?.active?{combat:'Match to Combat Tools'}:{})},onChange:refresh,
  });
  game.settings!.register(MODULE_ID,'vehicleHudColor',{
    name:'Vehicle HUD custom color',hint:'Used when Vehicle HUD icon color is Custom.',scope:'world',config:true,default:'#ffffff',
    // Foundry v12 supports DataField settings, omitted by the pinned typings.
    // @ts-expect-error Native ColorField renders the color picker.
    type:new foundry.data.fields.ColorField(),onChange:refresh,
  });
}
