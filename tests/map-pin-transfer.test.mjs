import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,makeScene,Collection} from './netarch/helpers.mjs';
import {exportPins,importPins,parsePinBundle} from '../dist/scripts/map-pin-transfer.js';
import {exportSections,sectionsHTML} from '../dist/scripts/map-pin-sections.js';
const ID='pneuma-scenetools';
test('section strings import plain text or HTML directly and preserve literal markup on export',()=>{
 assert.equal(sectionsHTML({Description:'First\nSecond',Factions:'The <strong>Bozos</strong>'}),'<h2>Description</h2><p>First</p><p>Second</p><h2>Factions</h2>The <strong>Bozos</strong>');
 const original='<h2>Example</h2><p>&lt;strong&gt;literal&lt;/strong&gt;</p>';
 assert.equal(sectionsHTML(exportSections(original)),original);
 assert.throws(()=>sectionsHTML({Description:{html:'<p>Old shape</p>'}}),/text string/);
});
test('all heading levels and formatted bodies remain named editable sections',()=>{
 const sections=exportSections('<h3 class="heading">Description</h3><p>Plain</p><h4>Details</h4><p>Some <strong>bold</strong> text</p>');
 assert.equal(sections.Description,'Plain');assert.equal(sections.Details,'<p>Some <strong>bold</strong> text</p>');
 assert.match(sectionsHTML(sections),/<strong>bold<\/strong>/);
});
function setup(){
  environment();game.journal=new Collection();
  const scene=makeScene();scene.flags={[ID]:{mapPinning:true}};scene.notes=new Collection();
  const page={id:'page',sort:100,type:'text',toObject:()=>({_id:'page',name:'Market',type:'text',text:{format:1,content:'<h2>Description</h2><p>Custom information</p>'},ownership:{default:2,oldUser:3}})};
  const journal={id:'journal',pages:new Collection([page]),toObject:()=>({_id:'journal',name:'Locations',ownership:{default:2,oldUser:3},flags:{[ID]:{poiSceneJournal:'old-scene'}}})};
  const data={_id:'pin',entryId:'journal',pageId:'page',x:100,y:200,texture:{src:'market.webp'},flags:{[ID]:{mapPin:{imagePageId:'page',descriptionPageId:'page'}}}};
  scene.notes.set('pin',{...data,id:'pin',entry:journal,toObject:()=>structuredClone(data)});
  let serial=0;foundry.utils.randomID=()=>`fresh-${serial++}`;
  globalThis.JournalEntry={create:async data=>{
    const doc={...structuredClone(data),id:'new-journal-'+serial++,pages:new Collection(),
      createEmbeddedDocuments:async(_type,rows)=>rows.map(row=>{const p={...structuredClone(row),id:row._id??'new-page-'+serial++};doc.pages.set(p.id,p);return p;}),
      delete:async()=>{game.journal.delete(doc.id);}};
    game.journal.set(doc.id,doc);return doc;
  }};
  scene.createEmbeddedDocuments=async(_type,rows)=>rows.map(row=>{const n={...structuredClone(row),id:row._id??'new-note-'+serial++};scene.notes.set(n.id,n);return n;});
  scene.deleteEmbeddedDocuments=async(_type,ids)=>{ids.forEach(id=>scene.notes.delete(id));};
  return scene;
}
test('editable JSON round trip preserves text and remaps all pin page references',async()=>{
  const scene=setup(),bundle=exportPins(scene);
  assert.equal(bundle.journals.length,1);assert.deepEqual(bundle.journals[0].data.ownership,{default:2});
  assert.equal(bundle.journals[0].data.flags,undefined);
  assert.deepEqual({...bundle.journals[0].pages[0].sections},{Description:'Custom information'});
  assert.equal(bundle.journals[0].pages[0].data.text,undefined);
  bundle.journals[0].pages[0].sections={Description:'Manually edited',Factions:'Local fixers',NPCs:'Rogue & friends'};
  await importPins(scene,JSON.stringify(bundle));
  assert.equal(scene.notes.size,2);
  const note=scene.notes.contents[1],journal=game.journal.get(note.entryId),page=journal.pages.get(note.pageId);
  assert.notEqual(note.entryId,'journal');assert.notEqual(note.pageId,'page');assert.match(page.text.content,/Manually edited/);
  assert.equal(note.flags[ID].mapPin.imagePageId,page.id);assert.equal(note.flags[ID].mapPin.descriptionPageId,page.id);
  assert.equal(note.texture.src,'market.webp');assert.equal(note.x,100);
  assert.match(page.text.content,/<h2>NPCs<\/h2><p>Rogue &amp; friends<\/p>/);
});
test('invalid references are rejected before import writes',async()=>{
  const scene=setup(),bundle=exportPins(scene);bundle.notes[0].page='missing';
  assert.throws(()=>parsePinBundle(JSON.stringify(bundle)),/unknown page/);
  await assert.rejects(importPins(scene,JSON.stringify(bundle)),/unknown page/);assert.equal(game.journal.size,0);
});
test('invalid POI settings are rejected before any document writes',async()=>{
 for(const bad of [123,[123],{},'[123]']){
  const scene=setup(),bundle=exportPins(scene);bundle.notes[0].data.flags[ID].mapPin.sections=bad;
  await assert.rejects(importPins(scene,JSON.stringify(bundle)),/fields/);assert.equal(game.journal.size,0);assert.equal(scene.notes.size,1);
 }
 for(const bad of [true,[],123]){
  const scene=setup(),bundle=exportPins(scene);bundle.notes[0].data.flags[ID].mapPin=bad;
  await assert.rejects(importPins(scene,JSON.stringify(bundle)),/settings/);assert.equal(game.journal.size,0);
 }
});
test('ordinary Note custom images survive named-section import',async()=>{
 const scene=setup(),bundle=exportPins(scene);bundle.notes[0].data.flags[ID].mapPin.imageSrc='custom.png';
 await importPins(scene,JSON.stringify(bundle));assert.equal(scene.notes.contents[1].flags[ID].mapPin.imageSrc,'custom.png');
});
test('handwritten partial POI settings receive safe field defaults',async()=>{
 const scene=setup(),bundle=exportPins(scene);bundle.notes[0].data.flags[ID].mapPin={hover:true};
 await importPins(scene,JSON.stringify(bundle));const flags=scene.notes.contents[1].flags[ID].mapPin;
 assert.equal(flags.sections,'');assert.equal(flags.category,'');assert.equal(flags.imagePageId,'');
});
test('managed POI images are stored on the imported page, not the Note',async()=>{
 const scene=setup(),bundle=exportPins(scene),page=bundle.journals[0].pages[0];
 page.data.flags={[ID]:{poi:true}};page.image={src:'authoritative.png',alt:'POI'};bundle.notes[0].data.flags[ID].mapPin.imageSrc='stale.png';
 await importPins(scene,JSON.stringify(bundle));const note=scene.notes.contents[1];
 assert.equal(note.flags[ID].mapPin.imageSrc,undefined);assert.match(game.journal.get(note.entryId).pages.get(note.pageId).text.content,/authoritative.png/);
});
test('batch import maps reordered results and cleans partial Note creation',async()=>{
 for(const partial of [false,true]){
  const scene=setup(),bundle=exportPins(scene);bundle.journals[0].pages.push({...structuredClone(bundle.journals[0].pages[0]),key:'second'});bundle.notes.push({...structuredClone(bundle.notes[0]),page:'second'});
  let pageCalls=0,noteCalls=0;const create=JournalEntry.create;
  JournalEntry.create=async data=>{const journal=await create(data),save=journal.createEmbeddedDocuments;journal.createEmbeddedDocuments=async(...args)=>{pageCalls++;return (await save(...args)).reverse()};return journal};
  const save=scene.createEmbeddedDocuments;scene.createEmbeddedDocuments=async(type,rows)=>{noteCalls++;return (await save(type,partial?rows.slice(0,1):rows)).reverse()};
  if(partial){await assert.rejects(importPins(scene,JSON.stringify(bundle)),/incomplete/);assert.equal(scene.notes.size,1);assert.equal(game.journal.size,0);}
  else {await importPins(scene,JSON.stringify(bundle));assert.equal(scene.notes.size,3);assert.notEqual(scene.notes.contents[1].pageId,scene.notes.contents[2].pageId);}
  assert.equal(pageCalls,1);assert.equal(noteCalls,1);
 }
});
test('failed import removes its documents and retains existing notes',async()=>{
  const scene=setup(),bundle=exportPins(scene);scene.createEmbeddedDocuments=async()=>undefined;
  await assert.rejects(importPins(scene,JSON.stringify(bundle)),/cancelled/);
  assert.equal(scene.notes.size,1);assert.equal(game.journal.size,0);
  game.user.isGM=false;assert.throws(()=>exportPins(scene),/Only GMs/);
});

