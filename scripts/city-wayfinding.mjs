import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('vendor/city-wayfinding.json',import.meta.url),'utf8'));
export const WAYFINDING_ICONS=data.symbols;
export function wayfindingSvg(id){
  const icon=WAYFINDING_ICONS[id];
  if(!icon)throw new Error(`Missing wayfinding pictogram: ${id}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">${icon.paths.map(d=>`<path fill="#ffffff" d="${d}"/>`).join('')}</svg>`;
}
