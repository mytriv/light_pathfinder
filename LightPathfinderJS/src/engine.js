import { composeXpAutotile } from './autotile.js';
import { loadJson, mapTileId, tableValue } from './data.js';
import { StoryExpansion } from './story-expansion.js';
import { NpcMotion } from './npc-motion.js';
import { dialogueEntries, dialoguePages, originalEventSpeaker } from './dialogue.js';
import {tr,mapLabel,localizeCanvas} from './i18n.js';

const TILE = 32;
const SCREEN_W = 640;
const SCREEN_H = 480;
const DIRS = { 2: [0,1], 4: [-1,0], 6: [1,0], 8: [0,-1] };
const OPPOSITE = { 2:8, 4:6, 6:4, 8:2 };
const DIR_KEYS = new Map([
  ['ArrowDown',2],['KeyS',2],['ArrowLeft',4],['KeyA',4],
  ['ArrowRight',6],['KeyD',6],['ArrowUp',8],['KeyW',8]
]);
const getImage = path => {
  const image = new Image();
  image.src = path;
  return new Promise((resolve,reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Missing game image: ${path}`));
  });
};

export class PathfinderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = localizeCanvas(canvas.getContext('2d'));
    this.ctx.imageSmoothingEnabled = false;
    this.tileCache = new Map();
    this.images = new Map();
    this.switches = [];
    this.variables = [];
    this.selfSwitches = new Map();
    this.player = null;
    this.mapCanvas = document.createElement('canvas');
    this.overlayCanvas = document.createElement('canvas');
    this.dialog = null;
    this.inputDirection = 0;
    this.keys = new Set();
    this.lastTimestamp = 0;
    this.renderedAutotileFrame = -1;
    this.autorunStarted = new Set();
    this.npcMotion=new NpcMotion(this);
    this.inputAbort=new AbortController();
  }

  async start({loadSaved=true}={}) {
    [this.system,this.actors,this.tilesets,this.mapInfos,this.classes,this.items,this.skills,this.weapons,this.armors] = await Promise.all([
      loadJson('System'),loadJson('Actors'),loadJson('Tilesets'),loadJson('MapInfos'),loadJson('Classes'),loadJson('Items'),loadJson('Skills'),loadJson('Weapons'),loadJson('Armors')
    ]);
    const saved=loadSaved?this.readSave():null;
    this.mapId = Number(saved?.mapId||this.system.start_map_id||1);
    this.switches=saved?.switches||[];
    this.variables=saved?.variables||[];
    this.selfSwitches=new Map(saved?.selfSwitches||[]);
    this.story=saved?.story||{bossDefeated:false,orgyVisited:false};
    this.expansion=new StoryExpansion(this);
    this.player = {x:Number(saved?.player?.x??this.system.start_x??0),y:Number(saved?.player?.y??this.system.start_y??0),direction:Number(saved?.player?.direction||2),pattern:1,moving:null};
    const actor = this.actors[(this.system.party_members||[])[0]||1];
    this.actor=actor;
    const hasClothes=this.selfSwitches.get('9:1:A')||this.selfSwitches.get('9:2:A');
    this.player.characterName = saved?.player?.characterName||(this.story.bossDefeated&&!hasClothes?'gallery_10517_34_1007':actor?.character_name);
    this.player.battlerName=saved?.player?.battlerName||actor?.battler_name;
    if(this.player.battlerName)actor.battler_name=this.player.battlerName;
    const baseHp=Number(actor?.parameters?.data?.[6]||500);
    this.party={hp:Number(saved?.party?.hp??baseHp),maxHp:baseHp,sp:Number(saved?.party?.sp??actor?.parameters?.data?.[7]??500),maxSp:Number(actor?.parameters?.data?.[7]||500),name:actor?.name||'Лупа',level:Number(saved?.party?.level||actor?.initial_level||1),gold:Number(saved?.party?.gold||0)};
    this.inventory=saved?.inventory||{items:{},weapons:{},armors:{}};
    this.equipment=saved?.equipment||{weapon:actor?.weapon_id||0,armor0:actor?.armor1_id||0,armor1:actor?.armor2_id||0,armor2:actor?.armor3_id||0,armor3:actor?.armor4_id||0};
    await this.loadMap(this.mapId, this.player.x, this.player.y, this.player.direction);
    this.rebuildMap(0);
    this.bindInput();
    document.querySelector('#map-name').textContent = mapLabel(this.mapId,this.mapName);
    if(!saved) this.refreshAutorun();
    this.frameRequest=requestAnimationFrame(t=>this.frame(t));
    if(this.mapId===2&&this.story.bossDefeated) void this.showStoryGameOver(2);
    if(this.mapId>=11&&this.mapId<=13) {
      const event=this.map.events[1];void this.runEvent(event,this.activePage(event));
    }
  }

  async loadGraphics() {
    const urls = new Set();
    urls.add('assets/Graphics/Fogs/001-Fog01.png');
    urls.add(`assets/Graphics/Tilesets/${this.tileset.tileset_name}.png`);
    for (const name of this.tileset.autotile_names||[]) if(name) urls.add(`assets/Graphics/Autotiles/${name}.png`);
    for (const event of Object.values(this.map.events||{})) {
      for (const page of event.pages||[]) if (page.graphic?.character_name) urls.add(`assets/Graphics/Characters/${page.graphic.character_name}.png`);
    }
    if(this.player.characterName) urls.add(`assets/Graphics/Characters/${this.player.characterName}.png`);
    for (const url of urls) if(!this.images.has(url)) this.images.set(url,await getImage(url));
  }

  async loadMap(mapId, x, y, direction=this.player.direction) {
    this.mapLoading=true;
    try {
    const map=this.expansion?.createMap(Number(mapId))||await loadJson(`Map${String(mapId).padStart(3,'0')}`);
    const tileset=this.tilesets[map.tileset_id];
    if(!tileset) throw new Error(`Map ${mapId} references missing XP tileset ${map.tileset_id}`);
    this.map=map; this.mapId=Number(mapId); this.tileset=tileset;
    this.player.x=Number(x); this.player.y=Number(y); this.player.direction=Number(direction)||this.player.direction||2;
    this.player.moving=null; this.player.pattern=1;
    this.tileCache.clear();
    this.expansion?.prepareMap();
    this.npcMotion.reset();
    await this.loadGraphics();
    this.mapName=map.expansionName||this.mapInfos?.[String(this.mapId)]?.name||`Map ${this.mapId}`;
    document.querySelector('#map-name').textContent=mapLabel(this.mapId,this.mapName);
    this.rebuildMap(Math.floor((performance.now()||0)/450));
    } finally {this.mapLoading=false;}
  }

  async setPlayerGraphic(characterName,battlerName=this.player.battlerName) {
    const path=`assets/Graphics/Characters/${characterName}.png`;
    if(characterName&&!this.images.has(path))this.images.set(path,await getImage(path));
    this.player.characterName=characterName;this.player.battlerName=battlerName;
    this.actor.character_name=characterName;this.actor.battler_name=battlerName;
  }

  bindInput() {
    const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:this.inputAbort.signal});
    listen(this.canvas,'click',event=>{
      if(this.menu) {
        const rect=this.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*this.canvas.width/rect.width,y=(event.clientY-rect.top)*this.canvas.height/rect.height;
        if(this.menu.message) { this.menu.message='';return; }
        if(x<214&&y>=58&&y<58+this.menuEntries().length*36) { this.menu.index=Math.floor((y-58)/36);this.handleMenuInput('Enter'); }
        return;
      }
      if(!this.dialog?.choices) return;
      const rect=this.canvas.getBoundingClientRect();
      const x=(event.clientX-rect.left)*this.canvas.width/rect.width;
      const y=(event.clientY-rect.top)*this.canvas.height/rect.height;
      const index=Math.floor((y-(SCREEN_H-174))/38);
      if(x>=18&&x<=SCREEN_W-18&&index>=0&&index<this.dialog.choices.length) this.selectChoice(index);
    });
    listen(window,'keydown',event=>{
      if(event.target?.closest?.('.language-control'))return;
      if(this.gameOver||this.gameEnded) { event.preventDefault(); return; }
      if(this.menu) { event.preventDefault(); if(!event.repeat)this.handleMenuInput(event.code); return; }
      if(this.dialog?.choices) {
        if(event.code==='ArrowUp'||event.code==='ArrowDown') {
          event.preventDefault();
          const delta=event.code==='ArrowUp'?-1:1;
          this.dialog.choiceIndex=(this.dialog.choiceIndex+delta+this.dialog.choices.length)%this.dialog.choices.length;
          return;
        }
        if(['Enter','Space','KeyZ'].includes(event.code)) { event.preventDefault(); if(!event.repeat)this.selectChoice(this.dialog.choiceIndex); return; }
        return;
      }
      if(!this.dialog&&!this.battle&&!this.runningEvent&&(event.code==='Escape'||event.code==='KeyX')) { event.preventDefault(); this.openMenu(); return; }
      if (DIR_KEYS.has(event.code)) {
        event.preventDefault(); this.inputDirection=DIR_KEYS.get(event.code); this.keys.add(event.code); return;
      }
      if (['Enter','Space','KeyZ'].includes(event.code)) {
        event.preventDefault(); if(event.repeat) return;
        if(this.dialog) this.advanceDialog(); else this.interact();
      }
    });
    listen(window,'keyup',event=>{
      this.keys.delete(event.code);
      if(DIR_KEYS.get(event.code)===this.inputDirection) {
        this.inputDirection=0;
        for(const key of this.keys) if(DIR_KEYS.has(key)) this.inputDirection=DIR_KEYS.get(key);
      }
    });
    listen(window,'blur',()=>{this.keys.clear();this.inputDirection=0;});
  }

  frame(timestamp) {
    if(this.disposed)return;
    const now=timestamp||0;
    this.update(now);
    this.draw(now);
    this.frameRequest=requestAnimationFrame(t=>this.frame(t));
  }

  dispose() {
    this.disposed=true;this.inputAbort.abort();cancelAnimationFrame(this.frameRequest);
    this.keys.clear();this.inputDirection=0;
    this.expansion?.dispose();
  }

  finishGame({crash=false,ending=0,message=''}={}) {
    this.gameEnded=true;this.menu=null;this.inputDirection=0;this.keys?.clear();
    this.terminalState={crash,ending,message};
    this.onFinish?.(this.terminalState);
  }

  update(now) {
    if(this.mapLoading)return;
    this.npcMotion.update(now);
    if(this.player.moving && now-this.player.moving.start>=this.player.moving.duration) {
      const arrived=this.player.moving.to;
      this.player.x=arrived.x; this.player.y=arrived.y; this.player.moving=null; this.player.pattern=1;
      for(const event of Object.values(this.map.events||{})) {
        const page=this.activePage(event);
        if(page&&page.trigger===1&&event.x===this.player.x&&event.y===this.player.y) this.runEvent(event,page);
      }
    }
    if(!this.player.moving&&!this.dialog&&!this.menu&&!this.runningEvent&&!this.gameOver&&!this.gameEnded&&this.inputDirection) this.tryMove(this.inputDirection,now);
    const frame=Math.floor(now/450);
    if(frame!==this.renderedAutotileFrame) this.rebuildMap(frame);
  }

  tryMove(direction, now) {
    this.player.direction=direction;
    const [dx,dy]=DIRS[direction],x=this.player.x,y=this.player.y,nx=x+dx,ny=y+dy;
    // A doorway is an action hotspot even when its wall tile is impassable.
    const doorway=Object.values(this.map.events||{}).find(event=>event.entryTouch&&(
      event.x===nx&&event.y===ny||event.x===x&&event.y===y&&event.touchExitDirection===direction
    ));
    if(doorway&&!this.runningEvent) {this.runEvent(doorway,this.activePage(doorway));return;}
    if(!this.isPassable(x,y,direction)||!this.isPassable(nx,ny,OPPOSITE[direction])) return;
    for(const event of Object.values(this.map.events||{})) {
      const page=this.activePage(event); if(!page) continue;
      if(this.npcMotion.occupies(event,nx,ny)) {
        if(page.trigger===1) { this.runEvent(event,page); return; }
        const graphic=page.graphic||{};
        const hasGraphic=Boolean(graphic.character_name)||Number(graphic.tile_id||0)>0;
        if(!page.through&&hasGraphic) return;
      }
    }
    const speed=4;
    const duration=(Math.pow(2,7-speed)/40)*1000;
    this.player.moving={from:{x,y},to:{x:nx,y:ny},start:now,duration};
    this.player.x=nx; this.player.y=ny;
  }

  isPassable(x,y,direction) {
    if(x<0||y<0||x>=this.map.width||y>=this.map.height) return false;
    if(this.map.expansionName) return x>0&&x<19&&y>2&&y<14&&!this.map.blocked?.some(([bx,by])=>bx===x&&by===y);
    const bit=1<<({2:0,4:1,6:2,8:3}[direction]);
    for(let z=2;z>=0;z--) {
      const id=mapTileId(this.map,x,y,z); if(!id) continue;
      const passage=tableValue(this.tileset.passages,id);
      if((passage&bit)!==0||(passage&15)===15) return false;
      if(tableValue(this.tileset.priorities,id)===0) return true;
    }
    return false;
  }

  activePage(event) {
    let selected=null;
    for(const page of event.pages||[]) {
      const c=page.condition||{};
      if(c.switch1_valid&&!this.switches[c.switch1_id]) continue;
      if(c.switch2_valid&&!this.switches[c.switch2_id]) continue;
      if(c.variable_valid&&(this.variables[c.variable_id]||0)<c.variable_value) continue;
      if(c.self_switch_valid&&!this.selfSwitches.get(`${this.mapId}:${event.id}:${c.self_switch_ch}`)) continue;
      selected=page;
    }
    return selected;
  }

  interact() {
    const [dx,dy]=DIRS[this.player.direction],x=this.player.x+dx,y=this.player.y+dy;
    // Decorative events can share a door tile. They must not swallow its action.
    const events=Object.values(this.map.events||{}).filter(event=>{
      const page=this.activePage(event);
      return page?.trigger===0&&(event.storyKey||(page.list||[]).some(command=>command.code!==0));
    });
    const event=events.find(e=>e.x===x&&e.y===y)||events.find(e=>e.x===this.player.x&&e.y===this.player.y);
    const page=event&&this.activePage(event);
    if(page&&page.trigger===0) this.runEvent(event,page);
  }

  async runEvent(event,page) {
    if(this.runningEvent) return;
    this.runningEvent=true;
    this.currentEvent=event;
    const eventMapId=this.mapId;
    if(eventMapId===4&&event.id===7) this.story.orgyVisited=true;
    try {
      if(await this.expansion.handleEvent(event)) return;
      const list=page.list||[];
      const choiceStack=[];
      let battleResult=null;
      for(let i=0;i<list.length;i++) {
        const command=list[i],p=command.parameters||[];
        if((command.code===402||command.code===403)&&choiceStack.at(-1)?.indent===command.indent) {
          // The selected choice branch has ended; skip the remaining alternatives.
          while(i<list.length&&!(list[i].code===404&&list[i].indent===command.indent)) i++;
          choiceStack.pop();
          continue;
        }
        if(command.code===101) {
          const lines=[];
          while(list[i+1]?.code===401) lines.push(String(list[++i].parameters?.[0]||''));
          await this.showMessage([String(p[0]||''),...lines].filter(Boolean),{speaker:originalEventSpeaker(eventMapId,event,page)});
        } else if(command.code===102) {
          const options=(p[0]||[]).map(String);
          if(!options.length) continue;
          const selected=await this.showChoices(options,Number(p[1]??-1));
          let marker=-1;
          for(let j=i+1;j<list.length;j++) {
            const candidate=list[j];
            if(candidate.indent===command.indent&&(candidate.code===402||candidate.code===403)) {
              const index=candidate.code===403?-1:Number(candidate.parameters?.[0]);
              if(index===selected){marker=j;break;}
            }
            if(candidate.indent===command.indent&&candidate.code===404) break;
          }
          if(marker<0) continue;
          choiceStack.push({indent:command.indent});
          i=marker;
        } else if(command.code===123) {
          const letter=String(p[0]||'A'); this.selfSwitches.set(`${eventMapId}:${event.id}:${letter}`,Number(p[1]||0)===0);
        } else if(command.code===352) {
          const saved=this.saveGame();
          await this.showMessage([saved?'Гру збережено.':'Не вдалося зберегти гру в цьому браузері.']);
        } else if(command.code===311) {
          const amount=Number(p[2]===0?p[3]:this.variables[Number(p[3])]||0);
          const delta=Number(p[1]||0)===0?amount:-amount;
          this.party.hp=Math.max(p[4]?0:1,Math.min(this.party.maxHp,this.party.hp+delta));
        } else if(command.code===125) {
          const amount=Number(p[1]===0?p[2]:this.variables[Number(p[2])]||0);
          this.party.gold=Math.max(0,this.party.gold+(Number(p[0]||0)===0?amount:-amount));
        } else if([126,127,128].includes(command.code)) {
          const amount=Number(p[2]===0?p[3]:this.variables[Number(p[3])]||0);
          const kind={126:'items',127:'weapons',128:'armors'}[command.code],id=Number(p[0]),delta=Number(p[1]||0)===0?amount:-amount;
          this.inventory[kind][id]=Math.max(0,Number(this.inventory[kind][id]||0)+delta);
        } else if(command.code===339) {
          this.forcedAction={subject:Number(p[0]),target:Number(p[1]),action:Number(p[2]),skillId:Number(p[3])};
        } else if(command.code===322) {
          if(Number(p[0])===Number((this.system.party_members||[])[0]||1))await this.setPlayerGraphic(String(p[1]||''),String(p[3]||''));
        } else if(command.code===337) {
          this.forcedAnimationId=Number(p[2]||0);
        } else if(command.code===301) {
          battleResult=await this.playFirstTurnBattle(Number(p[0]));
          if(Number(p[0])===33&&battleResult===2) this.story.bossDefeated=true;
          if(battleResult===2&&p[2]) this.party.hp=1;
        } else if([601,602,603].includes(command.code)) {
          const result={601:0,602:1,603:2}[command.code];
          if(battleResult!==result) {
            while(i+1<list.length&&list[i+1].indent>command.indent) i++;
          }
        } else if(command.code===604) {
          battleResult=null;
        } else if(command.code===201) {
          const destination=p[0]===1
            ? {mapId:this.variables[Number(p[1])]||this.mapId,x:this.variables[Number(p[2])]||0,y:this.variables[Number(p[3])]||0,direction:this.variables[Number(p[4])]||0}
            : {mapId:Number(p[1]),x:Number(p[2]),y:Number(p[3]),direction:Number(p[4])};
          if(destination.mapId===2&&this.story.bossDefeated) {
            await this.loadMap(destination.mapId,destination.x,destination.y,destination.direction||this.player.direction);
            await this.showStoryGameOver(2);
            break;
          }
          if(destination.mapId===4&&this.story.orgyVisited) {
            await this.showMessage(['Лупа: Я вже був там. Більше туди не піду.']);
            break;
          }
          await this.loadMap(destination.mapId,destination.x,destination.y,destination.direction||this.player.direction);
        } else if(command.code===404) {
          if(choiceStack.at(-1)?.indent===command.indent) choiceStack.pop();
        } else if(command.code===113) {
          break;
        } else if(command.code===225) {
          this.startScreenShake(Number(p[0]||0),Number(p[1]||0),Number(p[2]||0));
        } else if(command.code===353) {
          const bossChoiceGameOver=eventMapId===2&&event.id===3;
          this.finishGameOver(bossChoiceGameOver?'Помер від розриву ануса':'',bossChoiceGameOver);
          break;
        } else if(command.code===0&&command.indent===0) break;
      }
    } finally {
      if((eventMapId===2&&event.id===3&&this.story.bossDefeated)||(eventMapId===4&&event.id===7&&this.story.orgyVisited))this.saveGame();
      this.expansion.refresh();
      this.runningEvent=false;
      this.currentEvent=null;
      this.refreshAutorun();
    }
  }

  refreshAutorun() {
    if(this.runningEvent) return;
    const active=new Set();
    for(const event of Object.values(this.map.events||{})) {
      const page=this.activePage(event);
      if(page?.trigger!==3) continue;
      const key=`${this.mapId}:${event.id}:${(event.pages||[]).indexOf(page)}`;
      active.add(key);
      if(!this.autorunStarted.has(key)) {
        this.autorunStarted.add(key);
        void this.runEvent(event,page);
        break;
      }
    }
    for(const key of this.autorunStarted) if(key.startsWith(`${this.mapId}:`)&&!active.has(key)) this.autorunStarted.delete(key);
  }

  showMessage(lines,{speaker='Система'}={}) {
    // Keep every word of long source dialogue; display at most three rows per page.
    this.ctx.save();this.ctx.font='18px sans-serif';
    const sourceEntries=dialogueEntries(lines,speaker);
    const pages=this.localizedDialoguePages(sourceEntries);
    this.ctx.restore();
    return new Promise(resolve=>{this.dialog={sourceEntries,pages,lines:pages.map(page=>page.text),speaker:pages[0].speaker,index:0,resolve};});
  }

  localizedDialoguePages(entries) {
    this.ctx.save();this.ctx.font='18px sans-serif';
    const pages=entries.flatMap((entry,entryIndex)=>dialoguePages([{speaker:tr(entry.speaker),text:tr(entry.text)}],text=>this.wrapText(this.ctx,text,SCREEN_W-76)).map((page,part)=>({...page,entryIndex,part})));
    this.ctx.restore();return pages;
  }
  refreshLanguage() {
    const d=this.dialog;
    if(d?.choices) {d.choices=d.sourceChoices.map(choice=>tr(choice));d.speaker=tr(this.party?.name||'Лупа');}
    else if(d?.sourceEntries) {
      const old=d.pages[d.index],pages=this.localizedDialoguePages(d.sourceEntries),matching=pages.map((page,index)=>({...page,index})).filter(page=>page.entryIndex===old.entryIndex);
      d.pages=pages;d.lines=pages.map(page=>page.text);d.index=matching[Math.min(old.part,matching.length-1)]?.index||0;d.speaker=pages[d.index].speaker;
    }
    document.querySelector('#map-name').textContent=mapLabel(this.mapId,this.mapName);
    this.expansion.refresh();
  }

  readSave() {
    try { return JSON.parse(localStorage.getItem('light-pathfinder-save-v1')||'null'); }
    catch { return null; }
  }

  clearSave() {
    try { localStorage.removeItem('light-pathfinder-save-v1'); return true; }
    catch { return false; }
  }

  saveGame() {
    const state={mapId:this.mapId,player:{x:this.player.x,y:this.player.y,direction:this.player.direction,characterName:this.player.characterName,battlerName:this.player.battlerName},party:{hp:this.party.hp,sp:this.party.sp,level:this.party.level,gold:this.party.gold},inventory:this.inventory,equipment:this.equipment,switches:this.switches,variables:this.variables,selfSwitches:[...this.selfSwitches],story:this.story};
    try { localStorage.setItem('light-pathfinder-save-v1',JSON.stringify(state)); return true; }
    catch { return false; }
  }

  openMenu() { if(this.player.moving)return;this.inputDirection=0;this.menu={scene:'main',index:0}; }

  async showStoryGameOver(mapId) {
    const lines=mapId===2
      ? ['Батя: Я ж сказав не повертатися, хуєсосина.','Тепер ти звідси вже не вийдеш.']
      : ['Лу́па: Ні, тільки не знову...','Треба було тікати минулого разу.'];
    for(const line of lines) await this.showMessage([line]);
    this.finishGameOver(mapId===2?'Помер від розриву ануса':'',mapId===2);
  }

  finishGameOver(message='',shake=false) {
    this.gameOver=true;
    this.gameOverMessage=message;
    if(shake) this.startScreenShake(8,3,40);
    this.finishGame({message});
  }

  startScreenShake(power,speed,durationFrames) {
    this.screenShake={power:Math.max(0,power),speed:Math.max(1,speed),startedAt:performance.now(),duration:Math.max(0,durationFrames)*1000/60};
  }

  screenShakeOffset(timestamp) {
    const shake=this.screenShake;
    if(!shake||shake.duration<=0) return {x:0,y:0};
    const elapsed=timestamp-shake.startedAt;
    if(elapsed>=shake.duration) { this.screenShake=null; return {x:0,y:0}; }
    const strength=shake.power*(1-elapsed/shake.duration);
    const phase=elapsed*shake.speed*0.045;
    return {x:Math.sin(phase)*strength,y:Math.cos(phase*1.17)*strength*0.35};
  }

  handleMenuInput(code) {
    const m=this.menu;
    if(m.message) { if(['Enter','Space','KeyZ','Escape','KeyX'].includes(code)) m.message=''; return; }
    if(code==='Escape'||code==='KeyX') {
      if(m.scene==='main') this.menu=null;
      else if(m.scene==='equipment-list') { m.scene='equip';m.index=m.returnIndex||0; }
      else { m.scene='main';m.index=0; }
      return;
    }
    if(code==='ArrowUp'||code==='ArrowDown') {
      const len=this.menuEntries().length;
      if(len) m.index=(m.index+(code==='ArrowDown'?1:-1)+len)%len;
      return;
    }
    if(!['Enter','Space','KeyZ'].includes(code)) return;
    if(m.scene==='main') {
      const selected=['items','skills','equip','status','save','end-confirm','clear-save-confirm'][m.index];
      if(selected==='save') m.message=this.saveGame()?'Game saved.':'Could not save in this browser.';
      else { m.scene=selected;m.index=0; }
    } else if(m.scene==='clear-save-confirm') {
      if(m.index===0) {
        m.scene='main';m.index=6;
        m.message=this.clearSave()?'Збереження видалено. Поточна гра триватиме до перезавантаження.':'Не вдалося видалити збереження.';
      } else { m.scene='main';m.index=6; }
    } else if(m.scene==='items') this.useMenuItem(this.menuEntries()[m.index]);
    else if(m.scene==='skills') this.useMenuSkill(this.menuEntries()[m.index]);
    else if(m.scene==='equip') {
      m.returnIndex=m.index;m.slot=m.index===0?'weapon':`armor${m.index-1}`;m.scene='equipment-list';m.index=0;
    } else if(m.scene==='equipment-list') this.equipMenuItem(this.menuEntries()[m.index]);
    else if(m.scene==='end-confirm') {
      if(m.index===0) { this.menu=null;this.onTitle?this.onTitle():this.finishGame(); }
      else { m.scene='main';m.index=0; }
    }
  }

  menuEntries() {
    const m=this.menu;
    if(!m) return [];
    if(m.scene==='main') return [this.system.words?.item||'Item',this.system.words?.skill||'Skill',this.system.words?.equip||'Equip','Статус','Зберегти','Вихід','Очистити сейв'];
    if(m.scene==='items') return Object.entries(this.inventory.items).filter(([,n])=>n>0).map(([id,n])=>this.items[id]?{id:Number(id),count:n,data:this.items[id]}:null).filter(Boolean);
    if(m.scene==='skills') {
      const cls=this.classes[this.actors[(this.system.party_members||[])[0]||1]?.class_id||1];
      return (cls?.learnings||[]).filter(l=>l.level<=this.party.level).map(l=>this.skills[l.skill_id]).filter(Boolean);
    }
    if(m.scene==='equip') return [this.system.words?.weapon||'Weapon',this.system.words?.armor1||'Shield',this.system.words?.armor2||'Head',this.system.words?.armor3||'Body',this.system.words?.armor4||'Accessory'];
    if(m.scene==='equipment-list') {
      const weapon=m.slot==='weapon',source=weapon?this.weapons:this.armors;
      const kind=weapon?null:Number(m.slot.slice(-1));
      const current=Number(this.equipment[m.slot]||0);
      const owned=Object.entries(weapon?this.inventory.weapons:this.inventory.armors).filter(([,n])=>n>0).map(([id])=>Number(id));
      const ids=[...new Set([0,current,...owned])].filter(id=>id===0||source[id]&&(weapon||Number(source[id].kind)===kind));
      return ids.map(id=>({id,data:source[id],label:id===0?'(Unequip)':source[id]?.name||'Unknown'}));
    }
    if(m.scene==='end-confirm') return ['До титулу','Скасувати'];
    if(m.scene==='clear-save-confirm') return ['Так, видалити','Ні, скасувати'];
    return [];
  }

  useMenuItem(entry) {
    if(!entry) { this.menu.message='No items.';return; }
    const item=entry.data;
    if(!item||![0,2].includes(Number(item.occasion))) { this.menu.message='This item cannot be used here.';return; }
    const hp=Math.max(0,Number(item.recover_hp||0)+Math.floor(this.party.maxHp*Number(item.recover_hp_rate||0)/100));
    const sp=Math.max(0,Number(item.recover_sp||0)+Math.floor(this.party.maxSp*Number(item.recover_sp_rate||0)/100));
    if(!hp&&!sp) { this.menu.message=`${item.name}: ${item.description||'No menu effect.'}`;return; }
    this.party.hp=Math.min(this.party.maxHp,this.party.hp+hp);
    this.party.sp=Math.min(this.party.maxSp,this.party.sp+sp);
    if(item.consumable) this.inventory.items[entry.id]=Math.max(0,entry.count-1);
    this.menu.message=`Used ${item.name}.`;
  }

  useMenuSkill(skill) {
    if(!skill) { this.menu.message='No skills learned.';return; }
    if(Number(skill.occasion)===1||Number(skill.occasion)===3) { this.menu.message='This skill cannot be used here.';return; }
    if(this.party.sp<Number(skill.sp_cost||0)) { this.menu.message='Not enough SP.';return; }
    this.party.sp-=Number(skill.sp_cost||0);
    if(Number(skill.power)<0) this.party.hp=Math.min(this.party.maxHp,this.party.hp-Math.trunc(Number(skill.power)));
    this.menu.message=`Used ${skill.name}.`;
  }

  equipMenuItem(entry) {
    if(!entry) return;
    const m=this.menu,key=m.slot,weapon=key==='weapon',bucket=weapon?'weapons':'armors',current=Number(this.equipment[key]||0);
    if(entry.id===current) { m.scene='equip';m.index=m.returnIndex;return; }
    if(entry.id>0) this.inventory[bucket][entry.id]=Math.max(0,Number(this.inventory[bucket][entry.id]||0)-1);
    if(current>0) this.inventory[bucket][current]=Number(this.inventory[bucket][current]||0)+1;
    this.equipment[key]=entry.id;
    m.scene='equip';m.index=m.returnIndex;
    m.message=`Equipped ${entry.label}.`;
  }

  async playFirstTurnBattle(troopId) {
    const [troops,enemies]=await Promise.all([loadJson('Troops'),loadJson('Enemies')]);
    const troop=troops[troopId],member=troop?.members?.find(m=>!m.hidden);
    const enemy=enemies[member?.enemy_id];
    if(!troop||!enemy) { await this.showMessage(['Бій не може початися: у даних немає цього ворога.']); return 2; }
    const enemyPath=`assets/Graphics/Battlers/${enemy.battler_name}.png`;
    const actorPath=`assets/Graphics/Battlers/${this.actors[(this.system.party_members||[])[0]||1]?.battler_name}.png`;
    for(const path of [enemyPath,actorPath]) if(!this.images.has(path)) this.images.set(path,await getImage(path));
    this.battle={troop,enemy,enemyHp:Number(enemy.maxhp||1),enemyMaxHp:Number(enemy.maxhp||1),enemyPath,actorPath,phase:'player'};
    await this.showMessage([`${this.party.name} атакує!`]);
    this.battle.phase='enemy';
    await this.showMessage([`${enemy.name} атакує у відповідь!`]);
    this.party.hp=0;
    this.battle.phase='defeat';
    await this.showMessage([`${this.party.name} не може продовжити бій.`]);
    this.battle=null;
    this.forcedAction=null;
    return 2;
  }

  advanceDialog() {
    if(!this.dialog) return;
    if(this.dialog.choices) { this.selectChoice(this.dialog.choiceIndex); return; }
    if(this.dialog.index<this.dialog.lines.length-1) {this.dialog.index++;this.dialog.speaker=this.dialog.pages[this.dialog.index].speaker;}
    else { const done=this.dialog.resolve; this.dialog=null; done(); }
  }

  showChoices(choices,cancelType) {
    return new Promise(resolve=>{this.dialog={choices:choices.map(choice=>tr(choice)),sourceChoices:choices,speaker:tr(this.party?.name||'Лупа'),choiceIndex:0,cancelType,resolve};});
  }

  selectChoice(index) {
    if(!this.dialog?.choices) return;
    const done=this.dialog.resolve;
    this.dialog=null;
    done(index);
  }

  rebuildMap(frame) {
    if(!this.map||!this.tileset) return;
    this.renderedAutotileFrame=frame;
    const pixelW=this.map.width*TILE,pixelH=this.map.height*TILE;
    this.mapCanvas.width=this.overlayCanvas.width=pixelW;
    this.mapCanvas.height=this.overlayCanvas.height=pixelH;
    const base=this.mapCanvas.getContext('2d'),over=this.overlayCanvas.getContext('2d');
    base.imageSmoothingEnabled=over.imageSmoothingEnabled=false;
    for(let z=0;z<3;z++) for(let y=0;y<this.map.height;y++) for(let x=0;x<this.map.width;x++) {
      const id=mapTileId(this.map,x,y,z); if(!id) continue;
      const priority=tableValue(this.tileset.priorities,id);
      this.drawTile(priority>0?over:base,id,x*TILE,y*TILE,frame);
    }
  }

  drawTile(target,id,x,y,animationFrame) {
    const cacheFrame=id>=48&&id<384?animationFrame:0;
    const cacheKey=`${id}:${cacheFrame}`;
    let tile=this.tileCache.get(cacheKey);
    if(!tile) {
      tile=document.createElement('canvas'); tile.width=tile.height=TILE;
      const t=tile.getContext('2d'); t.imageSmoothingEnabled=false;
      if(id>=384) {
        const image=this.images.get(`assets/Graphics/Tilesets/${this.tileset.tileset_name}.png`);
        const n=id-384,sx=(n%8)*TILE,sy=Math.floor(n/8)*TILE;
        if(image&&sx+TILE<=image.width&&sy+TILE<=image.height) t.drawImage(image,sx,sy,TILE,TILE,0,0,TILE,TILE);
      } else if(id>=48) {
        const slot=Math.floor(id/48)-1,shape=id%48,name=this.tileset.autotile_names?.[slot];
        const image=name&&this.images.get(`assets/Graphics/Autotiles/${name}.png`);
        if(image) {
          const count=Math.max(1,Math.floor(image.width/96));
          const frame=animationFrame%count;
          tile=composeXpAutotile(image,shape,frame,TILE);
        }
      }
      this.tileCache.set(cacheKey,tile);
    }
    target.drawImage(tile,x,y);
  }

  draw(timestamp) {
    const ctx=this.ctx; ctx.clearRect(0,0,SCREEN_W,SCREEN_H); ctx.fillStyle='#10141a';ctx.fillRect(0,0,SCREEN_W,SCREEN_H);
    const shake=this.screenShakeOffset(timestamp);
    const isShaking=Boolean(shake.x||shake.y);
    if(isShaking) { ctx.save();ctx.translate(shake.x,shake.y); }
    if(this.gameOver) { this.drawGameOver(ctx); if(isShaking) ctx.restore(); return; }
    if(this.gameEnded) { this.drawGameEnded(ctx); if(isShaking) ctx.restore(); return; }
    if(this.battle) { this.drawBattle(ctx); this.drawHud(ctx); return; }
    const position=this.player.moving?this.movementPosition(timestamp):{x:this.player.x,y:this.player.y};
    const camera={x:Math.max(0,Math.min(this.map.width*TILE-SCREEN_W,position.x*TILE-SCREEN_W/2+TILE/2)),y:Math.max(0,Math.min(this.map.height*TILE-SCREEN_H,position.y*TILE-SCREEN_H/2+TILE/2))};
    ctx.drawImage(this.mapCanvas,-camera.x,-camera.y);
    const sprites=[];
    for(const event of Object.values(this.map.events||{})) {
      const page=this.activePage(event),g=page?.graphic;
      if(g?.character_name||Number(g?.tile_id||0)>0) sprites.push({...this.npcMotion.sprite(event,page,timestamp),name:g.character_name,above:Boolean(page.always_on_top)});
    }
    sprites.push({x:position.x,y:position.y,name:this.player.characterName,pattern:this.player.pattern,direction:this.player.direction,above:false,isPlayer:true});
    sprites.sort((a,b)=>Number(a.above)-Number(b.above)||a.y-b.y);
    for(const sprite of sprites) this.drawCharacter(ctx,sprite,camera,timestamp);
    ctx.drawImage(this.overlayCanvas,-camera.x,-camera.y);
    this.expansion.draw(ctx,timestamp);
    this.drawHud(ctx);
    if(this.menu) this.drawMenu(ctx);
    if(isShaking) ctx.restore();
  }

  movementPosition(timestamp) {
    const m=this.player.moving,t=Math.min(1,Math.max(0,(timestamp-m.start)/m.duration));
    this.player.pattern=Math.floor(t*4)%4;
    return {x:m.from.x+(m.to.x-m.from.x)*t,y:m.from.y+(m.to.y-m.from.y)*t};
  }

  drawCharacter(ctx,sprite,camera,timestamp) {
    if(!sprite.name) return;
    const image=this.images.get(`assets/Graphics/Characters/${sprite.name}`)||this.images.get(`assets/Graphics/Characters/${sprite.name}.png`);
    if(!image) return;
    const cellW=image.width/4,cellH=image.height/4;
    const moving=sprite.isPlayer&&this.player.moving;
    const pattern=moving?this.player.pattern:Math.min(3,sprite.pattern??1);
    const row=({2:0,4:1,6:2,8:3})[sprite.direction]||0;
    const x=sprite.x*TILE-camera.x+(TILE-cellW)/2,y=sprite.y*TILE-camera.y+TILE-cellH;
    ctx.drawImage(image,pattern*cellW,row*cellH,cellW,cellH,x,y,cellW,cellH);
  }

  drawHud(ctx) {
    ctx.fillStyle='#0b1016d9';ctx.fillRect(8,8,220,26);ctx.fillStyle='#e7d3a7';ctx.font='13px monospace';ctx.fillText(`Map ${this.mapId}: ${mapLabel(this.mapId,this.mapName)}`,16,26);
    if(!this.dialog) return;
    this.drawDialogueSpeaker(ctx,this.dialog.speaker||'Система',this.dialog.choices?SCREEN_H-190:SCREEN_H-150);
    if(this.dialog.choices) {
      ctx.fillStyle='#080b10ed';ctx.fillRect(18,SCREEN_H-190,SCREEN_W-36,172);ctx.strokeStyle='#c7a96b';ctx.lineWidth=2;ctx.strokeRect(18,SCREEN_H-190,SCREEN_W-36,172);
      ctx.font='18px sans-serif';
      this.dialog.choices.forEach((choice,i)=>{const y=SCREEN_H-156+i*38;ctx.fillStyle=i===this.dialog.choiceIndex?'#f3d27a':'#f3eee2';ctx.fillText(`${i===this.dialog.choiceIndex?'▶':' '} ${choice}`,38,y);});
      ctx.fillStyle='#c5cbd4';ctx.font='12px monospace';ctx.fillText(document.documentElement.classList.contains('touch-game')?'Торкнись відповіді':'Click or use ↑ / ↓ + Enter',SCREEN_W-235,SCREEN_H-36);
      return;
    }
    const lines=this.dialog.lines[this.dialog.index]||'';
    ctx.fillStyle='#080b10ed';ctx.fillRect(18,SCREEN_H-150,SCREEN_W-36,132);ctx.strokeStyle='#c7a96b';ctx.lineWidth=2;ctx.strokeRect(18,SCREEN_H-150,SCREEN_W-36,132);
    ctx.fillStyle='#f3eee2';ctx.font='18px sans-serif';
    const wrapped=this.wrapText(ctx,lines,SCREEN_W-76);
    wrapped.slice(0,3).forEach((line,i)=>ctx.fillText(line,38,SCREEN_H-112+i*24));
    ctx.fillStyle='#c5cbd4';ctx.font='12px monospace';ctx.fillText(document.documentElement.classList.contains('touch-game')?'Дія — далі':'Enter / Z  ·  continue',SCREEN_W-190,SCREEN_H-36);
  }

  drawDialogueSpeaker(ctx,speaker,boxTop) {
    speaker=tr(speaker);
    ctx.save();ctx.font='bold 17px sans-serif';
    const width=Math.min(SCREEN_W-60,Math.max(90,ctx.measureText(speaker).width+32));
    ctx.fillStyle='#101722';ctx.fillRect(30,boxTop-28,width,28);
    ctx.strokeStyle='#c7a96b';ctx.lineWidth=2;ctx.strokeRect(30,boxTop-28,width,28);
    ctx.fillStyle='#f3d27a';ctx.fillText(speaker,46,boxTop-8);ctx.restore();
  }

  drawBattle(ctx) {
    const b=this.battle;
    const bg=ctx.createLinearGradient(0,0,0,SCREEN_H);bg.addColorStop(0,'#24384a');bg.addColorStop(1,'#111821');ctx.fillStyle=bg;ctx.fillRect(0,0,SCREEN_W,SCREEN_H);
    ctx.fillStyle='#b8a878';ctx.font='20px monospace';ctx.fillText(b.troop.name,24,34);
    const enemy=this.images.get(b.enemyPath),actor=this.images.get(b.actorPath);
    if(enemy) ctx.drawImage(enemy,386,88,190,190);
    if(actor) ctx.drawImage(actor,60,210,136,136);
    ctx.save();ctx.lineWidth=5;ctx.strokeStyle=b.phase==='player'?'rgba(255,245,190,.9)':'rgba(255,100,100,.9)';
    if(b.phase==='player'){ctx.beginPath();ctx.moveTo(400,104);ctx.lineTo(560,252);ctx.stroke();}
    else if(b.phase==='enemy'){ctx.beginPath();ctx.moveTo(74,218);ctx.lineTo(176,330);ctx.stroke();}
    ctx.restore();
    ctx.fillStyle='#f3eee2';ctx.font='17px sans-serif';ctx.fillText(b.enemy.name,395,68);
    ctx.fillStyle='#131820';ctx.fillRect(372,286,220,14);ctx.fillStyle='#c74b4b';ctx.fillRect(372,286,220*(b.enemyHp/b.enemyMaxHp),14);
    ctx.fillStyle='#f3eee2';ctx.font='15px sans-serif';ctx.fillText(`${this.party.name}  HP ${this.party.hp}/${this.party.maxHp}`,24,386);
    ctx.fillStyle='#131820';ctx.fillRect(24,396,230,14);ctx.fillStyle='#63b96a';ctx.fillRect(24,396,230*Math.max(0,this.party.hp/this.party.maxHp),14);
  }

  drawGameOver(ctx) {
    ctx.fillStyle='#050609';ctx.fillRect(0,0,SCREEN_W,SCREEN_H);ctx.textAlign='center';ctx.fillStyle='#c9b77d';ctx.font='bold 38px serif';ctx.fillText('GAME OVER',SCREEN_W/2,SCREEN_H/2-18);
    if(this.gameOverMessage) {ctx.fillStyle='#f3eee2';ctx.font='bold 18px sans-serif';ctx.fillText(this.gameOverMessage,SCREEN_W/2,SCREEN_H/2+20);}
    ctx.fillStyle='#aeb4bd';ctx.font='14px monospace';ctx.fillText('Refresh the page to start again',SCREEN_W/2,SCREEN_H/2+58);ctx.textAlign='left';
  }

  drawGameEnded(ctx) {
    ctx.fillStyle='#070a0f';ctx.fillRect(0,0,SCREEN_W,SCREEN_H);ctx.textAlign='center';ctx.fillStyle='#e7d3a7';ctx.font='bold 30px serif';ctx.fillText(this.terminalState?.crash?'500 · Internal Server Error':'Гра завершена',SCREEN_W/2,SCREEN_H/2);ctx.textAlign='left';
  }

  drawMenu(ctx) {
    const m=this.menu;ctx.fillStyle='rgba(0,0,0,.68)';ctx.fillRect(0,0,SCREEN_W,SCREEN_H);
    const box=(x,y,w,h)=>{ctx.fillStyle='#101820f2';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#c7a96b';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);};
    box(18,20,196,440);box(226,20,396,440);
    ctx.fillStyle='#e7d3a7';ctx.font='bold 17px sans-serif';ctx.fillText('Menu',34,48);
    const entries=this.menuEntries(),baseY=78;
    ctx.font='16px sans-serif';
    entries.forEach((entry,i)=>{const label=tr(typeof entry==='string'?entry:entry.label||entry.data?.name||'');const y=baseY+i*36;if(i===m.index){ctx.fillStyle='#c7a96b55';ctx.fillRect(28,y-20,176,30);}ctx.fillStyle=i===m.index?'#f3d27a':'#f3eee2';ctx.fillText(`${i===m.index?'▶':' '} ${label}`,38,y);});
    ctx.fillStyle='#d9dce1';ctx.font='14px sans-serif';
    if(m.scene==='main') {
      ctx.font='bold 18px sans-serif';ctx.fillText(this.party.name,250,55);ctx.font='15px sans-serif';
      ctx.fillText(`Рівень ${this.party.level}`,250,90);ctx.fillText(`${this.system.words?.hp||'HP'}  ${this.party.hp} / ${this.party.maxHp}`,250,122);ctx.fillText(`${this.system.words?.sp||'SP'}  ${this.party.sp} / ${this.party.maxSp}`,250,152);ctx.fillText(`${this.system.words?.gold||'Gold'}  ${this.party.gold}`,250,182);
      ctx.fillStyle='#c5cbd4';ctx.font='13px monospace';ctx.fillText(document.documentElement.classList.contains('touch-game')?'Дія — обрати · Назад':'↑ / ↓ Select   Enter Confirm   Esc Cancel',250,426);
    } else if(m.scene==='status') {
      const row=this.party.level*6,params=this.actor.parameters?.data||[];
      ctx.font='bold 18px sans-serif';ctx.fillText(`${this.party.name}  ·  Рівень ${this.party.level}`,250,55);ctx.font='15px sans-serif';
      [['HP',this.party.hp,this.party.maxHp],['SP',this.party.sp,this.party.maxSp]].forEach(([name,value,max],i)=>{const y=98+i*50;ctx.fillText(`${name}: ${value} / ${max}`,250,y);ctx.fillStyle='#202832';ctx.fillRect(250,y+8,330,12);ctx.fillStyle=i?'#5488c7':'#62b96a';ctx.fillRect(250,y+8,330*Math.max(0,value/max),12);});
      const weapon=this.weapons[this.equipment.weapon],armorIds=[0,1,2,3].map(i=>this.equipment[`armor${i}`]),armor=armorIds.map(id=>this.armors[id]);
      const attack=Number(params[row+2]||0)+Number(weapon?.atk||0)+Number(weapon?.str_plus||0),defense=armor.reduce((n,a)=>n+Number(a?.pdef||0),0),magicDefense=armor.reduce((n,a)=>n+Number(a?.mdef||0),0);
      ctx.fillStyle='#d9dce1';ctx.fillText(`${this.system.words?.str||'STR'}: ${params[row+2]||0}`,250,204);ctx.fillText(`${this.system.words?.dex||'DEX'}: ${params[row+3]||0}`,412,204);ctx.fillText(`${this.system.words?.agi||'AGI'}: ${params[row+4]||0}`,250,230);ctx.fillText(`${this.system.words?.int||'INT'}: ${params[row+5]||0}`,412,230);ctx.fillText(`${this.system.words?.atk||'ATK'}: ${attack}`,250,256);ctx.fillText(`${this.system.words?.pdef||'DEF'}: ${defense}`,412,256);ctx.fillText(`${this.system.words?.mdef||'MDEF'}: ${magicDefense}`,250,282);
      ctx.fillText(`${this.system.words?.weapon||'Weapon'}: ${weapon?.name||'—'}`,250,320);ctx.fillText(`${this.system.words?.armor1||'Armor'}: ${armor[0]?.name||'—'}`,250,344);ctx.fillText(`${this.system.words?.armor2||'Armor'}: ${armor[1]?.name||'—'}`,250,368);ctx.fillText(`${this.system.words?.armor3||'Armor'}: ${armor[2]?.name||'—'}`,250,392);ctx.fillText(`${this.system.words?.armor4||'Armor'}: ${armor[3]?.name||'—'}`,250,416);
    } else if(m.scene==='equip') {
      const slot=['Weapon','Shield','Head','Body','Accessory'][m.index],key=m.index===0?'weapon':`armor${m.index-1}`;
      ctx.font='bold 18px sans-serif';ctx.fillText(`${this.system.words?.equip||'Equip'}: ${slot}`,250,55);ctx.font='15px sans-serif';ctx.fillText(`Currently: ${this.weapons[this.equipment[key]]?.name||this.armors[this.equipment[key]]?.name||'—'}`,250,92);ctx.fillStyle='#c5cbd4';ctx.fillText('Choose a slot, then select owned equipment.',250,128);
    } else if(m.scene==='items'||m.scene==='skills'||m.scene==='equipment-list') {
      const entry=entries[m.index],obj=entry?.data||entry;ctx.font='bold 18px sans-serif';ctx.fillText(m.scene==='items'?'Items':m.scene==='skills'?'Skills':'Choose Equipment',250,55);ctx.font='15px sans-serif';
      if(entry) {ctx.fillStyle='#f3eee2';ctx.fillText(obj.name||entry.label||'',250,98);if(entry.count!==undefined)ctx.fillText(`Quantity: ${entry.count}`,250,126);ctx.fillStyle='#c5cbd4';this.wrapText(ctx,obj.description||'',350).slice(0,5).forEach((line,i)=>ctx.fillText(line,250,164+i*22));if(obj.sp_cost)ctx.fillText(`SP cost: ${obj.sp_cost}`,250,294);}
      else {ctx.fillStyle='#c5cbd4';ctx.fillText(m.scene==='items'?'No items.':m.scene==='skills'?'No skills learned.':'No equipment available.',250,98);}
    } else if(m.scene==='end-confirm') {
      ctx.font='bold 18px sans-serif';ctx.fillText('End the game?',250,58);ctx.font='15px sans-serif';ctx.fillStyle='#c5cbd4';ctx.fillText('Return to the title screen or cancel.',250,94);
    } else if(m.scene==='clear-save-confirm') {
      ctx.font='bold 18px sans-serif';ctx.fillText('Видалити збереження?',250,58);ctx.font='15px sans-serif';ctx.fillStyle='#c5cbd4';ctx.fillText('Поточна гра не завершиться.',250,94);
      ctx.fillText('Після перезавантаження почнеться нова гра.',250,120);
    }
    if(m.message) {box(94,190,452,88);ctx.fillStyle='#f3eee2';ctx.font='17px sans-serif';ctx.fillText(m.message,116,232);ctx.fillStyle='#c5cbd4';ctx.font='12px monospace';ctx.fillText(document.documentElement.classList.contains('touch-game')?'Дія — далі':'Enter to continue',116,258);}
    ctx.fillStyle='#c5cbd4';ctx.font='12px monospace';ctx.fillText(document.documentElement.classList.contains('touch-game')?'Дія — обрати · Назад':'Enter: confirm   Esc / X: back',34,444);
  }

  wrapText(ctx,text,maxWidth) {
    text=tr(text);
    if(String(text).includes('\n')) return String(text).split('\n').flatMap(line=>this.wrapText(ctx,line,maxWidth));
    const words=String(text).split(/\s+/),lines=[];let line='';
    for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines;
  }
}