test('named sections escape text, preserve order and blank paragraphs, and reject invalid values',()=>{
  assert.equal(sectionsHTML({Factions:'A & B\n2 < 3',NPCs:''}),'<h2>Factions</h2><p>A &amp; B</p><p>2 &lt; 3</p><h2>NPCs</h2><p></p>');
  assert.throws(()=>sectionsHTML({NPCs:123}),/text string/);
  assert.throws(()=>sectionsHTML(['NPCs']),/object/);
  assert.throws(()=>sectionsHTML({' ':'text'}),/nonempty/);
  for(const html of ['<h2>A</h2><p>1</p><h2>A</h2><p>2</p>'])assert.equal(exportSections(html),undefined);
});

test('legacy rich HTML imports unchanged and conflicting formats fail before writing',async()=>{
  const scene=setup(),bundle=exportPins(scene),page=bundle.journals[0].pages[0];
  const html='<section class="secret"><h2>Private</h2><p>Preserve</p></section>';
  page.data.text={format:1,content:html};
  await assert.rejects(importPins(scene,JSON.stringify(bundle)),/not both/);assert.equal(game.journal.size,0);
  delete page.sections;await importPins(scene,JSON.stringify(bundle));
  assert.equal(game.journal.contents[0].pages.contents[0].text.content,html);
});

