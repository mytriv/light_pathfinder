import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NpcMotion} from '../src/npc-motion.js';
const map=id=>JSON.parse(readFileSync(new URL(`../data/Map00${id}.json`,import.meta.url)));
function setup(events,random=()=>.05) {
  const e={map:{width:40,height:30,events},player:{x:35,y:25},activePage:e=>e.pages[0],isPassable:()=>true};
  const motion=new NpcMotion(e,random);return {e,motion};
}
function tick(motion,until) {for(let t=0;t<=until;t+=25)motion.update(t);}
test('original chickens and residents walk and animate; main characters remain fixed',()=>{
  const original=map(3),events=structuredClone(original.events),{motion}=setup(events);
  const patterns=new Set();for(let t=0;t<=5000;t+=25){motion.update(t);patterns.add(motion.sprite(events[7],events[7].pages[0],t).pattern);}
  assert.notDeepEqual([events[7].x,events[7].y],[original.events[7].x,original.events[7].y]);
  assert(patterns.size>1);
  for(const id of [5,6])assert.deepEqual([events[id].x,events[id].y],[original.events[id].x,original.events[id].y]);
});
test('original children and guards use their own XP speed and frequency',()=>{
  for(const [id,eventId]of [[5,13],[7,5]]){
    const original=map(id).events[eventId],event=structuredClone(original),{motion}=setup({[event.id]:event});
    tick(motion,5000);assert.notDeepEqual([event.x,event.y],[original.x,original.y]);
    assert.equal(motion.states.get(event.id).page.move_speed,original.pages[0].move_speed);
  }
});
test('approach and custom patrol routes execute original move types',()=>{
  const chicken=map(1).events[2],approach=setup({2:chicken});approach.e.player={x:18,y:9};tick(approach.motion,900);
  assert.equal(chicken.x,17);assert.equal(chicken.y,9);
  const sailor=map(7).events[11],patrol=setup({11:sailor});tick(patrol.motion,6500);
  assert(sailor.x>5);assert.equal(sailor.y,14);
});
test('NPCs collide with terrain, player, other NPCs and reserved in-flight tiles',()=>{
  const event=map(7).events[5];event.x=2;event.y=2;
  const other=structuredClone(event);other.id=99;other.x=4;other.y=2;
  const {e,motion}=setup({5:event,99:other});const page=event.pages[0],s=motion.state(event,page,0);
  e.isPassable=(x,y,d)=>d!==2;assert(!motion.move(event,page,s,2,0));
  e.isPassable=()=>true;e.player={x:3,y:2};assert(!motion.move(event,page,s,6,0));
  e.player={x:35,y:25};assert(motion.move(event,page,s,6,0));
  assert(motion.occupies(event,2,2));assert(motion.occupies(event,3,2));
  assert(!motion.canMove(other,other.pages[0],4,2,4));
  const halfway=motion.sprite(event,page,100);assert(halfway.x>2&&halfway.x<3);
});
test('talking locks only the active NPC; menus pause movement; page changes reset routes',()=>{
  const a=map(7).events[5],b=map(7).events[6],{e,motion}=setup({5:a,6:b});
  const start=[a.x,a.y];e.currentEvent=a;tick(motion,1500);assert.deepEqual([a.x,a.y],start);assert(b.y>11);
  const pos=[b.x,b.y];e.menu={};for(let t=1525;t<4000;t+=25)motion.update(t);assert.deepEqual([b.x,b.y],pos);
  const newPage={...b.pages[0],move_type:0,graphic:{...b.pages[0].graphic,pattern:0}};b.pages[0]=newPage;
  e.menu=null;motion.update(4000);assert.equal(motion.states.get(6).page,newPage);assert.equal(motion.sprite(b,newPage,4000).pattern,0);
});
