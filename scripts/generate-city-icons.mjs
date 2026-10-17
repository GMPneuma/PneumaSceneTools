// Regenerate the standard wayfinding pictograms and the self-contained preview.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {wayfindingSvg,WAYFINDING_ICONS} from './city-wayfinding.mjs';
const root=new URL('../',import.meta.url);
const icons=JSON.parse(await readFile(new URL('city-icon-catalog.json',import.meta.url),'utf8'));
if(icons.length!==Object.keys(WAYFINDING_ICONS).length)throw new Error('Icon catalog and silhouettes differ.');
const out=new URL('src/assets/city-icons/',root);
await mkdir(out,{recursive:true});
for(const icon of icons)await writeFile(new URL(`${icon.id}.svg`,out),wayfindingSvg(icon.id)+'\n');
await writeFile(new URL('src/scripts/city-icons.ts',root),`// Generated from scripts/city-icon-catalog.json.\nexport const CITY_ICONS = ${JSON.stringify(icons,null,2)} as const;\n`);
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;');
const card=icon=>`<div class="card"><div class="symbol" style="--icon:url('data:image/svg+xml,${encodeURIComponent(wayfindingSvg(icon.id))}')"></div><div class="map"><div class="symbol small" style="--icon:url('data:image/svg+xml,${encodeURIComponent(wayfindingSvg(icon.id))}')"></div></div><div class="label">${escape(icon.label)}</div></div>`;
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Cyberpunk city map icons</title><style>
body{margin:28px;background:#141a22;color:#e4eaf1;font:14px system-ui}h1{font-size:28px;margin-bottom:8px}p{color:#acbbc9}h2{font-size:16px;margin:20px 0 10px;color:#69d9de}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}.card{border:1px solid #354353;background:#202b38;border-radius:6px;text-align:center;padding:12px 5px 8px}.symbol{width:48px;height:48px;margin:0 auto 9px;background:var(--tint,#fff);mask:var(--icon) center/contain no-repeat;-webkit-mask:var(--icon) center/contain no-repeat}.small{width:32px;height:32px;margin:0}.map{width:44px;height:44px;margin:0 auto 8px;display:grid;place-items:center;background:linear-gradient(25deg,transparent 36%,#656d7080 37%,#656d7080 46%,transparent 47%),repeating-linear-gradient(90deg,#4c5358 0 8px,#363e45 8px 15px);box-shadow:inset 0 0 0 6px #0005}.label{font-size:12px;min-height:28px}label{display:flex;gap:12px;align-items:center;margin-top:15px}
</style><h1>Cyberpunk city map icons</h1><p>${icons.length} standard filled wayfinding symbols. Each shown at 48px and 32px. All tintable.</p><label>Preview color <input type="color" value="#ffffff" oninput="document.documentElement.style.setProperty('--tint',this.value)"></label>${[...new Set(icons.map(i=>i.category))].map(category=>`<h2>${escape(category)}</h2><div class="grid">${icons.filter(i=>i.category===category).map(card).join('')}</div>`).join('')}</html>`;
await writeFile(new URL('docs/city-icons.html',root),html);
console.log(`Generated ${icons.length} wayfinding city icons and 48px/32px preview.`);
