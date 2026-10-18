const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..'),artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
  const server=http.createServer((req,res)=>{
    const requested=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(requested==='/500.html'?500:200,{'Content-Type':({'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.png':'image/png','.ogg':'audio/ogg'})[path.extname(file)]||'application/octet-stream'});res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];let crashStatus;
  page.on('pageerror',err=>errors.push(err.message));page.on('response',res=>{if(res.url().endsWith('/500.html'))crashStatus=res.status();else if(res.status()>=400)errors.push(`${res.status()} ${res.url()}`);});
  await page.route('**/src/main.js',route=>route.fulfill({contentType:'text/javascript',body:`import {GameShell} from './game-shell.js';window.shell=new GameShell();`}));
  const url=`http://127.0.0.1:${server.address().port}/`;await page.goto(url);await page.waitForLoadState('networkidle');
  assert(await page.locator('[data-action="load"]').isDisabled());
  await page.screenshot({path:path.join(artifacts,'title-screen.png')});
  await page.setViewportSize({width:390,height:844});
  assert(await page.locator('[data-action="new"]').isVisible());await page.screenshot({path:path.join(artifacts,'title-mobile.png')});
  await page.setViewportSize({width:1000,height:900});
  await page.keyboard.press('Enter');await page.waitForFunction(()=>window.shell.engine&&window.shell.screen.hidden);
  assert.equal(await page.evaluate(()=>window.shell.engine.mapId),1);
  await page.evaluate(()=>{window.shell.engine.party.gold=246;window.shell.engine.saveGame();});
  // Exit through the actual XP-style in-game menu, rather than replacing the page.
  await page.keyboard.press('Escape');for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.shell.screen.dataset.mode==='title'&&!window.shell.screen.hidden);
  await page.locator('[data-action="load"]').click();assert(await page.locator('[data-action="load-slot"]').innerText().then(t=>t.includes('246')));
  await page.locator('[data-action="load-slot"]').click();await page.waitForFunction(()=>window.shell.engine?.party?.gold===246&&window.shell.screen.hidden);
  // A new game must not silently continue or erase the existing save.
  await page.evaluate(()=>window.shell.showTitle());await page.locator('[data-action="new"]').click();
  await page.waitForFunction(()=>window.shell.engine?.party?.gold===0&&window.shell.screen.hidden);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('light-pathfinder-save-v1')).party.gold),246);
  // The moved chest can be reached from the north; the shifted warehouse door works both ways.
  await page.evaluate(async()=>{await window.shell.engine.loadMap(7,31,16,2);});
  assert.deepEqual(await page.evaluate(()=>{const e=window.shell.engine;return [e.map.events[102].x,e.map.events[102].y,e.map.events[15].x,e.map.events[15].y];}),[31,17,34,11]);
  await page.keyboard.press('Enter');
  await page.evaluate(()=>{const e=window.shell.engine;window.chestDriver=setInterval(()=>{if(e.dialog)e.advanceDialog();if(!e.runningEvent)clearInterval(window.chestDriver);},10);});
  await page.waitForFunction(()=>window.shell.engine.expansion.state.herbs&&!window.shell.engine.runningEvent);
  // Walk the whole approach from the normal city arrival, rather than teleporting beside the door.
  await page.evaluate(async()=>{const e=window.shell.engine;await e.loadMap(7,32,0,2);e.npcMotion.random=()=>.99;});
  await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.shell.engine.player.y>=11);
  await page.keyboard.up('ArrowDown');await page.waitForFunction(()=>!window.shell.engine.player.moving);
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.shell.engine.mapId===9);await page.keyboard.up('ArrowRight');
  await page.waitForFunction(()=>window.shell.engine.mapId===9&&!window.shell.engine.runningEvent);
  await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.shell.engine.mapId===7);await page.keyboard.up('ArrowDown');
  await page.waitForFunction(()=>!window.shell.engine.runningEvent);
  assert.deepEqual(await page.evaluate(()=>[window.shell.engine.player.x,window.shell.engine.player.y]),[33,11]);
  // Original dialogue headings are separate and stay visible, including on later pages.
  await page.evaluate(async()=>{await window.shell.engine.loadMap(7,33,3,6);});await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.shell.engine.dialog?.speaker==='За');
  assert(!(await page.evaluate(()=>window.shell.engine.dialog.lines[0])).startsWith('За:'));
  await page.waitForTimeout(50);await page.screenshot({path:path.join(artifacts,'speaker-za.png')});
  await page.evaluate(()=>{const e=window.shell.engine;window.speakerDriver=setInterval(()=>{if(e.dialog)e.advanceDialog();if(!e.runningEvent)clearInterval(window.speakerDriver);},10);});
  await page.waitForFunction(()=>!window.shell.engine.runningEvent);
  await page.evaluate(()=>clearInterval(window.speakerDriver));
  const names=await page.evaluate(async()=>{
    const e=window.shell.engine,{STORY_DIALOGUE}=await import('/src/story-dialogue.js');
    void e.showMessage([STORY_DIALOGUE.scenes.priest[2]]);return {pages:e.dialog.pages.length,speakers:e.dialog.pages.map(p=>p.speaker)};
  });
  assert(names.pages>1&&names.speakers.every(name=>name==='Священик'));
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.shell.engine.dialog.speaker),'Священик');
  await page.waitForTimeout(50);await page.screenshot({path:path.join(artifacts,'speaker-long-dialogue.png')});
  await page.evaluate(()=>{const e=window.shell.engine;while(e.dialog)e.advanceDialog();void e.showChoices(['Так','Ні'],-1);});
  assert.equal(await page.evaluate(()=>window.shell.engine.dialog.speaker),'Лупа');await page.keyboard.press('Enter');
  async function ending(n) {
    await page.evaluate(async n=>{const e=window.shell.engine;e.expansion.state.VAR_ENDING_CHOICE=n;e.expansion.state.endingSeen=false;await e.loadMap(10+n,10,10,8);
      window.endDriver=setInterval(()=>{if(e.dialog?.choices)e.selectChoice(0);else if(e.dialog)e.advanceDialog();if(e.gameEnded)clearInterval(window.endDriver);},10);
      const event=e.map.events[1];void e.runEvent(event,e.activePage(event));
    },n);
    if(n===3)await page.waitForURL('**/500.html');else await page.waitForFunction(()=>window.shell.screen.dataset.mode==='ended');
  }
  await ending(1);assert.equal(await page.locator('#front-screen h1').innerText(),'Гра завершена');
  await page.screenshot({path:path.join(artifacts,'game-completed.png')});
  await page.locator('[data-action="title"]').click();await page.locator('[data-action="new"]').click();await page.waitForFunction(()=>window.shell.screen.hidden);
  await ending(2);assert.equal(await page.locator('#front-screen h1').innerText(),'Гра завершена');
  await page.locator('[data-action="title"]').click();await page.locator('[data-action="new"]').click();await page.waitForFunction(()=>window.shell.screen.hidden);
  await ending(3);assert.equal(crashStatus,500);assert.equal(await page.locator('h1').innerText(),'500');
  await page.screenshot({path:path.join(artifacts,'crash-500.png')});
  await page.getByRole('link',{name:'Перезавантажити гру'}).click();await page.waitForFunction(()=>window.shell?.screen?.dataset.mode==='title');
  assert.equal(await page.locator('#front-screen h1').innerText(),'LIGHT PATHFINDER');
  assert.deepEqual(errors,[]);console.log('Title, keyboard navigation, load/new game, moved chest, warehouse return, both completion screens, HTTP 500 and restart passed.');
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1);});
