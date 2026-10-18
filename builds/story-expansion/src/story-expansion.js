import { STORY_DIALOGUE } from './story-dialogue.js';
import { buildStoryRoom } from './story-maps.js';
import {tr} from './i18n.js';
// Story state is namespaced inside the existing v1 save; XP switch IDs stay untouched.
export const FLAGS = ['SWITCH_HAS_CLOTHES','SWITCH_SPICE_CENSER','SWITCH_VASELINE_TRAP','SWITCH_SCHIZO_REVEALED'];
const event = (id,x,y,key,name='') => ({id,x,y,name:key,storyKey:key,pages:[{condition:{},trigger:0,through:false,graphic:{character_name:name,direction:2,pattern:1},list:[]}]});

export class StoryExpansion {
  constructor(engine) {
    this.e=engine;
    this.listeners=new AbortController();
    const old=engine.story.expansion||{};
    this.state=engine.story.expansion={version:1,VAR_SANITY:70,VAR_ENDING_CHOICE:0,flags:{},quests:{},unlocked:[],...old};
    this.state.flags={...old.flags}; this.state.quests={...old.quests};
    this.state.VAR_SANITY=Math.max(0,Math.min(100,Number(this.state.VAR_SANITY)||0));
    // The wardrobe chest could already have been opened in a pre-expansion save.
    if(engine.selfSwitches.get('9:1:A')||engine.selfSwitches.get('9:2:A')) this.flag('SWITCH_HAS_CLOTHES');
    this.bindJournal();
  }

  flag(key,value=true) { this.state.flags[key]=value; }
  has(key) { return Boolean(this.state.flags[key]); }
  sanity(delta) { this.state.VAR_SANITY=Math.max(0,Math.min(100,this.state.VAR_SANITY+delta)); }
  async say(...lines) { await this.e.showMessage(lines); }
  async scene(key) { await this.e.showMessage(STORY_DIALOGUE.scenes[key]); }
  options(key) { return STORY_DIALOGUE.choices[key].map(({text})=>text); }
  async choose(options) { return this.e.showChoices(options,-1); }
  checkpoint() { this.e.saveGame(); this.refresh(); }

  createMap(id) {
    const room=buildStoryRoom(id);
    if(!room) return null;
    let events=[];
    if(id===10) events=[event(1,9,6,'father','042-King01'),event(2,15,5,'mirror'),event(3,9,13,'office-exit')];
    if(id===11) events=[event(1,12,6,'ending','049-Soldier01')];
    if(id===12) events=[event(1,10,7,'ending','018-Thief03')];
    if(id===13) events=[event(1,10,6,'ending','150-Sailor01')];
    if(id===14) events=[event(1,10,5,'mother','025-Cleric01'),event(2,10,13,'cellar-exit')];
    return {...room,events:Object.fromEntries(events.map(e=>[e.id,e]))};
  }

  prepareMap() {
    const e=this.e;
    // Add accessible return routes and quest contacts without editing exported XP data.
    const add=(id,x,y,key,name='')=>{e.map.events[id]=event(id,x,y,key,name);};
    if(e.mapId===7) {
      // Keep Za's original introduction. His later advice needs the same contact.
      const za=e.map.events[17],intro=za.pages[0];
      za.pages[1]={...za.pages[1],graphic:{...intro.graphic},list:intro.list};
      add(101,26,13,'priest','026-Cleric02');
      add(102,31,17,'herbs','176-Chest03');
      e.map.events[15].x=34;
      e.map.events[15].entryTouch=true;
      add(103,23,13,'grounding','150-Sailor01');
    }
    if(e.mapId===8) {
      // Replace the old "coming soon" touch event with a playable entrance.
      e.map.events[2].storyKey='lobby';
      e.map.events[1].storyKey='lobby';
      add(101,9,12,'lobby-exit');
    }
    if(e.mapId===6) add(101,8,10,'cellar-door','176-Chest03');
    if(e.mapId===9) {
      e.map.events[4].entryTouch=true;e.map.events[4].touchExitDirection=2;
      // Return to the walkable tile beside the shifted warehouse door.
      for(const page of e.map.events[4].pages)for(const command of page.list||[]) {
        if(command.code===201&&command.parameters[1]===7)command.parameters[2]=33;
      }
    }
    if(e.mapId===10) {
      e.map.events[1].pages[0].graphic.character_name=this.state.fatherDefeated?'':'042-King01';
    }
    this.refresh();
  }

