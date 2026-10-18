import {exportPins,importPins,parsePinBundle} from './map-pin-transfer.js';
import {pinningEnabled} from './map-pins-data.js';

const dialogs=new Map<string,Dialog>();
export async function openPinTransfer(scene:Scene,onImport:()=>Promise<void>):Promise<void> {
  if(!game.user?.isGM||!pinningEnabled(scene))return;
  const existing=dialogs.get(scene.id!);if(existing?.rendered){existing.bringToTop();return;}
  const content=await renderTemplate('modules/pneuma-scenetools/templates/map-pin-transfer.hbs',{sceneName:scene.name});
  if(dialogs.get(scene.id!)?.rendered){dialogs.get(scene.id!)!.bringToTop();return;}
  const dialog=new Dialog({title:'SceneTools POI — Import / Export',content,buttons:{},render:html=>{
    const root=html[0]!,message=root.querySelector<HTMLElement>('.pin-error')!;
    const file=root.querySelector<HTMLInputElement>('input[type="file"]')!;
    const buttons=root.querySelectorAll<HTMLButtonElement>('button');
    let busy=false;
    root.querySelector('[data-action="export-pins"]')!.addEventListener('click',()=>{
      message.textContent='';
      try{saveDataToFile(JSON.stringify(exportPins(scene),null,2),'application/json',`${scene.name.replace(/[^a-z0-9_-]/gi,'_')}-pins.json`);}
      catch(cause){message.textContent=String(cause);}
    });
    root.querySelector('[data-action="import-pins"]')!.addEventListener('click',()=>file.click());
    file.addEventListener('change',()=>{
      const selected=file.files?.[0];if(!selected||busy)return;
      busy=true;message.textContent='';buttons.forEach(button=>{button.disabled=true;});
      void (async()=>{
        const text=await selected.text(),bundle=parsePinBundle(text);
        if(!await Dialog.confirm({title:'Import SceneTools POIs',content:`<p><strong>Please backup your current world before importing...just in case.  Search your feelings, you know this to be true.</strong></p><p>Add ${bundle.notes.length} pins and ${bundle.journals.length} journals? Existing documents are kept. Importing the same file again creates additional copies.</p>`,defaultYes:false}))return;
        await importPins(scene,text);await dialog.close();await onImport();
      })().catch(cause=>{message.textContent=String(cause);}).finally(()=>{
        busy=false;file.value='';buttons.forEach(button=>{button.disabled=false;});
      });
    });
  },close:()=>{dialogs.delete(scene.id!);}},{width:560,height:'auto',resizable:true});
  dialogs.set(scene.id!,dialog);dialog.render(true);
}
