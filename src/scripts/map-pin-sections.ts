/** Plain-text sections are the editable format; complex rich text keeps its original HTML. */
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function decode(text:string):string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,(entity,code:string)=>{
    if(code.startsWith('#')){const n=code[1]?.toLowerCase()==='x'?parseInt(code.slice(2),16):Number(code.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):entity;}
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'} as Record<string,string>)[code.toLowerCase()]??entity;
  });
}
export function exportSections(html:string):Record<string,string>|undefined {
  if(/&(?!(?:amp|lt|gt|quot|apos|nbsp);)[a-z][a-z0-9]+;/i.test(html))return;
  const sections:Record<string,string>=Object.create(null);
  const pattern=/<h2>([^<]+)<\/h2>((?:\s*<p>[^<]*<\/p>)*)\s*/g;
  let end=0;
  for(const match of html.matchAll(pattern)){
    if(html.slice(end,match.index).trim())return;
    const name=decode(match[1]!).trim();
    if(!name||Object.hasOwn(sections,name))return;
    sections[name]=[...match[2]!.matchAll(/<p>([^<]*)<\/p>/g)].map(p=>decode(p[1]!)).join('\n');
    end=match.index!+match[0].length;
  }
  if(!Object.keys(sections).length||html.slice(end).trim())return;
  return sections;
}
export function sectionsHTML(value:unknown):string {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Page sections must be an object of heading names and text strings.');
  return Object.entries(value).map(([name,text])=>{
    if(!name.trim()||typeof text!=='string')throw Error('Each section needs a nonempty heading and a text string.');
    return `<h2>${escape(name)}</h2>${text.split(/\r?\n/).map(line=>`<p>${escape(line)}</p>`).join('')}`;
  }).join('');
}

export interface SectionImage {src:string;alt:string}
export function exportPageSections(html:string):{sections:Record<string,string>;image?:SectionImage}|undefined {
  // SceneTools appends this managed image block to ordinary POI pages.
  // Extract it before checking text sections so an image does not force HTML export.
  const block=/<section\s+data-poi-image=["']true["']\s*>\s*<h2>Image<\/h2>\s*<img\s+([^>]+)>\s*<\/section>\s*$/i.exec(html);
  let image:SectionImage|undefined;
  if(block){
    const attributes=block[1]!;
    const src=/\bsrc\s*=\s*(["'])(.*?)\1/i.exec(attributes);
    const alt=/\balt\s*=\s*(["'])(.*?)\1/i.exec(attributes);
    const other=attributes.replace(/\b(?:src|alt)\s*=\s*(["'])(.*?)\1/gi,'').replace(/\//g,'').trim();
    if(!src||other)return;
    image={src:decode(src[2]!),alt:decode(alt?.[2]??'')};
    html=html.slice(0,block.index);
  }
  const sections=exportSections(html);
  return sections?{sections,...(image?{image}:{})}:undefined;
}
export function sectionImageHTML(value:unknown):string {
  if(value===undefined)return '';
  const image=value as SectionImage;
  if(!image||typeof image!=='object'||Array.isArray(image)||typeof image.src!=='string'||!image.src.trim()||typeof image.alt!=='string'||/^\s*(javascript|vbscript):/i.test(image.src))throw Error('Page image needs a valid src path and alt text string.');
  return `<section data-poi-image="true"><h2>Image</h2><img src="${escape(image.src)}" alt="${escape(image.alt)}"></section>`;
}