  async handleEvent(event) {
    const e=this.e,id=e.mapId,key=event.storyKey;
    if(key==='priest'||(id===5&&event.id===20)) { await this.priest(); return true; }
    if(id===9&&(event.id===1||event.id===2)) {
      this.flag('SWITCH_HAS_CLOTHES');
      return false; // Original rewards, text and Change Actor Graphic command.
    }
    if(id===7&&event.id===17) {
      if(!this.state.zaCityIntro) {this.state.zaCityIntro=true;return false;}
      if(!this.state.guardsMet||!(e.inventory.items[1]>0))return false;
      this.state.vaseline=true;this.state.vaselineAdvice=true;
      await this.scene('za');this.checkpoint();return true;
    }
    if(id===7&&event.id>=5&&event.id<=10) {this.state.guardsMet=true;return false;}
    if(id===7&&event.id===3) { await this.entrance(); return true; }
    if(key==='herbs') {
      if(this.state.herbs) await this.say('У підворітті залишився тільки запах сушеної трави.');
      else {
        this.state.herbs=true; this.sanity(-25);
        await this.say('За: Сушений спайс. Священик називає це «ароматом одкровення».','Отримано заправку для кадила. Глузд −25.'); this.checkpoint();
      } return true;
    }
    if(key==='grounding') {
      const pick=await this.choose(['Посидіти біля річки (+20 глузду)','Спитати про За (−25 глузду)','Піти']);
      if(pick===0) {
        this.sanity(20); await this.say('Ти рахуєш хвилі й переводиш подих. Голос За стихає.');
      } else if(pick===1) {
        this.sanity(-25); await this.say('Моряк: Який ще За? Ти тут сам стоїш.','За: Не слухай його. Він навіть власному відображенню гроші винен.');
      }
      this.checkpoint(); return true;
    }
    if(key==='lobby') {
      if(!this.state.inside) { this.state.inside=true; await this.scene('lobby'); }
      await e.loadMap(10,9,11,8); this.checkpoint(); return true;
    }
    if(key==='office-exit') { await e.loadMap(7,21,14,2); this.checkpoint(); return true; }
    if(key==='lobby-exit') { await e.loadMap(7,21,14,2); return true; }
    if(key==='father') { await this.father(); return true; }
    if(key==='mirror') { await this.mirror(); return true; }
    if(key==='cellar-door') {
      if(this.state.fatherDefeated) { await e.loadMap(14,10,11,8); this.checkpoint(); }
      else await this.say({speaker:'Система',text:'Люк замкнений.'},{speaker:'Трактирщик',text:'Ключі у директора борделю. Не питай.'});
      return true;
    }
    if(key==='cellar-exit') { await e.loadMap(6,7,10,2); this.checkpoint(); return true; }
    if(key==='mother') {
      if(!this.state.quests.mother) {
        this.state.quests.mother=true; this.sanity(20);
        await this.say('Мати: Жива я. Батя замкнув мене тут через борги. А ти з ким весь час говориш?','Лупа: Із За. Він стоїть поруч.','Мати: Поруч лише порожня бочка. Подивись у дзеркало, синку.','Побічний квест «Слід матері» завершено. Глузд +20.');
        this.checkpoint();
      } else await this.say('Мати: Я вже зібрала речі. Тепер розберися з тим, кого бачиш у дзеркалі.');
      return true;
    }
    if(key==='ending') { await this.endingDialogue(); return true; }
    return false;
  }

  async priest() {
    if(this.has('SWITCH_SPICE_CENSER')) { await this.say('Священик: Кадило вже в тебе. За повернення грошей молись комусь іншому.'); return; }
    await this.scene('priest');
    const pick=await this.choose(this.options('priest'));
    if(pick===2) return;
    if(pick===0&&this.state.VAR_SANITY>=50) { await this.say('Ти не наважуєшся. Крадіжка доступна при глузді нижче 50.'); return; }
    if(pick===1&&this.e.party.gold<50) { await this.say('Священик: Спочатку філки. Або пошукай інший шлях: склад і порада За безкоштовні.'); return; }
    if(pick===1) this.e.party.gold-=50; else this.sanity(-10);
    this.flag('SWITCH_SPICE_CENSER'); this.state.quests.censer=true;
    await this.say(pick===0?'Кадило зникло під курткою. Священик продовжує рахувати пожертви.':'Священик: Чек не дам. Бог усе бачить.','Отримано Святе Спайс-Кадило. Заправку шукай у скрині на схід від таверни.'); this.checkpoint();
  }

