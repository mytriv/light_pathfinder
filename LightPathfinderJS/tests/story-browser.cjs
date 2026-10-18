// Run with a locally installed Playwright: node tests/story-browser.cjs
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const fs=require('node:fs');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1000,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{localStorage.setItem('light-pathfinder-save-v1',JSON.stringify({mapId:7,player:{x:21,y:14,direction:8},story:{bossDefeated:true},selfSwitches:[],party:{hp:100,gold:0}}));});
  await page.route('**/src/main.js',route=>route.fulfill({contentType:'text/javascript',body:`import {PathfinderEngine} from './engine.js';window.testEngine=new PathfinderEngine(document.querySelector('#game'));await window.testEngine.start();document.querySelector('#front-screen').hidden=true;document.querySelector('#play-tools').hidden=false;window.testReady=true;`}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.testReady);
  assert.equal(await page.evaluate(()=>window.testEngine.player.characterName),'gallery_10517_34_1007','Legacy post-battle save should restore the original naked sprite');
  await page.locator('#journal-toggle').click();assert(await page.locator('#journal').isVisible());
  const pagination=await page.evaluate(async()=>{
    const e=window.testEngine,{STORY_DIALOGUE}=await import('/src/story-dialogue.js');
    const text=STORY_DIALOGUE.scenes.priest[2].text;
    void e.showMessage([text]);const pages=e.dialog.lines;
    const result={pages:pages.length,complete:pages.join(' ').replace(/\s+/g,' ')===text.replace(/\s+/g,' '),rows:pages.every(p=>p.split('\n').length<=3)};
    while(e.dialog)e.advanceDialog();return result;
  });
  assert(pagination.complete&&pagination.rows&&pagination.pages>1,'Long verbatim dialogue was truncated');
  const access=await page.evaluate(()=>{
    const e=window.testEngine,seen=new Set(),queue=[[e.player.x,e.player.y]];
    const dirs=[[0,1,2,8],[-1,0,4,6],[1,0,6,4],[0,-1,8,2]];
    while(queue.length){const [x,y]=queue.shift(),k=`${x},${y}`;if(seen.has(k))continue;seen.add(k);
      for(const [dx,dy,d,opp]of dirs){const nx=x+dx,ny=y+dy;if(!e.isPassable(x,y,d)||!e.isPassable(nx,ny,opp))continue;
        const block=Object.values(e.map.events).some(ev=>ev.x===nx&&ev.y===ny&&!e.activePage(ev)?.through&&(e.activePage(ev)?.graphic?.character_name||e.activePage(ev)?.trigger===1));
        if(!block&&!seen.has(`${nx},${ny}`))queue.push([nx,ny]);}}
    return Object.values(e.map.events).filter(ev=>ev.storyKey||[3,17,15,1].includes(ev.id)).map(ev=>({id:ev.id,key:ev.storyKey,x:ev.x,y:ev.y,accessible:dirs.some(([dx,dy])=>seen.has(`${ev.x+dx},${ev.y+dy}`))}));
  });
  console.log('City interaction access:',access);assert(access.every(x=>x.accessible),'A story contact is unreachable');
  // Use the real asynchronous event runner and real dialog object, auto-advancing its UI.
  async function event(map,id,choices=[]) {
    await page.evaluate(({map,id,choices})=>{
      const e=window.testEngine;window.eventDone=false;window.eventError=null;window.choiceQueue=choices;
      e.gameEnded=false;e.gameOver=false;e.terminalState=null;
      window.driver=setInterval(()=>{if(e.dialog?.choices)e.selectChoice(window.choiceQueue.shift()??0);else if(e.dialog)e.advanceDialog();},10);
      (async()=>{if(map!==e.mapId)await e.loadMap(map,10,10,8);const ev=e.map.events[id];await e.runEvent(ev,e.activePage(ev));})().catch(err=>{window.eventError=err.message;}).finally(()=>{clearInterval(window.driver);window.eventDone=true;});
    },{map,id,choices});
    await page.waitForFunction(()=>window.eventDone);assert.equal(await page.evaluate(()=>window.eventError),null);
  }
  await event(3,5); // Original early Za dialogue and item, including its map transfer.
  assert.equal(await page.evaluate(()=>window.testEngine.selfSwitches.get('3:5:A')),true);
  assert.equal(await page.evaluate(()=>window.testEngine.selfSwitches.get('1:5:A')),undefined);
  await event(7,17);assert.equal(await page.evaluate(()=>window.testEngine.expansion.state.vaselineAdvice),undefined);
  await event(7,3);assert.equal(await page.evaluate(()=>window.testEngine.mapId),7);
  await event(7,17);assert.equal(await page.evaluate(()=>window.testEngine.expansion.state.vaselineAdvice),true);
  await event(7,3,[0]);await event(9,1);
  assert.equal(await page.evaluate(()=>window.testEngine.player.characterName),'001-Fighter01');
  await event(10,1,[1]);
  await event(6,101);await event(14,1);
  for(let n=0;n<3;n++) {
    await event(10,2,[n,0]);
    assert.equal(await page.evaluate(()=>window.testEngine.mapId),11+n);
    await page.screenshot({path:path.join(artifacts,`story-ending-${n+1}.png`)});
  }
  // Reload the actual saved third ending, without seeding over its localStorage.
  const stored=await page.evaluate(()=>localStorage.getItem('light-pathfinder-save-v1'));
  await page.addInitScript(saved=>localStorage.setItem('light-pathfinder-save-v1',saved),stored);
  await page.reload();await page.waitForFunction(()=>window.testReady);
  assert.equal(await page.evaluate(()=>window.testEngine.mapId),13);
  assert.equal(await page.evaluate(()=>window.testEngine.expansion.state.unlocked.length),3);
  await event(13,1);assert.equal(await page.evaluate(()=>window.testEngine.terminalState.crash),true);
  await page.evaluate(async()=>{const e=window.testEngine;e.gameEnded=false;await e.loadMap(10,14,6,8);});
  await page.screenshot({path:path.join(artifacts,'story-office.png')});
  // Fresh expansion state: verify the alternative route and its prerequisites.
  await page.evaluate(async()=>{const e=window.testEngine;const {StoryExpansion}=await import('/src/story-expansion.js');delete e.story.expansion;e.expansion=new StoryExpansion(e);e.party.gold=0;});
  await event(7,101,[1]);assert.equal(await page.evaluate(()=>window.testEngine.expansion.has('SWITCH_SPICE_CENSER')),false);
  await event(7,103,[1]);await event(7,101,[0]);
  assert.equal(await page.evaluate(()=>window.testEngine.expansion.has('SWITCH_SPICE_CENSER')),true);
  await event(7,102);await event(7,3);await event(7,3,[1]);assert.equal(await page.evaluate(()=>window.testEngine.mapId),8);
  await event(10,1,[2]);assert.equal(await page.evaluate(()=>window.testEngine.expansion.state.fatherDefeated),true);
  // Exercise the actual lobby touch trigger, then walk out of the office.
  await page.evaluate(async()=>{const e=window.testEngine;await e.loadMap(8,9,11,8);e.inputDirection=0;});
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(100);await page.keyboard.up('ArrowUp');
  await page.evaluate(()=>{const e=window.testEngine;window.introDriver=setInterval(()=>{if(e.dialog&&!e.dialog.choices)e.advanceDialog();if(e.mapId===10)clearInterval(window.introDriver);},20);});
  await page.waitForFunction(()=>window.testEngine.mapId===10&&!window.testEngine.runningEvent);
  await page.evaluate(()=>{const e=window.testEngine;e.player.x=9;e.player.y=12;e.player.direction=2;});
  await page.keyboard.press('Enter');await page.waitForFunction(()=>window.testEngine.mapId===7&&!window.testEngine.runningEvent);
  // Run the actual first boss battle, graphic command and autosave, rather than skipping it.
  await page.evaluate(async()=>{const e=window.testEngine;e.story.bossDefeated=false;e.selfSwitches.delete('9:1:A');e.selfSwitches.delete('9:2:A');e.expansion.flag('SWITCH_HAS_CLOTHES',false);await e.setPlayerGraphic('001-Fighter01');});
  await event(2,3,[1]);
  assert.equal(await page.evaluate(()=>window.testEngine.player.characterName),'gallery_10517_34_1007');
  const bossSave=await page.evaluate(()=>localStorage.getItem('light-pathfinder-save-v1'));
  assert.equal(JSON.parse(bossSave).player.characterName,'gallery_10517_34_1007');
  await page.addInitScript(saved=>localStorage.setItem('light-pathfinder-save-v1',saved),bossSave);
  await page.reload();await page.waitForFunction(()=>window.testReady);
  assert.equal(await page.evaluate(()=>window.testEngine.player.characterName),'gallery_10517_34_1007');
  await event(9,1);assert.equal(await page.evaluate(()=>window.testEngine.player.characterName),'001-Fighter01');
  const motion=await page.evaluate(async()=>{
    const e=window.testEngine,results=[];
    for(const map of [1,3,5,7]) {
      await e.loadMap(map,10,10,2);e.npcMotion.reset();let seed=12;e.npcMotion.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
      const start=new Map(Object.values(e.map.events).map(ev=>[ev.id,[ev.x,ev.y]])),patterns=new Map();
      const base=performance.now();for(let t=0;t<6000;t+=25){e.npcMotion.update(base+t);for(const ev of Object.values(e.map.events)){const p=e.activePage(ev);if(!p)continue;const key=ev.id;const set=patterns.get(key)||new Set();set.add(e.npcMotion.sprite(ev,p,base+t).pattern);patterns.set(key,set);}}
      const events=Object.values(e.map.events),moving=events.filter(ev=>(e.activePage(ev)?.move_type||0)>0),fixed=events.filter(ev=>(e.activePage(ev)?.move_type||0)===0);
      results.push({map,walking:moving.some(ev=>ev.x!==start.get(ev.id)[0]||ev.y!==start.get(ev.id)[1]),animated:moving.some(ev=>patterns.get(ev.id)?.size>1),fixed:fixed.every(ev=>ev.x===start.get(ev.id)[0]&&ev.y===start.get(ev.id)[1])});
      e.draw(base+6000);
    }
    return results;
  });
  assert(motion.every(m=>m.walking&&m.animated&&m.fixed),JSON.stringify(motion));
  console.log('Original NPC movement:',motion);
  assert.deepEqual(errors,[]);console.log('Browser: free route, mother quest, all endings, save reload, journal and assets passed.');
  await browser.close();
  server.close();
})().catch(e=>{console.error(e);process.exit(1);});
