import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {createMapPin,pinningEnabled,ensurePinTemplate} from '../dist/scripts/map-pins-data.js';
const ID='pneuma-scenetools';
class Collection extends Array {get(id){return this.find(x=>x.id===id)}get contents(){return this}}
const getProperty=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
let scene,template,created,deleted,failNote,failDelete;
const input={name:'Afterlife',icon:'icon.svg',category:'Food & nightlife',x:150,y:200,size:40,tint:'#ff00ff',global:true,hover:true};
beforeEach(()=>{
  created=[];deleted=[];failNote=false;failDelete=false;
  globalThis.foundry={utils:{getProperty}};
  globalThis.CONST={JOURNAL_ENTRY_PAGE_FORMATS:{HTML:1},DOCUMENT_OWNERSHIP_LEVELS:{NONE:0,OBSERVER:2,INHERIT:-1}};
  const page=(id,type)=>({id,type,name:id,toObject:()=>({_id:id,type,name:id,sort:id==='image'?100:200,ownership:{default:3,player:3},flags:{},text:{content:'<h2>Factions</h2><p>Original</p>'}})});
  template={id:'template',pages:new Collection(page('image','image'),page('description','text'),page('extra','text'))};
  globalThis.game={user:{isGM:true},journal:new Collection(template),folders:new Collection(),settings:{value:{journalId:'template',imagePageId:'image',descriptionPageId:'description',sections:'["Factions"]'},get(){return this.value},async set(_module,_key,value){this.value=value;return value}} };
  globalThis.Folder={async create(data){const folder={...data,id:'folder-'+game.folders.length,folder:game.folders.get(data.folder)};game.folders.push(folder);return folder;}};
  globalThis.JournalEntry={async create(data){created.push(structuredClone(data));const journal={...data,id:'copy-'+created.length,pages:new Collection(...(data.pages??[]).map((row,i)=>({...row,id:'template-page-'+i,toObject(){return {...row};}}))),async createEmbeddedDocuments(type,rows){return rows.map(row=>{const page={...row,id:'new-'+this.pages.length};this.pages.push(page);return page;});},async deleteEmbeddedDocuments(type,ids){if(failDelete)throw Error('Delete failed');for(const id of ids){deleted.push(id);this.pages.splice(this.pages.findIndex(p=>p.id===id),1);}}};game.journal.push(journal);return journal;}};
  scene={id:'scene-a',name:'Night City',flags:{[ID]:{mapPinning:true}},async createEmbeddedDocuments(type,rows){assert.equal(type,'Note');if(failNote)throw Error('Note failed');return rows.map(row=>({...row,id:'pin'}));}};
});
test('opt-in and GM boundaries block creation before journals are written',async()=>{
  scene.flags[ID].mapPinning=false;assert.equal(pinningEnabled(scene),false);
  await assert.rejects(()=>createMapPin(scene,input),/Enable/);assert.equal(created.length,0);
  scene.flags[ID].mapPinning=true;game.user.isGM=false;
  await assert.rejects(()=>createMapPin(scene,input),/Only GMs/);assert.equal(created.length,0);
});
test('one scene journal holds independent POI pages with view-only ownership',async()=>{
  const before=JSON.stringify(template.pages.map(p=>p.toObject()));
  const note=await createMapPin(scene,input);
  const second=await createMapPin(scene,{...input,name:'Market'});
  assert.equal(created.length,1);assert.deepEqual(created[0].ownership,{default:2});
  const journal=game.journal.get(note.entryId);
  assert.equal(journal.pages.length,2);
  for(const page of journal.pages){assert.equal(page.type,'text');assert.deepEqual(page.ownership,{default:2});assert.match(page.text.content,/Factions/);}
  assert.equal(note.entryId,second.entryId);assert.notEqual(note.pageId,second.pageId);
  assert.equal(note.flags[ID].mapPin.descriptionPageId,note.pageId);
  assert.equal(note.flags[ID].mapPin.imagePageId,note.pageId);
  assert.equal(note.texture.tint,input.tint);
  assert.equal(JSON.stringify(template.pages.map(p=>p.toObject())),before);
});
test('scene journal identity survives rename and separates same-name scenes',async()=>{
  const first=await createMapPin(scene,input);scene.name='Renamed';
  assert.equal((await createMapPin(scene,input)).entryId,first.entryId);
  assert.notEqual((await createMapPin({...scene,id:'scene-b',name:'Night City'},input)).entryId,first.entryId);
});
test('failed note creation removes only the new page; retry reuses the journal',async()=>{
  failNote=true;await assert.rejects(()=>createMapPin(scene,input),/Note failed/);assert.deepEqual(deleted,['new-0']);assert.equal(game.journal.get('copy-1').pages.length,0);
  failNote=false;assert.equal((await createMapPin(scene,input)).id,'pin');
});
test('cleanup failure reports retained page instead of claiming rollback',async()=>{
  failNote=true;failDelete=true;await assert.rejects(()=>createMapPin(scene,input),/could not be removed/);
});
test('a failed additional pin preserves existing POI pages',async()=>{
  const first=await createMapPin(scene,input);
  failNote=true;await assert.rejects(()=>createMapPin(scene,{...input,name:'Failed'}),/Note failed/);
  const journal=game.journal.get(first.entryId);
  assert.equal(journal.pages.length,1);assert.equal(journal.pages[0].id,first.pageId);
});
test('concurrent creation shares one scene journal',async()=>{
  const notes=await Promise.all([createMapPin(scene,input),createMapPin(scene,{...input,name:'Market'})]);
  assert.equal(created.length,1);assert.equal(notes[0].entryId,notes[1].entryId);
  assert.notEqual(notes[0].pageId,notes[1].pageId);
});
test('missing template page fails before writing journal',async()=>{
  template.pages.splice(0,1);await assert.rejects(()=>createMapPin(scene,input),/image or text page/);assert.equal(created.length,0);
});
test('deleted template is recreated and selected, with only one Image heading at the bottom',async()=>{
  game.journal.length=0;
  const note=await createMapPin(scene,{...input,imageSrc:'poi.webp'});
  const replacement=game.journal.find(j=>j.flags?.[ID]?.pinTemplate);
  assert.ok(replacement);assert.equal(game.settings.value.journalId,replacement.id);
  const content=game.journal.get(note.entryId).pages.get(note.pageId).text.content;
  assert.equal((content.match(/<h2>Image<\/h2>/g)??[]).length,1);
  assert.ok(content.indexOf('<h2>Image</h2>')>content.indexOf('<h2>Services</h2>'));
  assert.equal(content.includes('GM notes'),false);
  assert.equal(replacement.pages[0].text.content.includes('<h2>Image</h2>'),false);
  await createMapPin(scene,{...input,name:'Second POI'});
  assert.equal(created.length,2,'Reuse the replacement template and scene journal');
});