  async entrance() {
    if(this.state.guardsCleared) { await this.e.loadMap(8,9,11,8); return; }
    if(!this.state.guardsMet) {
      this.state.guardsMet=true;
      await this.say('Стражник: Піздуй звідси, бомжара.');
      this.checkpoint();return;
    }
    await this.say('Охоронець: Без перепустки до дирекції не можна.','Лупа: Перепустка? У мене тільки купа поганих ідей.');
    const pick=await this.choose(['Намастити сходи вазеліном','Використати заправлене кадило','Відійти']);
    if(pick===2) return;
    if(pick===0&&(!this.state.vaselineAdvice||!(this.e.inventory.items[1]>0))) { await this.say('Спочатку поговори із За на північному сході міста.'); return; }
    if(pick===1&&(!this.has('SWITCH_SPICE_CENSER')||!this.state.herbs)) { await this.say('Потрібні кадило священика й заправка зі скрині біля таверни.'); return; }
    if(pick===0) {
      this.flag('SWITCH_VASELINE_TRAP'); this.state.vaseline=false; this.effect('slip'); this.tone('splash');
      this.e.inventory.items[1]--;
      await this.scene('guards');
    } else {
      this.effect('smoke'); this.sanity(-15);
      await this.say('Фіолетовий дим заповнює ґанок. Охоронці віддають честь рожевим поні.');
    }
    this.state.guardsCleared=true; this.state.quests.entry=true;
    await this.e.loadMap(8,9,11,8); this.checkpoint();
  }

  async father() {
    if(this.state.fatherDefeated) { await this.say('Батя хропе під столом. Ключ від погреба вже у тебе.','Велике дзеркало праворуч чомусь не відбиває За.'); return; }
    await this.scene('father');
    const pick=await this.choose(this.options('father'));
    if(pick===0) { this.sanity(-10); this.e.party.hp=Math.max(1,Math.floor(this.e.party.hp/2)); await this.say('Ти вириваєшся з кабінету. Здоров’я впало вдвічі. Потрібен кращий план.'); await this.e.loadMap(7,21,14,2); this.checkpoint(); return; }
    if(pick===1&&!this.has('SWITCH_HAS_CLOTHES')) { await this.say('Спочатку знайди одяг на складі на сході міста.'); return; }
    if(pick===2&&(!this.has('SWITCH_SPICE_CENSER')||!this.state.herbs)) { await this.say('Без кадила й заправки диму не буде. Повернися до священика.'); return; }
    if(pick===1) {
      this.effect('slip'); await this.scene('clothes');
    } else {
      this.effect('smoke'); this.sanity(-20); await this.scene('smoke');
    }
    this.state.fatherDefeated=true; this.state.quests.father=true;
    await this.say('Отримано ключ від винного погреба. Можна повернутися до таверни й знайти матір.');
    this.e.map.events[1].pages[0].graphic.character_name=''; this.checkpoint();
  }

  async mirror() {
    if(!this.state.fatherDefeated) { await this.say('Батя затуляє дзеркало. Спершу розберися з ним.'); return; }
    if(!this.has('SWITCH_SCHIZO_REVEALED')) {
      await this.scene('mirrorBefore');
      this.effect('reveal'); this.state.VAR_SANITY=0; this.flag('SWITCH_SCHIZO_REVEALED');
      await this.scene('mirrorAfter'); this.checkpoint();
    }
    const pick=await this.choose(this.options('ending'));
    this.state.VAR_ENDING_CHOICE=pick+1;
    if(!this.state.unlocked.includes(pick+1)) this.state.unlocked.push(pick+1);
    this.state.endingSeen=false;
    this.visual=null;
    await this.e.loadMap(11+pick,10,10,8); this.checkpoint();
    await this.endingDialogue();
  }

  async endingDialogue() {
    const n=this.state.VAR_ENDING_CHOICE;
    if(!this.state.endingSeen) {
      if(n===1) {
        await this.scene('ending1');
        const savePick=await this.choose(this.options('save'));
        this.state.endingSeen=true;
        if(savePick===0) this.e.saveGame();
      }
      if(n===2) {
        this.tone('fanfare'); await this.scene('ending2');
      }
      if(n===3) {
        this.effect('glitch'); this.tone('error'); await this.scene('ending3');
      }
      this.state.endingSeen=true;
      if(n!==1)this.checkpoint();
    }
    this.e.finishGame({crash:n===3,ending:n});
  }

  effect(kind) { this.visual={kind,start:performance.now(),duration:kind==='reveal'?1800:4200}; }
  tone(kind) {
    if(!this.audioEnabled) return;
    try {
      const files={splash:'126-Water01',error:'003-System03',fanfare:'006-System06'};
      const audio=new Audio(`assets/Audio/SE/${files[kind]||files.error}.ogg`);
      audio.volume=.6;audio.play().catch(()=>{});
    } catch { /* Audio is optional; story progression never depends on it. */ }
  }

