// Explicit source refresh; normal builds/generation work entirely offline.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {CUSTOM_CITY_ICONS} from './custom-city-icons.mjs';
const root=new URL('../',import.meta.url);
const selection=JSON.parse(await readFile(new URL('city-wayfinding-selection.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('city-icon-catalog.json',import.meta.url),'utf8'));
assert.deepEqual(Object.keys(selection).sort(),catalog.map(i=>i.id).sort());
async function fetchText(url){const response=await fetch(url);if(!response.ok)throw new Error(`${response.status}: ${url}`);return response.text();}
const commit=JSON.parse(await fetchText('https://api.github.com/repos/Templarian/MaterialDesign/commits/master')).sha;
assert.match(commit,/^[a-f0-9]{40}$/);
const base=`https://raw.githubusercontent.com/Templarian/MaterialDesign/${commit}/`;
const symbols={};
const entries=Object.entries(selection);
for(let i=0;i<entries.length;i+=6){
  await Promise.all(entries.slice(i,i+6).map(async([id,name])=>{
    if(name.startsWith('@scenetools/')){
      assert.ok(CUSTOM_CITY_ICONS[id],`Missing custom icon ${id}`);
      symbols[id]={name,paths:CUSTOM_CITY_ICONS[id],custom:true};return;
    }
    const source=await fetchText(`${base}svg/${name}.svg`);
    assert.match(source,/viewBox="0 0 24 24"/);
    assert.ok(!/<(?:script|image|use)\b/.test(source));
    const paths=[...source.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match=>match[1]);
    assert.ok(paths.length,`No path for ${name}`);
    symbols[id]={name,paths};
  }));
}
await mkdir(new URL('vendor/',import.meta.url),{recursive:true});
await writeFile(new URL('vendor/city-wayfinding.json',import.meta.url),JSON.stringify({source:'Pictogrammers / Material Design Icons',repository:'https://github.com/Templarian/MaterialDesign',commit,symbols:Object.fromEntries(entries.map(([id])=>[id,symbols[id]]))},null,2)+'\n');
const licenses=new URL('src/assets/city-icons/',root);await mkdir(licenses,{recursive:true});
await writeFile(new URL('LICENSE.txt',licenses),await fetchText(base+'LICENSE'));
await writeFile(new URL('LICENSE-APACHE-2.0.txt',licenses),await fetchText('https://www.apache.org/licenses/LICENSE-2.0.txt'));
await writeFile(new URL('NOTICE.txt',licenses),`Scene Tools city-map pictograms\n\nArtwork: Pictogrammers / Material Design Icons contributors\nSource: https://github.com/Templarian/MaterialDesign\nRevision: ${commit}\nLicense: Apache License 2.0 (LICENSE-APACHE-2.0.txt), with the upstream license notice in LICENSE.txt.\n\nChanges: selected icons renamed to city-map location names; SVGs normalized to white fill and transparent background for Foundry Icon Tint. Original upstream path geometry preserved.\nCargo Container, H Landing Pad, NetRunner circuit, and Ripperdoc scalpel are Scene Tools artwork. Cyberware Dealer adapts Material Design Icons arm-flex with mechanical joint/seam cutouts.\n`);
console.log(`Vendored ${entries.length} standard wayfinding pictograms at ${commit}.`);
