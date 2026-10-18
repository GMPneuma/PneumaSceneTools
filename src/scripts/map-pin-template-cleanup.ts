import {MODULE_ID} from "./settings.js";

/** Remove the obsolete template section without replacing the rest of the page. */
export function removeTemplateGMNotes(html:string):string {
  if(!/gm\s+notes/i.test(html))return html;
  const doc=new DOMParser().parseFromString(html,"text/html");
  let changed=false;
  for(const heading of [...doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6")]){
    if(!doc.body.contains(heading) || !/^gm\s+notes$/i.test(heading.textContent?.trim()??""))continue;
    const wrapper=heading.closest("section");
    if(wrapper && wrapper.querySelectorAll("h1,h2,h3,h4,h5,h6").length===1)wrapper.remove();
    else {
      const headings=[...doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6")];
      const next=headings[headings.indexOf(heading)+1];
      const range=doc.createRange();range.setStartBefore(heading);
      if(next)range.setEndBefore(next);else range.setEnd(doc.body,doc.body.childNodes.length);
      range.deleteContents();
    }
    changed=true;
  }
  return changed?doc.body.innerHTML:html;
}

const pending=new Map<string,Promise<void>>();
export async function cleanDefaultPinTemplate(journal:JournalEntry):Promise<void> {
  if(!game.user?.isGM || foundry.utils.getProperty(journal,`flags.${MODULE_ID}.pinTemplate`)!==true)return;
  const key=journal.id!;
  if(pending.has(key))return pending.get(key)!;
  const task=(async()=>{
    for(const page of journal.pages){
      if(page.type!=="text")continue;
      const original=page.text?.content??"",content=removeTemplateGMNotes(original);
      if(content===original)continue;
      if(!await page.update({text:{content}}) || page.text.content!==content)throw Error("Could not remove GM Notes from the default POI template.");
    }
  })();
  pending.set(key,task);
  try {await task;}finally{pending.delete(key);}
}

export async function cleanExistingPinTemplates():Promise<void> {
  if(!game.user?.isGM || game.users?.activeGM?.id!==game.user.id)return;
  for(const journal of game.journal??[])await cleanDefaultPinTemplate(journal);
}