  draw(ctx,now) {
    const s=this.state;
    // Static color grading conveys low sanity without mandatory flashes.
    if(s.VAR_SANITY<50&&[6,7,8,9,10,14].includes(this.e.mapId)) {ctx.fillStyle=`rgba(92,35,135,${(50-s.VAR_SANITY)/700})`;ctx.fillRect(0,0,640,480);}
    if(this.e.mapId===10) {
      ctx.fillStyle='#e7c988';ctx.font='12px sans-serif';ctx.fillText('Дзеркало [Enter]',443,126);ctx.fillText('Вихід ↓',275,438);
      // Reflect the existing player sprite inside the original XP mirror.
      const image=this.e.images.get(`assets/Graphics/Characters/${this.e.player.characterName}.png`);
      if(image) {const w=image.width/4,h=image.height/4;ctx.save();ctx.beginPath();ctx.rect(485,139,22,23);ctx.clip();ctx.globalAlpha=.65;ctx.drawImage(image,w,0,w,h,480,131,32,32);ctx.restore();}
    }
    if(this.e.mapId===14) {ctx.fillStyle='#e7c988';ctx.font='12px sans-serif';ctx.fillText('До таверни ↓',272,438);}
    const v=this.visual;
    if(!v||now-v.start>v.duration) return;
    const t=(now-v.start)/v.duration;
    ctx.save();
    if(v.kind==='smoke') {
      const fog=this.e.images.get('assets/Graphics/Fogs/001-Fog01.png');
      if(fog) {ctx.globalAlpha=.5*(1-t);ctx.translate(t*60-60,0);ctx.fillStyle=ctx.createPattern(fog,'repeat');ctx.fillRect(0,0,700,480);ctx.globalAlpha=1;}
      ctx.fillStyle=`rgba(123,58,175,${.24*(1-t)})`;ctx.fillRect(0,0,700,480);
    } else if(v.kind==='reveal') {ctx.fillStyle=`rgba(163,39,66,${.28*(1-t)})`;ctx.fillRect(0,0,640,480);}
    else if(v.kind==='glitch') {ctx.fillStyle='#e34b6260';for(let i=0;i<8;i++)ctx.fillRect((i*79)%640,i*60,150,5);}
    else {ctx.fillStyle='#c2e4f980';ctx.fillRect(0,410,640,12*(1-t));}
    ctx.restore();
  }

  bindJournal() {
    const button=document.querySelector('#journal-toggle'),panel=document.querySelector('#journal');
    button?.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));},{signal:this.listeners.signal});
    this.audioEnabled=Boolean(document.querySelector('#story-audio')?.checked);
    document.querySelector('#story-audio')?.addEventListener('change',e=>{this.audioEnabled=e.target.checked;},{signal:this.listeners.signal});
    this.refresh();
  }
  dispose() {this.listeners.abort();}
  refresh() {
    const s=this.state,panel=document.querySelector('#journal-content'),status=document.querySelector('#story-status');
    if(status) status.textContent=tr('Глузд: {sanity}/100 · Фінали: {endings}/3',{sanity:s.VAR_SANITY,endings:s.unlocked.length});
    if(!panel) return;
    const objective=s.VAR_ENDING_CHOICE? 'Фінал відкрито. Біля дзеркала можна обрати інший.':s.fatherDefeated?'Подивитися в дзеркало праворуч у кабінеті. Ключ також відкриває погріб таверни.':s.guardsCleared?'Пройти до дирекції й поговорити з Батею.':s.guardsMet?'Повернутися до За після зустрічі з охороною. Або підготувати кадило священика біля таверни.':'Поговорити із За на північному сході про пошук матері. Розпитати місцевих або знайти вхід до борделю на півдні міста.';
    const gear=[this.has('SWITCH_HAS_CLOTHES')?'Джинси':null,this.has('SWITCH_SPICE_CENSER')?'Святе Кадило':null,s.herbs?'Заправка':null,this.e.inventory?.items?.[1]>0?'Вазелін':null,s.fatherDefeated?'Ключ від погреба':null].filter(Boolean);
    panel.textContent=`${tr('Мета:')} ${tr(objective)}\n\n${tr('Речі:')} ${gear.map(item=>tr(item)).join(', ')||tr('ще немає')}\n\n${tr('Побічні завдання:')} ${tr('кадило')} ${s.quests.censer?'✓':'—'} · ${tr('обхід охорони')} ${s.quests.entry?'✓':'—'} · ${tr('слід матері')} ${s.quests.mother?'✓':'—'}\n\n${tr('Глузд впливає на репліки За, колір світу й можливість крадіжки (<50). Біля моряка поряд із таверною можна перевести подих або розпитати про За.')}\n${tr('Прогрес автоматично зберігається після ключових сцен.')}`;
  }
}
