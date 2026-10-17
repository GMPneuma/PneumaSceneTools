import {MODULE_ID} from "./settings.js";
import {CITY_ICONS} from "./city-icons.js";
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
function iconFolders(selected:string,native=false):string {
  return '<div class="pin-icon-folders">'+[...new Set(CITY_ICONS.map(i=>i.category))].map(category=>{
    const icons=CITY_ICONS.filter(i=>i.category===category);
    const path=(id:string)=>`modules/${MODULE_ID}/assets/city-icons/${id}.svg`;
    const open=icons.some(i=>path(i.id)===selected);
    return `<details class="pin-icon-category" ${open?"open":""}><summary>${escape(category)}</summary><div class="pin-icon-grid">${icons.map(icon=>{
      const src=path(icon.id),chosen=src===selected;
      const content=`<span class="pin-icon-glyph" aria-hidden="true" style="mask-image:url('${src}')"></span><span>${escape(icon.label)}</span>`;
      return native?`<button type="button" class="pin-icon" data-src="${src}" data-category="${escape(category)}" aria-pressed="${chosen}">${content}</button>`
        :`<label class="pin-icon"><input type="radio" name="icon" value="${icon.id}" ${chosen?"checked":""}>${content}</label>`;
    }).join("")}</div></details>`;
  }).join("")+'</div>';
}
export function compactIconPicker(selected:string,native=false):string {
  return `<div class="pin-icon-picker"><div class="pin-icon-current"><img src="${escape(selected||'icons/svg/book.svg')}" alt="Current icon"><span class="pin-current-glyph" role="img" aria-label="Current icon" hidden></span><button type="button" data-action="choose-city-icon" aria-haspopup="dialog">Choose icon</button></div><div class="pin-icon-choices" hidden>${iconFolders(selected,native)}</div></div>`;
}
export function bindIconPicker(root:HTMLElement,selected:()=>string):()=>void {
  const picker=root.querySelector<HTMLElement>('.pin-icon-picker');
  if(!picker)return ()=>{};
  const image=picker.querySelector<HTMLImageElement>('img')!,button=picker.querySelector<HTMLButtonElement>('[data-action="choose-city-icon"]')!,choices=picker.querySelector<HTMLElement>('.pin-icon-choices')!;
  let dialog:Dialog|undefined;
  const glyph=picker.querySelector<HTMLElement>('.pin-current-glyph')!;
  const refresh=()=>{const src=selected()||'icons/svg/book.svg';image.src=src;
    const symbol=src.startsWith(`modules/${MODULE_ID}/assets/city-icons/`)||src.startsWith('icons/svg/');
    image.hidden=symbol;glyph.hidden=!symbol;glyph.style.maskImage=`url(${JSON.stringify(src)})`;
    for(const icon of choices.querySelectorAll<HTMLElement>('button.pin-icon'))icon.setAttribute('aria-pressed',String(icon.dataset.src===src));};
  // Move the existing controls so native edit listeners and create-form radio
  // values are retained. Return them before reading the selection or submitting.
  const restore=()=>{choices.hidden=true;picker.append(choices);};
  const choose=()=>{restore();refresh();void dialog?.close();button.focus();};
  button.addEventListener('click',()=>{
    if(dialog?.rendered){dialog.bringToTop();return;}
    const categories=Array.from(choices.querySelectorAll<HTMLDetailsElement>('.pin-icon-category'));
    const openStates=categories.map(category=>category.open);
    let searching=false;
    const clearSearch=()=>{for(const [index,category] of categories.entries()){category.hidden=false;category.open=openStates[index]!;for(const icon of category.querySelectorAll<HTMLElement>('.pin-icon'))icon.hidden=false;}};
    dialog=new Dialog({title:"Choose POI icon",content:'<section class="pneuma-map-pins pin-icon-popup"><input type="search" class="pin-icon-search" aria-label="Search POI icons" placeholder="Search icons…"><p class="pin-icon-empty" role="status" hidden>No icons match your search.</p></section>',buttons:{},render:html=>{
      const panel=html[0]!.querySelector<HTMLElement>('.pin-icon-popup')!;
      panel.append(choices);choices.hidden=false;
      const search=panel.querySelector<HTMLInputElement>('.pin-icon-search')!,empty=panel.querySelector<HTMLElement>('.pin-icon-empty')!;
      search.addEventListener('input',()=>{
        const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);let count=0;
        if(!terms.length){clearSearch();searching=false;empty.hidden=true;return;}
        searching=true;
        for(const category of categories){let matches=0;
          const group=category.querySelector('summary')!.textContent!.toLowerCase();
          for(const icon of category.querySelectorAll<HTMLElement>('.pin-icon')){
            const text=`${group} ${icon.textContent}`.toLowerCase();icon.hidden=!terms.every(term=>text.includes(term));if(!icon.hidden)matches++;
          }
          category.hidden=!matches;category.open=!!matches;count+=matches;
        }
        empty.hidden=!!count;
      });
      search.focus();
    },close:()=>{if(searching)clearSearch();restore();dialog=undefined;button.focus();}},{classes:['dialog','pneuma-poi-icon-picker'],width:560,height:Math.min(720,Math.max(320,globalThis.innerHeight-80)),resizable:true});
    dialog.render(true);
  });
  choices.addEventListener('change',choose);
  choices.addEventListener('click',event=>{if((event.target as HTMLElement).closest('button.pin-icon'))choose();});
  refresh();return refresh;
}
