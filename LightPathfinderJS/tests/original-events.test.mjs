import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PathfinderEngine} from '../src/engine.js';
import {StoryExpansion} from '../src/story-expansion.js';
const data=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
globalThis.document={querySelector:()=>null};
function setup(mapId) {
  const e=Object.create(PathfinderEngine.prototype);
  Object.assign(e,{mapId,map:data(`Map00${mapId}`),system:data('System'),actors:data('Actors'),selfSwitches:new Map(),switches:[],variables:[],story:{},inventory:{items:{},weapons:{},armors:{}},party:{hp:100,maxHp:100,sp:50,level:1,gold:0},equipment:{},player:{x:10,y:10,direction:2,characterName:'001-Fighter01'},messages:[],choices:[],images:new Map()});
  e.actor=e.actors[1];e.player.battlerName=e.actor.battler_name;
  for(const name of ['001-Fighter01','gallery_10517_34_1007'])e.images.set(`assets/Graphics/Characters/${name}.png`,{});
  e.loadMap=async function(id,x,y,direction){this.mapId=id;this.map=data(`Map00${id}`);Object.assign(this.player,{x,y,direction});this.expansion.prepareMap();};
  e.showMessage=async lines=>e.messages.push(...lines.map(line=>typeof line==='object'?`${line.speaker}: ${line.text}`:line));e.showChoices=async()=>e.choices.shift();e.refreshAutorun=()=>{};
  e.saveGame=()=>{e.saved=structuredClone({mapId:e.mapId,player:e.player,story:e.story,inventory:e.inventory});return true;};
  e.expansion=new StoryExpansion(e);e.expansion.prepareMap();
  return e;
}
async function run(e,id){const event=e.map.events[id];await e.runEvent(event,e.activePage(event));}
test('city Za retains every original introduction line before any guard encounter',async()=>{
  const e=setup(7),original=data('Map007').events[17].pages[0].list;
  await run(e,17);
  for(const c of original.filter(c=>c.code===101||c.code===401))assert(e.messages.some(text=>text.includes(c.parameters[0])));
  assert(!e.messages.some(text=>text.includes('Намаж ним сходи')));
  assert.equal(e.inventory.items[1],undefined);assert.equal(e.expansion.state.vaselineAdvice,undefined);
  e.messages=[];await run(e,17);assert(!e.messages.some(text=>text.includes('Намаж ним сходи')));
  assert(e.map.events[17].pages[1].graphic.character_name);
});
test('vaseline advice follows guards and requires the original earlier item reward',async()=>{
  const e=setup(7);await run(e,17);await run(e,3);assert(e.expansion.state.guardsMet);assert.equal(e.mapId,7);
  e.messages=[];await run(e,17);assert(!e.messages.some(text=>text.includes('Намаж ним сходи')));
  e.inventory.items[1]=1;await run(e,17);assert(e.expansion.state.vaselineAdvice);
  e.choices=[0];await run(e,3);assert.equal(e.mapId,8);assert.equal(e.inventory.items[1],0);
});
test('original Za conversation grants vaseline and sets its source-map self switch after transfer',async()=>{
  const e=setup(3);await run(e,5);
  assert.equal(e.mapId,1);assert.equal(e.inventory.items[1],1);
  assert(e.selfSwitches.get('3:5:A'));assert(!e.selfSwitches.get('1:5:A'));
  assert(e.messages.some(text=>text.includes('На візьми трохи вазеліну.')));
});
test('original post-battle branch changes to the original naked sprite before autosaving',async()=>{
  const e=setup(2);e.choices=[1];e.playFirstTurnBattle=async()=>2;await run(e,3);
  assert.equal(e.mapId,3);assert.equal(e.player.characterName,'gallery_10517_34_1007');
  assert.equal(e.player.battlerName,'char1_47_47');assert.equal(e.saved.player.characterName,'gallery_10517_34_1007');
  assert(e.story.bossDefeated);assert.equal(e.saved.mapId,3);
});
test('both original clothing chests restore the sprite and keep their individual rewards and dialogue',async()=>{
  const e=setup(9);e.player.characterName='gallery_10517_34_1007';await run(e,1);
  assert.equal(e.player.characterName,'001-Fighter01');assert.equal(e.inventory.armors[14],1);assert(e.selfSwitches.get('9:1:A'));
  assert(!e.selfSwitches.get('9:2:A'));await run(e,2);assert.equal(e.inventory.armors[18],1);
  assert(e.messages.some(text=>text.includes('Як добре що я знайшов одяг.')));
  await run(e,1);assert.equal(e.inventory.armors[14],1);
});
test('shifted warehouse entrance takes priority over the decorative event on its tile',()=>{
  const e=setup(7);e.player.x=33;e.player.y=11;e.player.direction=6;
  let chosen;e.runEvent=event=>{chosen=event.id;};e.interact();assert.equal(chosen,15);
  assert.deepEqual([e.map.events[102].x,e.map.events[102].y],[31,17]);
});
test('walking into the warehouse activates its doorway before the wall collision',()=>{
  const e=setup(7);e.player.x=33;e.player.y=11;
  let chosen;e.runEvent=event=>{chosen=event.id;};e.isPassable=()=>false;e.tryMove(6,0);
  assert.equal(chosen,15);
  const exit=setup(9);exit.player.x=10;exit.player.y=12;exit.runEvent=event=>{chosen=event.id;};exit.isPassable=()=>false;
  chosen=null;exit.tryMove(2,0);assert.equal(chosen,4);
});
