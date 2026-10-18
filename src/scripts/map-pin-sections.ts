/** Section strings contain plain text or HTML, without a second content schema. */
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function decode(text:string):string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,(entity,code:string)=>{
    if(code.startsWith('#')){const n=code[1]?.toLowerCase()==='x'?parseInt(code.slice(2),16):Number(code.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):entity;}
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'} as Record<string,string>)[code.toLowerCase()]??entity;
  });
}
const hasHTML=(text:string)=>/<\/?[a-z][\w:-]*(?:\s[^<>]*|\s*\/?)>/i.test(text);
export function exportSections(html:string):Record<string,string>|undefined {
  html=html.replace(/<\/?section\b[^>]*>/gi,'');
  const sections:Record<string,string>=Object.create(null);
  const headings=[...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const content=(body:string):string=>{
    const plain=body.replace(/<br\s*\/?\s*>/gi,'\n');
    if(/^(?:\s*<p>[^<]*<\/p>)*\s*$/.test(plain)&&!/&(?!(?:amp|lt|gt|quot|apos|nbsp);)[a-z][a-z0-9]+;/i.test(plain)){
      const text=[...plain.matchAll(/<p>([^<]*)<\/p>/g)].map(p=>decode(p[1]!)).join('\n');
      if(!hasHTML(text))return text;
    }
    return body.trim();
  };
  if(!headings.length)return {Description:content(html)};
  if(html.slice(0,headings[0]!.index).trim())sections.Description=content(html.slice(0,headings[0]!.index));
  for(const [index,heading] of headings.entries()){
    const name=decode(heading[2]!.replace(/<[^>]*>/g,'')).trim();
    if(!name||Object.hasOwn(sections,name))return;
    sections[name]=content(html.slice(heading.index!+heading[0].length,headings[index+1]?.index??html.length));
  }
  return sections;
}
export function sectionsHTML(value:unknown):string {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Page sections must be an object of heading names and text strings.');
  return Object.entries(value).map(([name,text])=>{
    if(!name.trim())throw Error('Each section needs a nonempty heading.');
    if(typeof text!=='string')throw Error('Each section needs a text string.');
    const body=hasHTML(text)?text:text.split(/\r?\n/).map(line=>`<p>${escape(line)}</p>`).join('');
    return `<h2>${escape(name)}</h2>${body}`;
  }).join('');
}

export interface SectionImage {src:string;alt:string}
export function exportPageSections(html:string):{sections:Record<string,string>;image?:SectionImage}|undefined {
  // SceneTools appends this managed image block to ordinary POI pages.
  // Extract it before checking text sections so an image does not force HTML export.
  const block=/(?:<h2>Image<\/h2>\s*)?<section\s+data-poi-image=["']true["']\s*>\s*(?:<h2>Image<\/h2>\s*)?<img\s+([^>]+)>\s*<\/section>\s*$/i.exec(html);
  let image:SectionImage|undefined;
  if(block){
    const attributes=block[1]!;
    const src=/\bsrc\s*=\s*(["'])(.*?)\1/i.exec(attributes);
    const alt=/\balt\s*=\s*(["'])(.*?)\1/i.exec(attributes);
    const other=attributes.replace(/\b(?:src|alt)\s*=\s*(["'])(.*?)\1/gi,'').replace(/\//g,'').trim();
    if(src&&!other){
      image={src:decode(src[2]!),alt:decode(alt?.[2]??'')};
      html=html.slice(0,block.index);
    }
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