test('existing POI templates retain their exact content',async()=>{
  template.flags={[ID]:{pinTemplate:true}};
  const page=template.pages.find(page=>page.type==='text');
  page.text={content:'<h2>Description</h2><p>Keep this</p>'};
  page.update=async data=>{page.text.content=data.text.content;};
  await ensurePinTemplate();await ensurePinTemplate();
  assert.match(page.text.content,/Keep this/);
  assert.equal(page.text.content,'<h2>Description</h2><p>Keep this</p>');
});


test('player read toggle updates one page, explicit grants, and future-player default only',async()=>{
  const {setPinPlayerRead,playersCanReadPin}=await import('../dist/scripts/map-pin-permissions.js');
  game.users=[{id:'player',isGM:false},{id:'other',isGM:false},{id:'gm',isGM:true}];
  globalThis.ui={notifications:{info(){}}};
  const makeDocument=()=>({ownership:{default:2,player:3,gm:3},testUserPermission(user){return (this.ownership[user.id]??this.ownership.default)>=2},async update(changes){for(const [key,value] of Object.entries(changes))this.ownership[key.split('.')[1]]=value;}});
  const page=makeDocument(),sibling=makeDocument(),entry=makeDocument();
  entry.pages=new Map([['page',page],['sibling',sibling]]);
  const note={parent:scene,entry,pageId:'page'};
  await setPinPlayerRead(note,false);
  assert.equal(playersCanReadPin(note),false);
  assert.deepEqual(page.ownership,{default:0,player:0,other:0,gm:3});
  assert.deepEqual(sibling.ownership,{default:2,player:3,gm:3});
  assert.deepEqual(entry.ownership,{default:2,player:3,gm:3});
  await setPinPlayerRead(note,true);assert.equal(playersCanReadPin(note),true);
  assert.equal(page.ownership.player,2);
  page.update=async()=>{};
  await assert.rejects(()=>setPinPlayerRead(note,false),/did not save/);
  game.user.isGM=false;await assert.rejects(()=>setPinPlayerRead(note,false),/Only GMs/);
  game.user.isGM=true;scene.flags[ID].mapPinning=false;await assert.rejects(()=>setPinPlayerRead(note,false),/Only GMs/);
});


test('bulk POI edits batch only selected IDs and specified fields',async()=>{
  const {applyPinStyle}=await import('../dist/scripts/map-pins-bulk.js');
  scene.notes=new Map([['a',{}],['b',{}],['c',{}]]);
  let writes=[];
  scene.updateEmbeddedDocuments=async(type,updates)=>{assert.equal(type,'Note');writes.push(updates);return updates.map(update=>({id:update._id}));};
  const data=new FormData();data.set('size','64');data.set('hover','false');data.set('sectionsMode','selected');data.append('sections','Factions');
  await applyPinStyle(scene,['a','b','a'],data);
  assert.deepEqual(writes,[[{_id:'a',iconSize:64,'flags.pneuma-scenetools.mapPin.hover':false,'flags.pneuma-scenetools.mapPin.sections':'["Factions"]'},{_id:'b',iconSize:64,'flags.pneuma-scenetools.mapPin.hover':false,'flags.pneuma-scenetools.mapPin.sections':'["Factions"]'}]]);
  await assert.rejects(()=>applyPinStyle(scene,['c'],new FormData()),/at least one appearance/);
  data.set('size','NaN');await assert.rejects(()=>applyPinStyle(scene,['c'],data),/whole numbers/);
  data.set('size','64');await assert.rejects(()=>applyPinStyle(scene,['gone'],data),/deleted/);
  game.user.isGM=false;await assert.rejects(()=>applyPinStyle(scene,['c'],data),/Only GMs/);
  assert.equal(writes.length,1);
});


test('shared creation saves image, hover selections, elevation and sort at creation',async()=>{
  let saved;
  scene.createEmbeddedDocuments=async(_type,rows)=>{saved=rows[0];return [{...saved,id:'pin'}];};
  const note=await createMapPin(scene,{...input,imageSrc:'image.png',sections:'["Factions"]',elevation:4,sort:7});
  assert.equal(saved.elevation,4);assert.equal(saved.sort,7);
  assert.equal(saved.flags[ID].mapPin.sections,'["Factions"]');assert.equal(saved.flags[ID].mapPin.imageSrc,'image.png');
  const page=game.journal.get(note.entryId).pages[0];
  assert.match(page.text.content,/data-poi-image="true"/);assert.match(page.text.content,/src="image.png"/);
});
