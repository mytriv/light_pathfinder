const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
  const root=path.resolve(__dirname,'..'),artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
  const server=http.createServer((req,res)=>{
    const requested=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(requested==='/500.html'?500:200,{'Content-Type':({'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.png':'image/png','.ogg':'audio/ogg'})[path.extname(file)]||'application/octet-stream'});res.end(data);});
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/main.js',route=>route.fulfill({contentType:'text/javascript',body:`import {GameShell} from './game-shell.js';window.shell=new GameShell();`}));
  const url=`http://127.0.0.1:${server.address().port}/`;await page.goto(url);await page.waitForFunction(()=>window.shell);
  assert.equal(await page.locator('[data-action="new"]').innerText(),'Нова гра');
  await page.locator('#game-language').selectOption('en');assert.equal(await page.locator('[data-action="new"]').innerText(),'New game');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.reload();await page.waitForFunction(()=>window.shell);
  assert.equal(await page.locator('#game-language').inputValue(),'en');assert.equal(await page.locator('[data-action="new"]').innerText(),'New game');
  await page.screenshot({path:path.join(artifacts,'english-title.png')});
  await page.locator('[data-action="new"]').click();await page.waitForFunction(()=>window.shell.screen.hidden);
  assert.equal(await page.locator('[data-i18n="Звукові ефекти"]').innerText(),'Sound effects');
  // Switch a real original conversation in place, without completing or replaying it.
  await page.evaluate(async()=>{const e=window.shell.engine;await e.loadMap(7,33,3,6);});await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.shell.engine.dialog?.speaker==='Za');
  assert.match(await page.evaluate(()=>window.shell.engine.dialog.lines.join(' ')),/mum/);
  await page.locator('#game-language').selectOption('uk');assert.equal(await page.evaluate(()=>window.shell.engine.dialog.speaker),'За');
  assert.match(await page.evaluate(()=>window.shell.engine.dialog.lines.join(' ')),/маман/);
  await page.locator('#game-language').selectOption('en');assert.equal(await page.evaluate(()=>window.shell.engine.dialog.speaker),'Za');
  await page.screenshot({path:path.join(artifacts,'english-dialogue.png')});
  await page.evaluate(()=>{const e=window.shell.engine;window.driver=setInterval(()=>{if(e.dialog)e.advanceDialog();if(!e.runningEvent){clearInterval(window.driver);window.driver=null;}},10);});
  await page.waitForFunction(()=>window.driver===null);
  await page.evaluate(async()=>{const e=window.shell.engine,{STORY_DIALOGUE}=await import('/src/story-dialogue.js');void e.showMessage([STORY_DIALOGUE.scenes.priest[2]]);});
  const startIndex=await page.evaluate(()=>window.shell.engine.dialog.index);
  await page.locator('#game-language').selectOption('uk');await page.locator('#game-language').selectOption('en');
  assert.equal(await page.evaluate(()=>window.shell.engine.dialog.pages[window.shell.engine.dialog.index].entryIndex),0);
  assert.equal(await page.evaluate(()=>window.shell.engine.dialog.speaker),'Priest');
  assert.equal(startIndex,0);
  await page.evaluate(()=>{const e=window.shell.engine;while(e.dialog)e.advanceDialog();void e.showChoices(['Викрасти кадило','Віддати філки','Послати священика нахуй'],-1);e.dialog.choiceIndex=2;});
  assert.equal(await page.evaluate(()=>window.shell.engine.dialog.choices[2]),'Tell the priest to fuck off');
  await page.locator('#game-language').selectOption('uk');assert.equal(await page.evaluate(()=>window.shell.engine.dialog.choiceIndex),2);
  assert.equal(await page.evaluate(()=>window.shell.engine.dialog.choices[2]),'Послати священика нахуй');
  await page.locator('#game-language').selectOption('en');await page.evaluate(()=>window.shell.engine.selectChoice(2));
  await page.locator('#journal-toggle').click();const journal=await page.locator('#journal-content').innerText();
  assert.match(journal,/Objective:/);assert(!/[а-яіїєґ]/iu.test(journal));
  // Inspect real Canvas text from the status, inventory and custom item description.
  const canvasText=await page.evaluate(()=>{
    const e=window.shell.engine,text=[],original=e.ctx.fillText;e.ctx.fillText=(value,...args)=>{text.push(value);return original(value,...args);};
    e.inventory.items[1]=1;for(const scene of ['main','status','items','skills','equip']){e.menu={scene,index:0};e.drawMenu(e.ctx);}e.menu=null;e.ctx.fillText=original;return text;
  });
  // Recorded source calls can contain Ukrainian; the rendered wrapper must localize every one.
  const untranslated=await page.evaluate(async list=>{const {tr}=await import('/src/i18n.js');return list.map(text=>tr(text)).filter(text=>/[а-яіїєґ]/iu.test(text));},canvasText);
  assert.deepEqual(untranslated,[]);
  await page.evaluate(()=>{const e=window.shell.engine;e.party.gold=321;e.saveGame();window.shell.showTitle();});
  await page.locator('[data-action="load"]').click();assert.match(await page.locator('[data-action="load-slot"]').innerText(),/321 filky/);
  await page.locator('[data-action="load-slot"]').click();await page.waitForFunction(()=>window.shell.screen.hidden&&window.shell.engine?.party?.gold===321);
  assert.equal(await page.locator('#game-language').inputValue(),'en');
  await page.evaluate(async()=>{const e=window.shell.engine;e.expansion.state.VAR_ENDING_CHOICE=2;e.expansion.state.endingSeen=false;await e.loadMap(12,10,10,8);window.endDriver=setInterval(()=>{if(e.dialog?.choices)e.selectChoice(0);else if(e.dialog)e.advanceDialog();if(e.gameEnded)clearInterval(window.endDriver);},10);void e.runEvent(e.map.events[1],e.activePage(e.map.events[1]));});
  await page.waitForFunction(()=>window.shell.screen.dataset.mode==='ended');assert.equal(await page.locator('#front-screen h1').innerText(),'Game completed');
  assert.match(await page.locator('.screen-subtitle').innerText(),/Slutville/);
  await page.goto(url+'500.html');await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.match(await page.locator('body').innerText(),/engine fucked off/);assert.equal(await page.getByRole('link').innerText(),'Restart the game');
  await page.getByRole('link').click();await page.waitForFunction(()=>window.shell);assert.equal(await page.locator('#game-language').inputValue(),'en');
  await page.locator('#game-language').selectOption('uk');assert.equal(await page.locator('[data-action="new"]').innerText(),'Нова гра');
  assert.deepEqual(errors,[]);console.log('English/Ukrainian UI, original dialogue, long-line switch, choices, journal, database, existing saves, endings, crash page and language persistence passed.');
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1);});
