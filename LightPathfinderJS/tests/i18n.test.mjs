import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EN,tr,setLanguage,getLanguage,messageKey,mapLabel} from '../src/i18n.js';
import {dialogueEntries} from '../src/dialogue.js';
import {STORY_DIALOGUE} from '../src/story-dialogue.js';
const data=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
test('every original map dialogue and choice has an English localization',()=>{
  const missing=new Set();
  for(let id=1;id<=9;id++)for(const event of Object.values(data(`Map00${id}`).events))for(const page of event.pages)for(let i=0;i<page.list.length;i++) {
    const command=page.list[i];
    if(command.code===101) {
      const lines=[command.parameters[0]];while(page.list[i+1]?.code===401)lines.push(page.list[++i].parameters[0]);
      for(const {text} of dialogueEntries(lines))if(/[а-яіїєґ]/iu.test(text)&&!EN[messageKey(text)])missing.add(messageKey(text));
    }
    if(command.code===102)for(const text of command.parameters[0])if(/[а-яіїєґ]/iu.test(text)&&!EN[messageKey(text)])missing.add(messageKey(text));
  }
  assert.deepEqual([...missing],[]);
});
test('all authored expansion dialogue and choices are translated',()=>{
  for(const line of Object.values(STORY_DIALOGUE.scenes).flat())if(/[а-яіїєґ]/iu.test(line.text))assert(EN[messageKey(line.text)],line.text);
  for(const line of Object.values(STORY_DIALOGUE.choices).flat())assert(EN[messageKey(line.text)],line.text);
});
test('custom database names, descriptions and slang stats are translated',()=>{
  for(const name of ['Actors','Items','Skills','Weapons','Armors','Classes','Enemies','Troops'])for(const entry of data(name).filter(Boolean))for(const text of [entry.name,entry.description]) {
    if(text&&/[а-яіїєґ]/iu.test(text))assert(EN[messageKey(text)],`${name}: ${text}`);
  }
  for(const text of Object.values(data('System').words))if(/[а-яіїєґ]/iu.test(text))assert(EN[messageKey(text)],text);
});
test('Ukrainian prose is untouched and English retains profanity and local references',()=>{
  const text=STORY_DIALOGUE.scenes.smoke[1].text;
  setLanguage('uk');assert.equal(tr(text),text);
  setLanguage('en');assert.equal(getLanguage(),'en');assert.match(tr(text),/Zibrov/);assert.match(tr(text),/fuuuck/);
  assert.equal(tr('Лу́па'),'Lupa');assert.equal(tr('Батя'),'Batya');assert.equal(mapLabel(7,'Sluha'),'Slutville');
  assert.match(tr(STORY_DIALOGUE.scenes.priest[0].text),/Fuck off, my son/);
  assert.equal(tr('Нова гра'),'New game');setLanguage('uk');
});
test('dynamic UI templates localize names and values without changing IDs or counts',()=>{
  setLanguage('en');assert.equal(tr('Глузд: 45/100 · Фінали: 2/3'),'Sanity: 45/100 · Endings: 2/3');
  assert.equal(tr('Лупа  ·  Рівень 2'),'Lupa · Level 2');
  assert.equal(tr('Кров  15 / 100'),'Blood 15 / 100');
  assert.equal(tr('Член: Святе Причастя'),'Cock: Holy Communion');
  assert.equal(tr('Файл 1 · Лупа · рівень 1\nМапа 7 · 246 філок'),'File 1 · Lupa · level 1\nMap 7 · 246 filky');
  setLanguage('uk');assert.equal(tr('Game saved.'),'Гру збережено.');
});
