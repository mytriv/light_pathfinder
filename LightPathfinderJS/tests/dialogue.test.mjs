import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dialogueEntries,dialoguePages,originalEventSpeaker} from '../src/dialogue.js';
import {STORY_DIALOGUE} from '../src/story-dialogue.js';
test('original standalone speaker labels are metadata and remain on every body row',()=>{
  const entries=dialogueEntries(['За: ','Думаю тобі треба спитати когось,','про твою маман.','Лу́па:','...']);
  assert.deepEqual(entries,[{speaker:'За',text:'Думаю тобі треба спитати когось,\nпро твою маман.'},{speaker:'Лу́па',text:'...'}]);
});
test('all pages of a long authored line carry the speaker without adding it to the body',()=>{
  const line=STORY_DIALOGUE.scenes.priest[2];
  const pages=dialoguePages([line],text=>text.match(/.{1,24}/gu));
  assert(pages.length>1);assert(pages.every(p=>p.speaker==='Священик'));
  assert.equal(pages.map(p=>p.text.replace(/\n/g,'')).join(''),line.text);
});
test('inline labels change speakers and structured system errors retain their actual speaker',()=>{
  const entries=dialogueEntries(['Моряк: Ні.','За: ...',{speaker:'Система',text:"Uncaught TypeError: Cannot read property 'brain'"}]);
  assert.deepEqual(entries.map(e=>e.speaker),['Моряк','За','Система']);
  assert.equal(entries[2].text,"Uncaught TypeError: Cannot read property 'brain'");
});
test('unlabelled original dialogue gets an NPC name or an explicit system label',()=>{
  assert.equal(originalEventSpeaker(7,{id:6},{graphic:{character_name:'049-Soldier01'}}),'Стражник');
  assert.equal(originalEventSpeaker(6,{id:1},{graphic:{character_name:'108-Civilian08'}}),'Трактирщик');
  assert.equal(dialogueEntries(['Гру збережено.'])[0].speaker,'Система');
  assert.equal(dialogueEntries(['Відчепись.'],'Місцевий')[0].speaker,'Місцевий');
});
test('system notifications after inline speech do not inherit the NPC name',()=>{
  const entries=dialogueEntries(['За: Сушений спайс.','Отримано заправку для кадила.']);
  assert.deepEqual(entries.map(e=>e.speaker),['За','Система']);
});
