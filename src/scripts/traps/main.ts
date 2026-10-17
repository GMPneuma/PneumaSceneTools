import {MODULE_ID} from "../settings.js";
import {registerFeature} from "../lifecycle.js";
import {registerRuntime, registerBehavior, applyCombatEffect} from "./runtime.js";
import {editTrap, openTraps, registerTrapUI} from "./ui.js";
import {ensureDefaultHazardTemplate} from "./default-actor.js";

registerFeature({name:"Hazards",register(){
  game.settings!.register(MODULE_ID,"trapPresets",{scope:"world",config:false,type:Object,default:{presets:[]}});
  registerBehavior();registerRuntime();registerTrapUI();return {traps:{open:openTraps,edit:editTrap}, sceneEffects: {apply: applyCombatEffect}};
},async ready(){await ensureDefaultHazardTemplate();}});
