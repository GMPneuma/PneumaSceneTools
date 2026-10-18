import {MODULE_ID} from './constants.js';
import {ensureSceneToolsFolder} from '../world-folders.js';
import {defaultNameRecipe} from './names.js';

declare global {interface SettingConfig {'pneuma-scenetools.mookNameTablesReady':boolean}}
const NAME_TABLE_ICON=`modules/${MODULE_ID}/assets/name-generator.svg`;
export async function ensureNameTables():Promise<void> {
  if(!game.user?.isGM||(game.users?.activeGM&&game.users.activeGM.id!==game.user.id))return;
  for(const key of ['first','last','handle']){
    const table=game.tables?.find(table=>foundry.utils.getProperty(table,`flags.${MODULE_ID}.starterNameTable`)===key);
    if(table&&(!table.img||table.img==='icons/svg/d20-grey.svg'))await table.update({img:NAME_TABLE_ICON});
  }
  if(game.settings!.get(MODULE_ID,'mookNameTablesReady'))return;
  const response=await fetch(`modules/${MODULE_ID}/templates/mook-name-tables.json`);
  if(!response.ok)throw Error('Could not load bundled Mook name tables.');
  const definitions=await response.json() as {key:string;name:string;entries:string[]}[];
  const folder=await ensureSceneToolsFolder('RollTable','Mook Names');
  const recipe=[];
  for(const definition of definitions){
    let table=game.tables?.find(table=>foundry.utils.getProperty(table,`flags.${MODULE_ID}.starterNameTable`)===definition.key);
    if(!table)table=await RollTable.create({name:definition.name,img:NAME_TABLE_ICON,folder:folder.id,formula:'1d5',replacement:true,displayRoll:false,
      flags:{[MODULE_ID]:{starterNameTable:definition.key}},
      results:definition.entries.map((text,index)=>({type:CONST.TABLE_RESULT_TYPES.TEXT,text,weight:1,range:[index+1,index+1],drawn:false}))} as RollTable.CreateData);
    if(!table)throw Error(`Could not create ${definition.name}.`);
    recipe.push({tableId:table.id!});
  }
  if(!defaultNameRecipe().some(part=>part.tableId))await game.settings!.set(MODULE_ID,'mookNameRecipe',recipe);
  await game.settings!.set(MODULE_ID,'mookNameTablesReady',true);
}
