import {MODULE_ID} from './constants.js';

export interface NamePart {tableId:string}
export type NameRecipe=NamePart[];
export const blankNameRecipe=():NameRecipe=>Array.from({length:3},()=>({tableId:''}));
export function validateNameRecipe(value:NameRecipe):NameRecipe {
  if(!Array.isArray(value)||value.length!==3||value.some(part=>!part||(typeof part.tableId!=='string'||part.tableId.length>200)))throw Error('Configure exactly three name parts.');
  return value.map(part=>({tableId:part.tableId}));
}
declare global {interface SettingConfig {'pneuma-scenetools.mookNameRecipe':NameRecipe}}
export function defaultNameRecipe():NameRecipe {return validateNameRecipe(game.settings!.get(MODULE_ID,'mookNameRecipe')??blankNameRecipe());}
export function assembleName(recipe:NameRecipe,values:string[]):string {
  return recipe.map((_part,index)=>values[index]?.trim()??'').filter(Boolean).join(' ').trim();
}
export async function rollNamePart(part:NamePart):Promise<string> {
  if(!part.tableId)return '';
  const table=game.tables?.get(part.tableId);
  if(!table)throw Error('A configured name RollTable is unavailable. Check the name settings.');
  const {results}=await table.roll({recursive:false});
  if(results.length!==1||results[0]!.type!==CONST.TABLE_RESULT_TYPES.TEXT)throw Error(`${table.name}: use one text result per roll for name parts.`);
  const text=results[0]!.text?.trim()??'';
  return new DOMParser().parseFromString(text,'text/html').body.textContent?.trim()??'';
}
export async function generateName(recipe:NameRecipe):Promise<string> {
  validateNameRecipe(recipe);
  if(!recipe.some(part=>part.tableId))throw Error('Configure name RollTables in Scene Tools settings or this artwork category first.');
  const values=[];for(const part of recipe)values.push(await rollNamePart(part));
  const name=assembleName(recipe,values);
  if(!name)throw Error('The name RollTables returned an empty name.');
  return name;
}
export async function editNameRecipe(initial:NameRecipe,title='Three-part name'):Promise<NameRecipe|null> {
  const recipe=validateNameRecipe(initial);
  const tables=(game.tables?.contents as RollTable[]|undefined)?.map(table=>({id:table.id,name:table.name}))??[];
  const content=await renderTemplate(`modules/${MODULE_ID}/templates/mook-name-config.hbs`,{parts:recipe.map((part,index)=>({...part,index,number:index+1,tables:tables.map(table=>({...table,selected:table.id===part.tableId})),missing:part.tableId&&!tables.some(table=>table.id===part.tableId)}))});
  return new Promise(resolve=>{
    let result:NameRecipe|null=null;
    const dialog=new Dialog({title,content,buttons:{},render:html=>{
      const root=html[0]!;
      root.querySelector('[data-save]')!.addEventListener('click',()=>{
        try {
          if(!game.user?.isGM)throw Error('Only GMs can configure names.');
          result=validateNameRecipe(recipe.map((_part,index)=>{
            const read=(key:string)=>(root.querySelector(`[name="${index}.${key}"]`) as HTMLInputElement).value;
            return {tableId:read('tableId')};
          }));
          void dialog.close();
        }catch(error){root.querySelector('[role=alert]')!.textContent=String(error);}
      });
      root.querySelector('[data-cancel]')!.addEventListener('click',()=>void dialog.close());
    },close:()=>resolve(result)},{width:580,classes:['dialog','pneuma-mook-maker-dialog']});dialog.render(true);
  });
}
export async function manualName(initial:NameRecipe,current:string):Promise<string|null> {
  const recipe=validateNameRecipe(initial),tables=(game.tables?.contents as RollTable[]|undefined)?.map(table=>({id:table.id,name:table.name}))??[];
  const content=await renderTemplate(`modules/${MODULE_ID}/templates/mook-name-manual.hbs`,{current,parts:recipe.map((part,index)=>({...part,index,number:index+1,tables:tables.map(table=>({...table,selected:table.id===part.tableId}))}))});
  return new Promise(resolve=>{
    let result:string|null=null;
    const dialog=new Dialog({title:'Manually generate name',content,buttons:{},render:html=>{
      const root=html[0]!,name=root.querySelector<HTMLInputElement>('[name="generatedName"]')!;
      root.querySelector('[data-generate]')!.addEventListener('click',async()=>{
        root.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=true);
        try {
          root.querySelector('[role=alert]')!.textContent='';
          name.value=await generateName(recipe.map((part,index)=>({...part,tableId:root.querySelector<HTMLSelectElement>(`[name="table${index}"]`)!.value})));
        }catch(error){root.querySelector('[role=alert]')!.textContent=String(error);}
        finally {root.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=false);}
      });
      root.querySelector('[data-save]')!.addEventListener('click',()=>{if(!name.value.trim()){root.querySelector('[role=alert]')!.textContent='Enter or generate a name.';return;}result=name.value.trim();void dialog.close();});
      root.querySelector('[data-cancel]')!.addEventListener('click',()=>void dialog.close());
    },close:()=>resolve(result)},{width:580,classes:['dialog','pneuma-mook-maker-dialog']});dialog.render(true);
  });
}
class NameSettings extends FormApplication {
  constructor(){super({});}
  override render():this {
    void editNameRecipe(defaultNameRecipe(),'Default Mook Name RollTables').then(async recipe=>{if(recipe)await game.settings!.set(MODULE_ID,'mookNameRecipe',recipe);}).catch(error=>ui.notifications?.error(String(error)));
    return this;
  }
  protected override async _updateObject():Promise<void> {}
}
export function registerNameSettings():void {
  game.settings!.register(MODULE_ID,'mookNameTablesReady',{scope:'world',config:false,type:Boolean,default:false});
  game.settings!.register(MODULE_ID,'mookNameRecipe',{scope:'world',config:false,type:Array,default:blankNameRecipe()});
  game.settings!.registerMenu(MODULE_ID,'mookNameSettings',{name:'Mook Name RollTables',label:'Configure three-part names',hint:'Choose ordered RollTables for names, handles, titles, or ranks. Artwork categories can override these defaults.',icon:'fas fa-dice',type:NameSettings,restricted:true});
}