test("PieSan's POI image does not force the journal back to HTML export",async()=>{
  const scene=setup(),original=scene.notes.get('pin').entry.pages.get('page');
  const html='<h2>Description</h2><p>Describe this location.</p><h2>Factions</h2><p>Bozos</p><h2>NPC\'s</h2><p></p><section data-poi-image="true"><h2>Image</h2><img src="pchassets/Art/Businesses/Piesans/Piesans-Crop.png" alt="PieSan\'s" /></section>';
  original.toObject=()=>({_id:'page',name:"PieSan's",type:'text',text:{format:1,content:html}});
  const bundle=exportPins(scene),page=bundle.journals[0].pages[0];
  assert.equal(page.data.text,undefined);
  assert.deepEqual({...page.sections},{Description:'Describe this location.',Factions:'Bozos',"NPC's":''});
  assert.deepEqual(page.image,{src:'pchassets/Art/Businesses/Piesans/Piesans-Crop.png',alt:"PieSan's"});
  page.sections.Factions='Edited faction';page.image.src='new/image.png';
  await importPins(scene,JSON.stringify(bundle));
  const note=scene.notes.contents[1],saved=game.journal.get(note.entryId).pages.get(note.pageId);
  assert.match(saved.text.content,/<h2>Factions<\/h2><p>Edited faction<\/p>/);
  assert.match(saved.text.content,/data-poi-image="true"/);assert.match(saved.text.content,/src="new\/image.png"/);
  assert.equal(note.flags[ID].mapPin.imageSrc,undefined);
});

test('edited POI headings, line breaks and either managed image layout export as named sections',async()=>{
 const scene=setup(),original=scene.notes.get('pin').entry.pages.get('page');
 const html='<h2>Image</h2><p></p><h2>Description</h2><p>Describe this location.</p><h2>Factions</h2><p>dfsdfdfdfsf</p><h2>NPCs</h2><p>Mr Now<br /></p><h2>My custom Heading</h2><p>Misc info I want players to see</p><h2>Image</h2><section data-poi-image="true"><img src="behavioral.png" alt="Behavioral Health" /></section>';
 original.toObject=()=>({name:'Behavioral Health',type:'text',text:{format:1,content:html}});
 const bundle=exportPins(scene),page=bundle.journals[0].pages[0];
 assert.equal(page.data.text,undefined);assert.equal(page.sections.NPCs,'Mr Now\n');assert.equal(page.sections['My custom Heading'],'Misc info I want players to see');assert.equal(page.image.src,'behavioral.png');
 await importPins(scene,JSON.stringify(bundle));assert.match(game.journal.contents[0].pages.contents[0].text.content,/Mr Now/);
});
test('section containers do not hide or block editable journal text',async()=>{
 const scene=setup(),original=scene.notes.get('pin').entry.pages.get('page');
 original.toObject=()=>({name:'Testing',type:'text',text:{format:1,content:'<h2>Description</h2><p>Location</p><section class="secret"><h2>GM notes</h2><p>Ordinary text</p></section><section data-poi-image="true"><h2>Image</h2><img src="testing.png" alt="Testing" /></section>'}});
 const bundle=exportPins(scene),page=bundle.journals[0].pages[0];assert.equal(page.data.text,undefined);assert.equal(page.sections['GM notes'],'Ordinary text');
 await importPins(scene,JSON.stringify(bundle));const saved=game.journal.contents[0].pages.contents[0];assert.doesNotMatch(saved.text.content,/class="secret"/);assert.match(saved.text.content,/Ordinary text/);
});
test('Note hover fields export as a comma-separated list and import into the native selection',async()=>{
 const scene=setup(),note=scene.notes.get('pin'),original=note.toObject;
 note.toObject=()=>{const data=original();data.flags[ID].mapPin.sections=JSON.stringify(['Factions',"NPC's",'My custom Heading']);return data;};
 const bundle=exportPins(scene);assert.equal(bundle.notes[0].data.flags[ID].mapPin.sections,"Factions, NPC's, My custom Heading");
 await importPins(scene,JSON.stringify(bundle));assert.deepEqual(JSON.parse(scene.notes.contents[1].flags[ID].mapPin.sections),['Factions',"NPC's",'My custom Heading']);
 for(const names of [[],['NPC, Contact']]){note.toObject=()=>{const data=original();data.flags[ID].mapPin.sections=JSON.stringify(names);return data;};scene.notes.delete(scene.notes.contents[1]?.id);const next=exportPins(scene);assert.deepEqual(next.notes[0].data.flags[ID].mapPin.sections,names);}
});
