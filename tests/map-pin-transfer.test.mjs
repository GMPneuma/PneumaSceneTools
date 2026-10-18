import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,makeScene,Collection} from './netarch/helpers.mjs';
import {exportPins,importPins,parsePinBundle} from '../dist/scripts/map-pin-transfer.js';
import {exportSections,sectionsHTML} from '../dist/scripts/map-pin-sections.js';
const ID='pneuma-scenetools';
function setup(){
  environment();game.journal=new Collection();
  const scene=makeScene();scene.flags={[ID]:{mapPinning:true}};scene.notes=new Collection();
  const page={id:'page',sort:100,type:'text',toObject:()=>({_id:'page',name:'Market',type:'text',text:{format:1,content:'<h2>Description</h2><p>Custom information</p>'},ownership:{default:2,oldUser:3}})};
  const journal={id:'journal',pages:new Collection([page]),toObject:()=>({_id:'journal',name:'Locations',ownership:{default:2,oldUser:3},flags:{[ID]:{poiSceneJournal:'old-scene'}}})};
  const data={_id:'pin',entryId:'journal',pageId:'page',x:100,y:200,texture:{src:'market.webp'},flags:{[ID]:{mapPin:{imagePageId:'page',descriptionPageId:'page'}}}};
  scene.notes.set('pin',{...data,id:'pin',entry:journal,toObject:()=>structuredClone(data)});
  let serial=0;
  globalThis.JournalEntry={create:async data=>{
    const doc={...structuredClone(data),id:'new-journal-'+serial++,pages:new Collection(),
      createEmbeddedDocuments:async(_type,rows)=>rows.map(row=>{const p={...structuredClone(row),id:'new-page-'+serial++};doc.pages.set(p.id,p);return p;}),
      delete:async()=>{game.journal.delete(doc.id);}};
    game.journal.set(doc.id,doc);return doc;
  }};
  scene.createEmbeddedDocuments=async(_type,rows)=>rows.map(row=>{const n={...structuredClone(row),id:'new-note-'+serial++};scene.notes.set(n.id,n);return n;});
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
test('failed import removes its documents and retains existing notes',async()=>{
  const scene=setup(),bundle=exportPins(scene);scene.createEmbeddedDocuments=async()=>undefined;
  await assert.rejects(importPins(scene,JSON.stringify(bundle)),/cancelled/);
  assert.equal(scene.notes.size,1);assert.equal(game.journal.size,0);
  game.user.isGM=false;assert.throws(()=>exportPins(scene),/Only GMs/);
});

test('named sections escape text, preserve order and blank paragraphs, and reject invalid values',()=>{
  assert.equal(sectionsHTML({Factions:'A & B\n<not html>',NPCs:''}),'<h2>Factions</h2><p>A &amp; B</p><p>&lt;not html&gt;</p><h2>NPCs</h2><p></p>');
  assert.throws(()=>sectionsHTML({NPCs:123}),/text string/);
  assert.throws(()=>sectionsHTML(['NPCs']),/object/);
  assert.throws(()=>sectionsHTML({' ':'text'}),/nonempty/);
  for(const html of ['<section class="secret"><h2>Secrets</h2><p>Private</p></section>','<h2>Image</h2><img src="x">','<h2>A</h2><p>1</p><h2>A</h2><p>2</p>','<h2>A</h2><p><strong>Bold</strong></p>'])assert.equal(exportSections(html),undefined);
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
  assert.equal(note.flags[ID].mapPin.imageSrc,'new/image.png');
});
