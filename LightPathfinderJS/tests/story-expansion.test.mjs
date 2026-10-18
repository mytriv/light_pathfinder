import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {StoryExpansion} from '../src/story-expansion.js';
import {STORY_DIALOGUE} from '../src/story-dialogue.js';
import {buildStoryRoom} from '../src/story-maps.js';
globalThis.document={querySelector:()=>null};
function setup(old={}) {
  const e={story:{expansion:old},selfSwitches:new Map(),inventory:{items:{},weapons:{},armors:{}},party:{gold:0,hp:100},map:{events:{1:{pages:[{graphic:{}}]}}},mapId:7,system:{start_map_id:1,start_x:10,start_y:9},
    saveGame(){this.saved=structuredClone(this.story);return true;},finishGame(state){this.terminalState=state;this.gameEnded=true;},async loadMap(id,x,y){this.mapId=id;this.player={x,y};},async showMessage(lines){this.messages.push(...lines);},async showChoices(){return this.choices.shift();},choices:[],messages:[]};
  const s=new StoryExpansion(e);e.expansion=s;return {s,e};
}
test('legacy wardrobe migration and bounded sanity',()=>{
  const {e}=setup();e.selfSwitches.set('9:1:A',true);const s=new StoryExpansion(e);
  assert(s.has('SWITCH_HAS_CLOTHES'));s.sanity(-1000);assert.equal(s.state.VAR_SANITY,0);s.sanity(1000);assert.equal(s.state.VAR_SANITY,100);
});
test('priest enforces sanity and money requirements; rewards once',async()=>{
  const {s,e}=setup();e.choices=[0];await s.priest();assert(!s.has('SWITCH_SPICE_CENSER'));
  e.choices=[1];await s.priest();assert.equal(e.party.gold,0);assert(!s.has('SWITCH_SPICE_CENSER'));
  e.party.gold=60;e.choices=[1];await s.priest();assert.equal(e.party.gold,10);assert(s.has('SWITCH_SPICE_CENSER'));
  await s.priest();assert.equal(e.party.gold,10);
  const thief=setup();thief.s.sanity(-25);thief.e.choices=[0];await thief.s.priest();assert(thief.s.has('SWITCH_SPICE_CENSER'));
});
test('free route: Za, guards, wardrobe, father, mother and all endings',async()=>{
  const {s,e}=setup();e.inventory.items[1]=1;assert.equal(await s.handleEvent({id:17}),false);assert(!s.state.vaselineAdvice);
  await s.entrance();assert(s.state.guardsMet);await s.handleEvent({id:17});assert(s.state.vaselineAdvice);
  e.choices=[0];await s.entrance();assert.equal(e.mapId,8);assert(s.has('SWITCH_VASELINE_TRAP'));
  e.mapId=9;assert.equal(await s.handleEvent({id:1}),false);assert(s.has('SWITCH_HAS_CLOTHES'));
  e.mapId=10;e.choices=[1];await s.father();assert(s.state.fatherDefeated);
  await s.handleEvent({storyKey:'mother'});const sanity=s.state.VAR_SANITY;await s.handleEvent({storyKey:'mother'});assert.equal(s.state.VAR_SANITY,sanity);
  for(let i=0;i<3;i++){e.choices=[i,0];await s.mirror();assert.equal(e.mapId,11+i);assert.equal(s.state.VAR_ENDING_CHOICE,i+1);assert(e.saved.expansion.endingSeen);assert.equal(e.terminalState.crash,i===2);}
  assert.equal(s.state.unlocked.length,3);assert.equal(s.state.VAR_SANITY,0);assert(s.has('SWITCH_SCHIZO_REVEALED'));
});
test('censer route requires fuel, father failure stays recoverable',async()=>{
  const {s,e}=setup();s.state.guardsMet=true;s.flag('SWITCH_SPICE_CENSER');e.choices=[1];await s.entrance();assert.equal(e.mapId,7);
  await s.handleEvent({storyKey:'herbs'});const sanity=s.state.VAR_SANITY;await s.handleEvent({storyKey:'herbs'});assert.equal(s.state.VAR_SANITY,sanity);
  e.choices=[1];await s.entrance();assert.equal(e.mapId,8);e.mapId=10;e.choices=[2];await s.father();assert(s.state.fatherDefeated);
  const other=setup();other.e.choices=[1];await other.s.father();assert(!other.s.state.fatherDefeated);
  other.e.choices=[0];await other.s.father();assert.equal(other.e.mapId,7);assert.equal(other.e.party.hp,50);
});
test('expansion save resumes without resetting flags or endings',()=>{
  const {s,e}=setup();s.flag('SWITCH_SPICE_CENSER');s.state.unlocked=[1,3];s.state.VAR_SANITY=12;e.saveGame();
  const restored=setup(e.saved.expansion).s;assert(restored.has('SWITCH_SPICE_CENSER'));assert.deepEqual(restored.state.unlocked,[1,3]);assert.equal(restored.state.VAR_SANITY,12);
});
test('all authored dialogue is verbatim, including punctuation and combining accents',()=>{
  const lines=readFileSync(new URL('../data/story-expansion-source.txt',import.meta.url),'utf8').split(/\r?\n/);
  const entries=Object.values(STORY_DIALOGUE.scenes).flat();
  assert.equal(entries.length,41);
  for(const entry of entries)assert.equal(entry.text,lines[entry.line],`source line ${entry.line}`);
  assert.equal(STORY_DIALOGUE.choices.priest[2].text,'Послати священика нахуй');
});
test('new rooms use only original XP tiles and a reachable mirror',()=>{
  for(const id of [10,11,12,13,14]) {
    const map=buildStoryRoom(id);assert.equal(map.tileset_id,12);assert.equal(map.data.data.length,900);
    assert(!map.expansionBackground);assert(map.data.data.filter(Boolean).every(tile=>tile>=384&&tile<=551));
  }
  const office=buildStoryRoom(10);assert.equal(office.data.data[300+4*20+15],462);
  assert(!office.blocked.some(([x,y])=>x===15&&y===6));
});
