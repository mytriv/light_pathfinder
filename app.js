/* Light Pathfinder: an editable, dependency-free JavaScript port.
 * Tile/event data comes from the Ruby Marshal -> JSON conversion in /data.
 */
(() => {
  'use strict';
  const W = 640, H = 480, TILE = 32, SAVE_KEY = 'light-pathfinder-html5-save-v1';
  const canvas = document.getElementById('screen'), ctx = canvas.getContext('2d', { alpha:false });
  ctx.imageSmoothingEnabled = false;
  const overlay = document.getElementById('overlay'), notice = document.getElementById('notice');
  const dialogEl = document.getElementById('dialog'), speakerEl = document.getElementById('dialog-speaker'), textEl = document.getElementById('dialog-text');
  const dialogOptionsEl = document.getElementById('dialog-options'), dialogNextEl = document.getElementById('dialog-next');
  const choiceEl = document.getElementById('choice'), menuEl = document.getElementById('menu'), battleEl = document.getElementById('battle');
  const keys = new Set();
  const passability = window.RPGXPPassability;
  const db = {};
  let assetIndex = {};
  const imageCache = new Map(), audioCache = new Map(), autoTileCache = new Map(), eventMotion = new Map();
  let scene = 'title', map = null, tileset = null, mapId = 1, mapInfo = {}, player = null;
  let mapBase = null, mapOverlay = [], renderedSignature = '', lastMoveAt = 0, lastFrame = 0, walkFrame = 0, autoFrameIndex = 0;
  let queuedDirection = 0;
  let modal = false, currentEvent = null, runningEvents = new Set(), pageRunKey = '', saveAllowed = true, music = null, battleReturn = 'event', gameStarting = false;
  let state = freshState();
  const unsupportedCommands = new Set();

  function freshState() {
    const s = db.System || {};
    const actor = db.Actors?.[1];
    const param = (idx) => actor?.parameters?.data?.[idx + (actor.parameters.xsize || 6)] ?? 0;
    return { mapId: s.start_map_id || 1, x: s.start_x ?? 15, y: s.start_y ?? 10, direction: 2, switches: {}, variables: {}, selfSwitches: {}, eventPositions: {}, gold: 0, items: {}, weapons: {}, armors: {}, hp: param(0) || 500, sp: param(1) || 500, level: actor?.initial_level || 1, exp: 0, skills: [], playFrames: 0, saveAllowed: true };
  }
  function sayNotice(s) { notice.textContent = s || ''; }
  async function fetchJson(name) {
    const r = await fetch(`data/${name}.json`);
    if (!r.ok) throw new Error(`Could not load data/${name}.json (${r.status})`);
    return r.json();
  }
  function assetPath(key) { return assetIndex[key] ? `assets/${assetIndex[key]}` : null; }
  function image(key) {
    if (imageCache.has(key)) return imageCache.get(key);
    const path = assetPath(key);
    if (!path) return null;
    const im = new Image(); im.src = path; imageCache.set(key, im); return im;
  }
  function loadImage(key) {
    const im = image(key);
    if (!im) return Promise.resolve(null);
    if (im.complete) return Promise.resolve(im.naturalWidth ? im : null);
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        im.removeEventListener('load', finish);
        im.removeEventListener('error', finish);
        resolve(im.naturalWidth ? im : null);
      };
      const timeout = setTimeout(finish, 10000);
      im.addEventListener('load', finish, { once: true });
      im.addEventListener('error', finish, { once: true });
      if (im.complete) finish();
    });
  }
  function tableValue(t, id) { return t && Array.isArray(t.data) ? (t.data[id] || 0) : 0; }
  function table3(t, x, y, z) {
    if (!t || x < 0 || y < 0 || z < 0 || x >= t.xsize || y >= t.ysize || z >= t.zsize) return 0;
    return t.data[x + t.xsize * (y + t.ysize * z)] || 0;
  }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function savedState() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function applySave(s) { state = Object.assign(freshState(), s || {}); eventMotion.clear(); saveAllowed = state.saveAllowed !== false; }
  function saveGame(quiet=false) {
    if (!saveAllowed) { if (!quiet) return showMessage(['Збереження гри зараз недоступне.']); return false; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); if (!quiet) sayNotice('Game saved locally.'); return true; }
    catch (e) { if (!quiet) showMessage(['Could not save: browser storage is unavailable.']); return false; }
  }
  function showPanel(el) { overlay.classList.remove('hidden'); for (const item of [dialogEl, choiceEl, menuEl, battleEl]) item.classList.add('hidden'); el.classList.remove('hidden'); modal = true; }
  function hidePanels() { for (const item of [dialogEl, choiceEl, menuEl, battleEl]) item.classList.add('hidden'); overlay.classList.add('hidden'); modal = false; }

  function showMessage(lines, choice=null) {
    return new Promise(resolve => {
      const parts = [...lines].map(x => String(x ?? ''));
      let speaker = '';
      if (parts.length && /^.{1,24}:$/.test(parts[0].trim())) speaker = parts.shift().trim().slice(0, -1);
      speakerEl.textContent = speaker;
      textEl.textContent = parts.join('\n');
      dialogOptionsEl.replaceChildren();
      const options = choice?.options || [];
      let choiceIndex = 0;
      const buttons = options.map((label,index)=>{
        const button=document.createElement('button');button.type='button';button.className='message-choice';button.textContent=String(label);
        button.onclick=()=>finish(index);dialogOptionsEl.appendChild(button);return button;
      });
      dialogNextEl.classList.toggle('hidden',options.length>0);
      showPanel(dialogEl);
      let done = false;
      const finish = value => { if (done) return; done = true; document.removeEventListener('keydown', onKey); dialogOptionsEl.replaceChildren(); dialogNextEl.classList.add('hidden'); hidePanels(); resolve(value); };
      const onKey = e => {
        if(buttons.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();choiceIndex=(choiceIndex+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length;buttons[choiceIndex].focus();return;}
        if(e.key==='Escape'&&choice&&Number(choice.cancelType)>0&&Number(choice.cancelType)!==4){e.preventDefault();finish(Math.min(options.length-1,Number(choice.cancelType)-1));return;}
        if(['Enter',' ','z','Z'].includes(e.key)){e.preventDefault();finish(buttons.length?choiceIndex:undefined);}
      };
      document.addEventListener('keydown', onKey);
      dialogNextEl.onclick = () => finish(undefined);
      if(buttons.length)buttons[0].focus();
      if (!parts.length && !speaker) textEl.textContent = '…';
    });
  }
  function showChoices(options, cancelType=4) {
    return new Promise(resolve => {
      choiceEl.replaceChildren();
      options.forEach((label, index) => {
        const b = document.createElement('button'); b.className = 'choice-button'; b.textContent = String(label); b.onclick = () => { hidePanels(); resolve(index); };
        choiceEl.appendChild(b);
      });
      showPanel(choiceEl); choiceEl.querySelector('button')?.focus();
      const listener = e => {
        if (e.key === 'Escape' && Number(cancelType)>0 && Number(cancelType)!==4) { document.removeEventListener('keydown', listener); hidePanels(); resolve(Math.min(options.length - 1, Number(cancelType) - 1)); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const bs=[...choiceEl.querySelectorAll('button')]; const ix=bs.indexOf(document.activeElement); const step=e.key==='ArrowDown'?1:-1;
          bs[(ix+step+bs.length)%bs.length]?.focus(); e.preventDefault();
        }
      };
      document.addEventListener('keydown', listener);
      const originalResolve = resolve;
      resolve = value => { document.removeEventListener('keydown', listener); originalResolve(value); };
    });
  }
  function showMenu() {
    if (modal || scene !== 'map') return;
    menuEl.replaceChildren(); const h=document.createElement('h2'); h.textContent='Menu'; menuEl.appendChild(h);
    const meta=document.createElement('p'); meta.className='menu-meta'; meta.textContent=`${db.Actors?.[1]?.name || 'Hero'} · HP ${state.hp} · Gold ${state.gold}`; menuEl.appendChild(meta);
    const options=[['Continue',()=>hidePanels()],['Items',()=>showInventory()],['Save',()=>{hidePanels();saveGame();}],['Return to title',()=>{hidePanels();scene='title';}],['Close menu',()=>hidePanels()]];
    for (const [label,fn] of options){const b=document.createElement('button');b.className='choice-button';b.textContent=label;b.onclick=fn;menuEl.appendChild(b);}
    showPanel(menuEl); menuEl.querySelector('button')?.focus();
  }
  function showInventory() {
    menuEl.replaceChildren(); const h=document.createElement('h2');h.textContent='Items';menuEl.appendChild(h);
    const entries=Object.entries(state.items).filter(([,n])=>n>0);
    if (!entries.length){const p=document.createElement('p');p.className='menu-meta';p.textContent='No items.';menuEl.appendChild(p);}
    for(const [id,n] of entries){const item=db.Items?.[Number(id)];const b=document.createElement('button');b.className='choice-button';b.textContent=`${item?.name||`Item ${id}`} × ${n}`;b.onclick=async()=>{if(item){await showMessage([item.description||item.name]);}showInventory();};menuEl.appendChild(b);}
    const back=document.createElement('button');back.className='choice-button';back.textContent='Back';back.onclick=showMenu;menuEl.appendChild(back);showPanel(menuEl);
  }
  async function showBattle(troopId) {
    const troop = db.Troops?.[Number(troopId)];
    if (!troop) { await showMessage([`Missing troop ${troopId}.`]); return 2; }
    const enemies = (troop.members || []).filter(m => !m.hidden).map((m, i) => {
      const data = db.Enemies?.[m.enemy_id];
      return data ? { id: m.enemy_id, data, hp: data.maxhp || 1, maxhp: data.maxhp || 1, dead: false, index: i } : null;
    }).filter(Boolean);
    if (!enemies.length) { await showMessage(['There are no enemies in this troop.']); return 0; }
    const actor = db.Actors?.[1] || {name:'Hero',parameters:{data:[]},weapon_id:1};
    const weaponId = Number(actor.weapon_id || 0), weapon = db.Weapons?.[weaponId];
    let guarded = false, turn = 1, result = 2, log = `${enemies.map(e=>e.data.name).join(', ')} appeared!`;
    const getParam = idx => actor.parameters?.data?.[idx + (actor.parameters.xsize || 6) * Math.max(1,Number(state.level||1))] ?? 0;
    const actorMaxHp = Math.max(1,getParam(0)||500), actorMaxSp = Math.max(0,getParam(1)||500);
    if (state.hp <= 0) state.hp = actorMaxHp;
    if (state.sp == null) state.sp = actorMaxSp;
    const armorIds = [actor.armor1_id,actor.armor2_id,actor.armor3_id,actor.armor4_id].map(Number).filter(Boolean);
    const actorPdef = armorIds.reduce((n,id)=>n+(db.Armors?.[id]?.pdef||0),0);
    const actorMdef = armorIds.reduce((n,id)=>n+(db.Armors?.[id]?.mdef||0),0);
    const alive = () => enemies.filter(e=>e.hp>0);
    const knownSkills = () => {
      const classData=db.Classes?.[actor.class_id];
      const learned=new Set(state.skills||[]);
      for(const l of (classData?.learnings||[]))if(l.level<=Number(state.level||1))learned.add(l.skill_id);
      return [...learned].map(id=>db.Skills?.[id]).filter(s=>s && (s.occasion===0||s.occasion===1));
    };
    function buildBattleUI(resolveAction) {
      battleEl.replaceChildren();
      const h=document.createElement('h2');h.textContent=`Battle · ${troop.name || `Troop ${troopId}`} · Turn ${turn}`;battleEl.appendChild(h);
      const status=document.createElement('p');status.className='menu-meta';status.textContent=`${actor.name}  HP ${state.hp}/${actorMaxHp} · SP ${state.sp}/${actorMaxSp}`;battleEl.appendChild(status);
      const info=document.createElement('div');info.className='battle-enemies';
      for(const enemy of enemies){
        const row=document.createElement('div');row.className='battle-enemy';
        const picPath=assetPath('Graphics/Battlers/'+enemy.data.battler_name);
        if(picPath){const pic=document.createElement('img');pic.src=picPath;pic.alt=enemy.data.name;pic.loading='eager';row.appendChild(pic);}
        const detail=document.createElement('div');detail.className='battle-enemy-info';
        const nm=document.createElement('strong');nm.textContent=enemy.data.name+(enemy.hp<=0?' — defeated':'');detail.appendChild(nm);
        const bar=document.createElement('div');bar.className='hpbar';const fill=document.createElement('span');fill.style.width=`${Math.max(0,100*enemy.hp/enemy.maxhp)}%`;bar.appendChild(fill);detail.appendChild(bar);
        const hp=document.createElement('small');hp.textContent=`HP ${Math.max(0,enemy.hp)} / ${enemy.maxhp}`;detail.appendChild(hp);row.appendChild(detail);info.appendChild(row);
      }
      battleEl.appendChild(info);
      const news=document.createElement('p');news.className='battle-log';news.textContent=log;battleEl.appendChild(news);
      const options=document.createElement('div');options.className='battle-actions';
      const add=(label,action,disabled=false)=>{const b=document.createElement('button');b.className='choice-button';b.textContent=label;b.disabled=disabled;b.onclick=()=>resolveAction(action);options.appendChild(b);};
      add('Attack', {type:'attack'});
      add('Guard', {type:'guard'});
      const skills=knownSkills();
      if(skills.length){
        add('Skills', {type:'skills'});
      }
      const items=Object.entries(state.items).map(([id,n])=>({item:db.Items?.[Number(id)],id:Number(id),count:n})).filter(x=>x.item&&x.count>0&&(x.item.occasion===0||x.item.occasion===1));
      if(items.length)add('Items', {type:'items'});
      add('Escape', {type:'escape'});
      battleEl.appendChild(options);showPanel(battleEl);
    }
    let action;
    while (true) {
      action = await new Promise(resolveAction => buildBattleUI(resolveAction));
      if(action.type==='skills'){
        const skills=knownSkills();
        const chosen=await showChoices(skills.map(s=>`${s.name} — ${s.sp_cost} SP`));
        if(chosen<0||!skills[chosen])continue;
        const skill=skills[chosen];
        if(state.sp<skill.sp_cost){log='Not enough SP.';continue;}
        state.sp-=skill.sp_cost;
        if(skill.power<0){const heal=Math.abs(skill.power)+Math.floor(getParam(5)*0.3);state.hp=Math.min(actorMaxHp,state.hp+heal);log=`${actor.name} used ${skill.name}, restoring ${heal} HP.`;}
        else {
          const target=alive()[0];if(!target){result=0;break;}
          const variance=0.85+Math.random()*0.3;
          const damage=Math.max(1,Math.round((getParam(2)*2+(weapon?.atk||0)*2+skill.power*2-target.data.mdef)*variance));
          target.hp=Math.max(0,target.hp-damage);log=`${actor.name} used ${skill.name}! ${target.data.name} took ${damage} damage.`;
        }
      } else if(action.type==='items') {
        const items=Object.entries(state.items).map(([id,n])=>({item:db.Items?.[Number(id)],id:Number(id),count:n})).filter(x=>x.item&&x.count>0&&(x.item.occasion===0||x.item.occasion===1));
        const chosen=await showChoices(items.map(x=>`${x.item.name} × ${x.count}`));if(chosen<0||!items[chosen])continue;
        const entry=items[chosen],it=entry.item;state.hp=Math.min(actorMaxHp,state.hp+(it.recover_hp||0)+Math.floor(actorMaxHp*(it.recover_hp_rate||0)/100));state.sp=Math.min(actorMaxSp,state.sp+(it.recover_sp||0)+Math.floor(actorMaxSp*(it.recover_sp_rate||0)/100));
        if(it.consumable)state.items[entry.id]=Math.max(0,(state.items[entry.id]||0)-1);log=`Used ${it.name}. HP ${state.hp}/${actorMaxHp}.`;
      } else if(action.type==='escape') {
        result=1;log='You escaped from battle.';break;
      } else if(action.type==='guard') {
        guarded=true;log=`${actor.name} is guarding.`;
      } else {
        const target=alive()[0];if(!target){result=0;break;}
        const variance=0.85+Math.random()*0.3;
        const damage=Math.max(1,Math.round((getParam(2)*2+(weapon?.atk||0)*2-target.data.pdef)*variance));
        target.hp=Math.max(0,target.hp-damage);log=`${actor.name} attacks ${target.data.name} for ${damage} damage.`;
      }
      if(alive().length===0){result=0;break;}
      for(const enemy of alive()){
        const variance=0.8+Math.random()*0.4;
        const raw=(enemy.data.atk||0)*0.65+(enemy.data.str||0)*0.5-actorPdef*0.2;
        let damage=Math.max(5,Math.round(raw*variance));if(guarded)damage=Math.max(1,Math.round(damage*0.5));
        state.hp=Math.max(0,state.hp-damage);log+=`\n${enemy.data.name} attacks: ${damage} damage.`;
        if(state.hp<=0)break;
      }
      guarded=false;turn++;
      if(state.hp<=0){result=2;break;}
    }
    hidePanels();
    if(result===0){
      const exp=enemies.reduce((n,e)=>n+(e.data.exp||0),0), gold=enemies.reduce((n,e)=>n+(e.data.gold||0),0);
      state.exp=(state.exp||0)+exp;state.gold=(state.gold||0)+gold;
      log+=`\nVictory! ${exp} EXP and ${gold} gold obtained.`;
      await showMessage([log]);
    } else if(result===1) { await showMessage(['You escaped.']); }
    else { state.hp=1;await showMessage(['You were defeated.']); }
    return result;
  }
  function titleDraw() {
    ctx.fillStyle='#070b11';ctx.fillRect(0,0,W,H);
    const im=image('Graphics/Titles/'+(db.System?.title_name||'001-Title01'));
    if(im?.complete&&im.naturalWidth) ctx.drawImage(im,0,0,W,H);
    ctx.fillStyle='rgba(4,7,11,.57)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.fillStyle='#f1dfaf';ctx.font='bold 40px Georgia,serif';ctx.fillText('LIGHT PATHFINDER',W/2,125);
    const hasSave=!!savedState();
    ctx.fillStyle='rgba(5,7,10,.63)';ctx.fillRect(224,288,192,128);
    ctx.strokeStyle='rgba(225,210,173,.42)';ctx.strokeRect(224.5,288.5,191,127);
    const choices=[['New Game',322],['Continue',354],['Shutdown',386]];
    choices.forEach(([txt,y],i)=>{ctx.fillStyle=i===1&&!hasSave?'#777e87':titleSelection===i?'#d8bb78':'#f5f1e8';ctx.font=titleSelection===i?'bold 20px monospace':'18px monospace';ctx.fillText((titleSelection===i?'▶ ':'')+txt,W/2,y);});
    ctx.fillStyle='#c7cbd1';ctx.font='12px monospace';ctx.fillText('Click an option  ·  ↑ ↓ + Enter',W/2,449);
  }
  let titleSelection=0;
  function loadingDraw(){
    ctx.fillStyle='#070b11';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#f1dfaf';ctx.textAlign='center';ctx.font='bold 28px Georgia,serif';ctx.fillText('LIGHT PATHFINDER',W/2,H/2-16);
    ctx.fillStyle='#d5d9e0';ctx.font='16px monospace';ctx.fillText(`Loading map ${mapId}…`,W/2,H/2+24);
  }
  function drawTile(target, tileId, x, y, autoFrame=0) {
    if (!tileId) return;
    if (tileId >= 384) {
      const im=image('Graphics/Tilesets/'+tileset.tileset_name);
      if (!im?.complete || !im.naturalWidth) return;
      const n=tileId-384, sx=(n%8)*32, sy=Math.floor(n/8)*32;
      if (sx+32<=im.width && sy+32<=im.height) target.drawImage(im,sx,sy,32,32,x,y,32,32);
      return;
    }
    if(tileId < 48) return;
    const slot=Math.floor(tileId/48)-1, variant=tileId%48, name=tileset.autotile_names?.[slot];
    if(!name) return;
    const key=`${name}:${variant}:${autoFrame}`; let tile=autoTileCache.get(key);
    if(!tile){const source=image('Graphics/Autotiles/'+name);if(!source?.complete||!source.naturalWidth)return;tile=document.createElement('canvas');tile.width=32;tile.height=32;const tc=tile.getContext('2d');tc.imageSmoothingEnabled=false;
      const frameCount=Math.max(1,Math.floor(source.width/96)), frame=autoFrame%frameCount; const sourceX=frame*96;
      const pattern=AUTO_INDEX[variant];
      for(let q=0;q<4;q++){const n=pattern[q]-1,sx=sourceX+(n%6)*16,sy=Math.floor(n/6)*16,dx=(Math.floor(sx-sourceX)%32),dy=(sy%32);tc.drawImage(source,sx,sy,16,16,dx,dy,16,16);}
      autoTileCache.set(key,tile);
    }
    target.drawImage(tile,x,y);
  }
  const AUTO_INDEX = [
    [27,28,33,34],[5,28,33,34],[27,6,33,34],[5,6,33,34],
    [27,28,33,12],[5,28,33,12],[27,6,33,12],[5,6,33,12],
    [27,28,11,34],[5,28,11,34],[27,6,11,34],[5,6,11,34],
    [27,28,11,12],[5,28,11,12],[27,6,11,12],[5,6,11,12],
    [25,26,31,32],[25,6,31,32],[25,26,31,12],[25,6,31,12],
    [15,16,21,22],[15,16,21,12],[15,16,11,22],[15,16,11,12],
    [29,30,35,36],[29,30,11,36],[5,30,35,36],[5,30,11,36],
    [39,40,45,46],[5,40,45,46],[39,6,45,46],[5,6,45,46],
    [25,30,31,36],[15,16,45,46],[13,14,19,20],[13,14,19,12],
    [17,18,23,24],[17,18,11,24],[41,42,47,48],[5,42,47,48],
    [37,38,43,44],[37,6,43,44],[13,18,19,24],[13,14,43,44],
    [37,42,43,48],[17,18,47,48],[13,18,43,48],[13,18,43,48]
  ];
  async function loadMap(id, x=null, y=null, dir=null) {
    mapId=Number(id); state.mapId=mapId;
    sayNotice(`Loading map ${mapId}…`);
    map=await fetchJson(`Map${String(mapId).padStart(3,'0')}`);
    tileset=db.Tilesets?.[map.tileset_id];
    if(!tileset) throw new Error(`Map ${mapId} references missing tileset ${map.tileset_id}`);
    if(x!==null)state.x=x;if(y!==null)state.y=y;if(dir!==null&&dir!==0)state.direction=dir;
    player={x:state.x,y:state.y,direction:state.direction||2,pattern:0,originalPattern:0,animeCount:0,moveSpeed:4,characterName:db.Actors?.[1]?.character_name||'001-Fighter01'};
    const waits=[loadImage('Graphics/Tilesets/'+tileset.tileset_name)];
    (tileset.autotile_names||[]).filter(Boolean).forEach(n=>waits.push(loadImage('Graphics/Autotiles/'+n)));
    for(const ev of Object.values(map.events||{})){const pg=getActivePage(ev);const n=pg?.graphic?.character_name;if(n)waits.push(loadImage('Graphics/Characters/'+n));}
    waits.push(loadImage('Graphics/Characters/'+player.characterName));
    await Promise.all(waits);
    buildTilemap(); scene='map'; renderedSignature=''; sayNotice(`Map ${mapId}: ${db.MapInfos?.[String(mapId)]?.name||'Unknown'} · WASD/arrows to move`);
    startMapAudio();
    render();
    // Execute one autorun per active event page on each map visit.
    for(const ev of Object.values(map.events||{})) { const pg=getActivePage(ev); if(pg?.trigger===3){const k=`${mapId}:${ev.id}:${pageIndex(ev)}`;if(!runningEvents.has(k)){runningEvents.add(k);runEvent(ev,pg).catch(reportError);} } }
  }
  function buildTilemap() {
    const tw=map.width, th=map.height;
    mapBase=document.createElement('canvas');mapBase.width=tw*TILE;mapBase.height=th*TILE;const b=mapBase.getContext('2d');b.imageSmoothingEnabled=false;
    mapOverlay=[null]; for(let p=1;p<=5;p++){mapOverlay[p]=document.createElement('canvas');mapOverlay[p].width=tw*TILE;mapOverlay[p].height=th*TILE;mapOverlay[p]=mapOverlay[p];mapOverlay[p].getContext('2d').imageSmoothingEnabled=false;}
    const frames=autoFrameIndex;
    for(let y=0;y<th;y++)for(let x=0;x<tw;x++)for(let z=0;z<3;z++){
      const id=table3(map.data,x,y,z);if(!id)continue;
      const pri=tableValue(tileset.priorities,id);const target=pri>0?(mapOverlay[Math.min(5,pri)]||mapOverlay[1]).getContext('2d'):b;
      drawTile(target,id,x*TILE,y*TILE,frames);
    }
    renderedSignature=`${mapId}:${frames}`;
  }
  function pageIndex(ev) { const pages=ev.pages||[];let found=-1;for(let i=0;i<pages.length;i++)if(pageValid(ev,pages[i]))found=i;return found; }
  function pageValid(ev,page){const c=page.condition||{};if(c.switch1_valid&&!state.switches[c.switch1_id])return false;if(c.switch2_valid&&!state.switches[c.switch2_id])return false;if(c.variable_valid&&(state.variables[c.variable_id]||0)<c.variable_value)return false;if(c.self_switch_valid&&!state.selfSwitches[`${mapId}:${ev.id}:${c.self_switch_ch}`])return false;return true;}
  function getActivePage(ev){const i=pageIndex(ev);return i<0?null:ev.pages[i];}
  function getEventMotion(ev,pg){
    const key=`${mapId}:${ev.id}`,index=pageIndex(ev);let s=eventMotion.get(key);
    if(!s){const saved=state.eventPositions?.[key]||{};s={pageIndex:index,x:saved.x??ev.x,y:saved.y??ev.y,direction:saved.direction??pg.graphic?.direction??2,pattern:saved.pattern??pg.graphic?.pattern??0,animeCount:0,stopCount:0,moveFrom:null,moveStarted:0};eventMotion.set(key,s);}
    else if(s.pageIndex!==index){s.pageIndex=index;s.direction=pg.graphic?.direction||2;s.pattern=pg.graphic?.pattern||0;s.animeCount=0;s.stopCount=0;}
    return s;
  }
  function eventList(){return Object.values(map?.events||{}).map(ev=>{const pg=getActivePage(ev);return pg?{ev,pg,motion:getEventMotion(ev,pg)}:null;}).filter(Boolean);}
  function playerVisualPosition(){
    if(!player)return {x:0,y:0};
    const from=player.moveFrom;
    if(!from)return {x:player.x,y:player.y};
    const t=Math.min(1,Math.max(0,(performance.now()-player.moveStarted)/133));
    if(t===1)player.moveFrom=null;
    return {x:from.x+(player.x-from.x)*t,y:from.y+(player.y-from.y)*t};
  }
  function camera(){const pos=playerVisualPosition(),maxX=Math.max(0,map.width*TILE-W),maxY=Math.max(0,map.height*TILE-H);return {x:Math.min(maxX,Math.max(0,pos.x*TILE-W/2+TILE/2)),y:Math.min(maxY,Math.max(0,pos.y*TILE-H/2+TILE/2))};}
  function drawCharacter(name,hue,pattern,direction,worldX,worldY,opacity=255, isPlayer=false) {
    const im=image('Graphics/Characters/'+name); if(!im?.complete||!im.naturalWidth)return;
    const cw=im.width/4,ch=im.height/4,pat=pattern%4,row=({2:0,4:1,6:2,8:3})[direction]??0;
    const sx=pat*cw,sy=row*ch;const cam=camera();const dx=Math.round(worldX*TILE-cam.x+(TILE-cw)/2),dy=Math.round((worldY+1)*TILE-cam.y-ch);
    ctx.globalAlpha=Math.max(0,Math.min(255,opacity))/255;
    ctx.drawImage(im,sx,sy,cw,ch,dx,dy,cw,ch);ctx.globalAlpha=1;
  }
  function render() {
    if(scene==='title'){titleDraw();return;}
    if(scene==='loading'){loadingDraw();return;}
    if(scene==='shutdown'){ctx.fillStyle='#070b11';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f1dfaf';ctx.font='20px Georgia,serif';ctx.textAlign='center';ctx.fillText('Light Pathfinder is shut down.',W/2,H/2);ctx.fillStyle='#c7cbd1';ctx.font='13px monospace';ctx.fillText('You may close this tab.',W/2,H/2+30);return;}
    if(scene!=='map'||!map||!player)return;
    ctx.fillStyle='#111';ctx.fillRect(0,0,W,H);
    if(mapBase){const cam=camera();ctx.drawImage(mapBase,cam.x,cam.y,W,H,0,0,W,H);}
    const chars=[];
    for(const {ev,pg,motion} of eventList()){
      const g=pg.graphic||{};if(!g.character_name||g.tile_id>0)continue;
      const pos=eventVisualPosition(motion);
      chars.push({name:g.character_name,hue:g.character_hue||0,pattern:motion.pattern,direction:motion.direction,x:pos.x,y:pos.y,sortY:motion.y,opacity:g.opacity||255,top:pg.always_on_top?1:0});
    }
    const visual=playerVisualPosition();
    chars.push({name:player.characterName,hue:0,pattern:player.pattern||0,direction:player.direction,x:visual.x,y:visual.y,sortY:player.y,opacity:255,top:0,isPlayer:true});
    chars.sort((a,b)=>((a.sortY??a.y)-(b.sortY??b.y))||(a.top-b.top));
    for(const c of chars)drawCharacter(c.name,c.hue,c.pattern,c.direction,c.x,c.y,c.opacity,c.isPlayer);
    const cam=camera();for(let p=1;p<=5;p++)if(mapOverlay[p])ctx.drawImage(mapOverlay[p],cam.x,cam.y,W,H,0,0,W,H);
  }
  function canPass(x,y,dir,movingEventId=0,movingEventThrough=false){
    return passability.canPass({map,tileset,events:eventList(),player,x,y,direction:dir,movingEventId,through:movingEventThrough});
  }
  function eventVisualPosition(motion){
    const from=motion.moveFrom;
    if(!from)return {x:motion.x,y:motion.y};
    const duration=128/(2**(motion.moveSpeed||4))*1000/60,t=Math.min(1,Math.max(0,(performance.now()-motion.moveStarted)/duration));
    if(t===1)motion.moveFrom=null;
    return {x:from.x+(motion.x-from.x)*t,y:from.y+(motion.y-from.y)*t};
  }
  function checkPlayerTouch(x=player.x,y=player.y,triggers=[2]){for(const {ev,pg,motion} of eventList())if(triggers.includes(pg.trigger)&&motion.x===x&&motion.y===y)runEvent(ev,pg).catch(reportError);}
  function moveEvent(ev,pg,motion,dir){
    if(canPass(motion.x,motion.y,dir,ev.id,pg.through)){
      if(!pg.direction_fix)motion.direction=dir;
      const from={x:motion.x,y:motion.y},dx=dir===4?-1:dir===6?1:0,dy=dir===8?-1:dir===2?1:0;
      motion.moveFrom=from;motion.moveStarted=performance.now();motion.moveSpeed=pg.move_speed||3;motion.x+=dx;motion.y+=dy;
      state.eventPositions[`${mapId}:${ev.id}`]={x:motion.x,y:motion.y,direction:motion.direction,pattern:motion.pattern};
      checkPlayerTouch(motion.x,motion.y,2);
    }else{
      const nx=motion.x+(dir===4?-1:dir===6?1:0),ny=motion.y+(dir===8?-1:dir===2?1:0);
      if(nx===player.x&&ny===player.y&&pg.trigger===2)runEvent(ev,pg).catch(reportError);
    }
  }
  function updateEvents(delta){
    for(const {ev,pg,motion} of eventList()){
      const elapsed=motion.moveFrom?performance.now()-motion.moveStarted:Infinity;
      const duration=128/(2**(pg.move_speed||3))*1000/60;
      if(motion.moveFrom&&elapsed>=duration)motion.moveFrom=null;
      const moving=!!motion.moveFrom,scale=Math.max(0,delta)/(1000/60);
      if(moving&&pg.walk_anime)motion.animeCount+=scale*1.5;
      else if(pg.step_anime)motion.animeCount+=scale;
      else if(!moving&&motion.pattern!==(pg.graphic?.pattern||0))motion.animeCount+=scale*1.5;
      if(motion.animeCount>18-(pg.move_speed||3)*2){if(moving)motion.pattern=(motion.pattern+1)%4;else motion.pattern=pg.graphic?.pattern||0;motion.animeCount=0;}
      if(moving||runningEvents.has(`busy:${mapId}:${ev.id}`))continue;
      motion.stopCount+=scale;
      const frequency=pg.move_frequency||3,threshold=(40-frequency*2)*(6-frequency);
      if((pg.move_type===1||pg.move_type===2)&&motion.stopCount>threshold){
        const action=Math.floor(Math.random()*6);motion.stopCount=0;
        if(pg.move_type===1){if(action<4)moveEvent(ev,pg,motion,[2,4,6,8][action]);else if(action===4)moveEvent(ev,pg,motion,motion.direction);}
        else if(action<4){
          const sx=motion.x-player.x,sy=motion.y-player.y,ax=Math.abs(sx),ay=Math.abs(sy);
          if(ax>=ay&&sx)moveEvent(ev,pg,motion,sx>0?4:6);else if(sy)moveEvent(ev,pg,motion,sy>0?8:2);
        }else if(action===4)moveEvent(ev,pg,motion,[2,4,6,8][Math.floor(Math.random()*4)]);
        else moveEvent(ev,pg,motion,motion.direction);
      }
    }
  }
  async function step(dir){
    if(modal||scene!=='map'||!player)return;
    player.direction=dir;state.direction=dir;
    if(canPass(player.x,player.y,dir)){
      const dx=dir===4?-1:dir===6?1:0,dy=dir===8?-1:dir===2?1:0;
      player.moveFrom={x:player.x,y:player.y};player.moveStarted=performance.now();
      player.x+=dx;player.y+=dy;state.x=player.x;state.y=player.y;state.playFrames++;checkPlayerTouch();
    }else{checkPlayerTouch(player.x+(dir===4?-1:dir===6?1:0),player.y+(dir===8?-1:dir===2?1:0),[1,2]);}
    render();
  }
  async function interact(){
    if(modal||scene!=='map')return;
    const dx=player.direction===4?-1:player.direction===6?1:0,dy=player.direction===8?-1:player.direction===2?1:0;
    const targets=eventList().filter(({pg,motion})=>pg.trigger===0&&((motion.x===player.x+dx&&motion.y===player.y+dy)||(motion.x===player.x&&motion.y===player.y)));
    if(targets.length){targets.sort((a,b)=>a.ev.id-b.ev.id);await runEvent(targets[0].ev,targets[0].pg);}
  }
  function skipToBranch(list,i,indent){for(let j=i+1;j<list.length;j++)if([402,403,404].includes(list[j].code)&&list[j].indent===indent)return j;return list.length-1;}
  async function runEvent(ev,pg){
    if(!ev||!pg||runningEvents.has(`busy:${mapId}:${ev.id}`)||modal)return;
    const busy=`busy:${mapId}:${ev.id}`;runningEvents.add(busy);currentEvent=ev;
    const sourceMapId=mapId,sourcePage=pageIndex(ev)+1;
    try{await executeList(pg.list||[],ev,sourceMapId,sourcePage);}catch(err){reportError(err);}finally{runningEvents.delete(busy);currentEvent=null;render();}
  }
  async function executeList(list,ev,sourceMapId,pageNumber){
    let i=0,choiceResult=null,loopStack=[],iterations=0,battleResult=0;
    while(i<list.length){
      if(iterations++>5000){console.warn('Event command safety stop',ev?.id);break;}
      const c=list[i],p=c.parameters||[],code=c.code,indent=c.indent||0;
      switch(code){
        case 0: i++;break;
      case 101:{const lines=[p[0]??''];let j=i+1;while(j<list.length&&list[j].code===401){lines.push(list[j].parameters?.[0]??'');j++;}if(list[j]?.code===102){const choiceParams=list[j].parameters||[];choiceResult=await showMessage(lines,{options:choiceParams[0]||[],cancelType:choiceParams[1]??4});i=j+1;}else{await showMessage(lines);i=j;}break;}
        case 102: choiceResult=await showChoices(p[0]||[],p[1]??4);i++;break;
        case 402: if(choiceResult!==Number(p[0])){i=skipToBranch(list,i,indent);}else{choiceResult=null;i++;}break;
        case 403: if(choiceResult!==-1){i=skipToBranch(list,i,indent);}else{choiceResult=null;i++;}break;
        case 404: choiceResult=null;i++;break;
        case 112:{let end=i+1,depth=1;while(end<list.length){if(list[end].code===112)depth++;if(list[end].code===413&&--depth===0)break;end++;}loopStack.push({start:i+1,end});i++;break;}
        case 113:{const loop=loopStack.pop();if(loop)i=loop.end+1;else i++;break;}
        case 413:{const loop=loopStack[loopStack.length-1];if(loop&&loop.end===i)i=loop.start;else i++;break;}
        case 123:{const letter=p[0]||'A';const on=(p[1]??0)===0;state.selfSwitches[`${mapId}:${ev.id}:${letter}`]=on;i++;break;}
        case 201:{let dest=p[0]===0?Number(p[1]):Number(state.variables[p[1]]||1);let x=p[0]===0?Number(p[2]):Number(state.variables[p[2]]||0);let y=p[0]===0?Number(p[3]):Number(state.variables[p[3]]||0);const dir=Number(p[4]||0);i++;await loadMap(dest,x,y,dir);break;}
        case 106: await new Promise(r=>setTimeout(r,Math.max(0,Math.min(2000,Number(p[0]||1)*16))));i++;break;
        case 125:{const op=Number(p[0]||0),type=Number(p[1]||0),amount=type===0?Number(p[2]||0):Number(state.variables[p[2]]||0);state.gold=Math.max(0,(state.gold||0)+(op===0?amount:-amount));i++;break;}
        case 126: changeInventory('items',p);i++;break;
        case 127: changeInventory('weapons',p);i++;break;
        case 128: changeInventory('armors',p);i++;break;
        case 134: saveAllowed=Number(p[0]||0)===0;state.saveAllowed=saveAllowed;i++;break;
        case 224: case 225: case 337: case 339: {
          logUnsupportedCommand(sourceMapId,ev,pageNumber,i,c);
          i++;break;
        }
        case 301:{const result=await showBattle(p[0]||0);battleResult=result;i++;break;}
        case 311:{const actorSelector=p[0]||0,op=p[1]||0,operandType=p[2]||0,amount=operandType===0?Number(p[3]||0):Number(state.variables[p[3]]||0);if(actorSelector===0||actorSelector===1){state.hp=Math.max(p[4]?0:1,Math.min(9999,state.hp+(op===0?amount:-amount)));}i++;break;}
        case 318:{const skillId=Number(p[2]||0),op=Number(p[1]||0);state.skills=state.skills||[];if(op===1){if(!state.skills.includes(skillId))state.skills.push(skillId);}else{state.skills=state.skills.filter(id=>id!==skillId);}i++;break;}
        case 322:{if(Number(p[0])===1&&p[1])player.characterName=String(p[1]);i++;break;}
        case 352:{hidePanels();const oldScene=scene;scene='map';showMenu();await waitForMenuClose();if(scene!=='title')scene=oldScene;i++;break;}
        case 353:await showMessage(['Game over.']);scene='title';i=list.length;break;
        case 601: if(battleResult!==0)i=skipToBattleEnd(list,i,indent);else i++;break;
        case 602: if(battleResult!==1)i=skipToBattleEnd(list,i,indent);else i++;break;
        case 603: if(battleResult!==2)i=skipToBattleEnd(list,i,indent);else i++;break;
        case 604:battleResult=0;i++;break;
        case 411: i++;break;
        default:logUnsupportedCommand(sourceMapId,ev,pageNumber,i,c);i++;break;
      }
      state.x=player?.x??state.x;state.y=player?.y??state.y;state.mapId=mapId;saveGame(true);
    }
  }
  function logUnsupportedCommand(sourceMapId,ev,pageNumber,index,command){
    const record={mapId:Number(sourceMapId),eventId:Number(ev?.id||0),page:Number(pageNumber||0),commandIndex:Number(index),code:Number(command?.code),parameters:command?.parameters??[]};
    const key=JSON.stringify(record);
    if(unsupportedCommands.has(key))return;
    unsupportedCommands.add(key);
    console.warn('[Light Pathfinder] Unsupported event command',record);
  }
  function skipToBattleEnd(list,i,indent){for(let j=i+1;j<list.length;j++)if([601,602,603,604].includes(list[j].code)&&list[j].indent===indent)return j;return list.length-1;}
  function changeInventory(bucket,p){const id=Number(p[0]||0),op=Number(p[1]||0),type=Number(p[2]||0),n=type===0?Number(p[3]||0):Number(state.variables[p[3]]||0);state[bucket][id]=Math.max(0,(state[bucket][id]||0)+(op===0?n:-n));}
  function waitForMenuClose(){return new Promise(resolve=>{const poll=()=>{if(!modal){resolve();return;}setTimeout(poll,50);};poll();});}
  function startMapAudio(){const track=map?.bgm?.name;if(!track)return;const path=assetPath('Audio/BGM/'+track);if(!path)return;try{if(music){music.pause();}music=new Audio(path);music.loop=true;music.volume=Math.max(0,Math.min(1,(map.bgm.volume??80)/100));music.play().catch(()=>{});}catch(_){}}
  async function enterNewGame(){
    if(gameStarting)return;
    gameStarting=true;state=freshState();eventMotion.clear();saveAllowed=true;scene='loading';render();
    try{await loadMap(state.mapId,state.x,state.y,state.direction);saveGame(true);}
    catch(e){scene='title';sayNotice(`Could not start game: ${e?.message||e}`);render();}
    finally{gameStarting=false;}
  }
  async function continueGame(){
    if(gameStarting)return;
    const s=savedState();if(!s){await showMessage(['No saved game exists in this browser yet.']);scene='title';return;}
    gameStarting=true;applySave(s);scene='loading';render();
    try{await loadMap(state.mapId,state.x,state.y,state.direction);}
    catch(e){scene='title';sayNotice(`Could not load saved game: ${e?.message||e}`);render();}
    finally{gameStarting=false;}
  }
  function reportError(e){console.error(e);sayNotice('Runtime error: '+(e?.message||e));}
  function handleKeyDown(e){
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Escape','z','Z','x','X'].includes(e.key))e.preventDefault();
    if(scene==='title'){
      if(e.repeat)return;
      if(e.key==='ArrowDown')titleSelection=(titleSelection+1)%3;
      if(e.key==='ArrowUp')titleSelection=(titleSelection+2)%3;
      if(e.key==='Enter'||e.key===' '||e.key==='z'||e.key==='Z'){
        if(titleSelection===0)enterNewGame().catch(reportError);
        else if(titleSelection===1)continueGame().catch(reportError);
        else {scene='shutdown';sayNotice('You may close this tab.');}
      }
      render();return;
    }
    if(scene==='shutdown')return;
    if(modal)return;
    if((e.key==='Escape'||e.key==='x'||e.key==='X')&&!e.repeat){showMenu();return;}
    if((e.key==='Enter'||e.key===' '||e.key==='z'||e.key==='Z')&&!e.repeat){interact().catch(reportError);return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){
      keys.add(e.key);
      const dir=({ArrowUp:8,w:8,W:8,ArrowDown:2,s:2,S:2,ArrowLeft:4,a:4,A:4,ArrowRight:6,d:6,D:6})[e.key];
      if(!e.repeat){
        queuedDirection=dir;
        if(scene==='map'&&player&&!player.moveFrom&&performance.now()-lastMoveAt>=133){queuedDirection=0;lastMoveAt=performance.now();step(dir).catch(reportError);}
      }
    }
  }
  function handleKeyUp(e){keys.delete(e.key);}
  function handleCanvasClick(e){
    if(scene!=='title'||gameStarting)return;
    const rect=canvas.getBoundingClientRect(),y=(e.clientY-rect.top)*H/rect.height;
    if(y<304||y>=400)return;
    titleSelection=Math.min(2,Math.floor((y-304)/32));render();
    if(titleSelection===0)enterNewGame();
    else if(titleSelection===1)continueGame();
    else{scene='shutdown';sayNotice('You may close this tab.');render();}
  }
  function updatePlayerAnimation(t,delta){
    if(!player)return;
    if(player.moveFrom&&t-player.moveStarted>=133)player.moveFrom=null;
    const moving=!!player.moveFrom;
    if(moving)player.animeCount+=Math.max(0,delta)/(1000/60)*1.5;
    else if(player.pattern!==player.originalPattern)player.animeCount+=Math.max(0,delta)/(1000/60)*1.5;
    if(player.animeCount>18-player.moveSpeed*2){
      if(moving)player.pattern=(player.pattern+1)%4;
      else player.pattern=player.originalPattern;
      player.animeCount=0;
    }
  }
  function update(t){
    const delta=t-lastFrame;lastFrame=t;
    updatePlayerAnimation(t,delta);
    if(scene==='map'&&map)updateEvents(delta);
    if(scene==='map'&&!modal&&player&&t-lastMoveAt>=133&&(!player.moveFrom||t-player.moveStarted>=133)){
      const directions={'ArrowUp':8,'w':8,'W':8,'ArrowDown':2,'s':2,'S':2,'ArrowLeft':4,'a':4,'A':4,'ArrowRight':6,'d':6,'D':6};
      const heldDirection=[...keys].reverse().map(key=>directions[key]).find(Boolean)||0;
      const dir=heldDirection||queuedDirection;
      if(dir){queuedDirection=0;lastMoveAt=t;step(dir).catch(reportError);}
    }
    if(scene==='map'&&map){const f=Math.floor(t/280)%4;if(f!==autoFrameIndex){autoFrameIndex=f;buildTilemap();}render();}
    if(scene==='map')state.playFrames++;
    requestAnimationFrame(update);
  }
  async function boot(){
    try{
      assetIndex=await (await fetch('asset-index.json')).json();
      const names=['System','MapInfos','Tilesets','Actors','Items','Weapons','Armors','Skills','Enemies','Troops','States','Classes','Animations','CommonEvents'];
      const values=await Promise.all(names.map(fetchJson));names.forEach((n,i)=>db[n]=values[i]);
      if(!location.protocol.startsWith('http'))sayNotice('For reliable offline use, start the included local server (start-local.bat / .sh).');else sayNotice('Ready · Use arrow keys and Enter.');
      await loadImage('Graphics/Titles/'+(db.System.title_name||'001-Title01'));
      const hasSave=!!savedState();titleSelection=hasSave?1:0;
      render();
    }catch(e){console.error(e);sayNotice(`Could not start the game: ${e.message}. Open it through the included local server.`);ctx.fillStyle='#10141b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='16px monospace';ctx.fillText('Could not load game data.',24,50);ctx.font='12px monospace';ctx.fillText(e.message,24,76);}
  }
  document.addEventListener('keydown',handleKeyDown);document.addEventListener('keyup',handleKeyUp);
  canvas.addEventListener('click',handleCanvasClick);
  window.addEventListener('blur',()=>keys.clear());
  window.LightPathfinder={db,get state(){return state;},loadMap,saveGame,executeList};
  boot();requestAnimationFrame(update);
})();
