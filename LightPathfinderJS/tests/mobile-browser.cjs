const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    const requested=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.png':'image/png','.ogg':'audio/ogg'})[path.extname(file)]||'application/octet-stream'});res.end(data);});
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  try {
    const url=`http://127.0.0.1:${server.address().port}/`,errors=[];
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/src/main.js',route=>route.fulfill({contentType:'text/javascript',body:`import {GameShell} from './game-shell.js';window.shell=new GameShell();`}));
    await page.goto(url);await page.waitForFunction(()=>window.shell);
    assert(await page.locator('html').evaluate(el=>el.classList.contains('touch-game')));
    assert(!await page.locator('#mobile-controls').isVisible());
    await page.locator('[data-action="new"]').tap();await page.waitForFunction(()=>window.shell.screen.hidden);
    assert(await page.locator('#mobile-controls').isVisible());
    await page.evaluate(async()=>{const e=window.shell.engine;while(e.dialog)e.advanceDialog();e.runningEvent=false;await e.loadMap(7,32,5,2);});
    const client=await context.newCDPSession(page);
    const held=async(code,type)=>{
      const rect=await page.locator(`[data-key="${code}"]`).boundingBox();
      await client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1}]});
    };
    await held('ArrowDown','touchStart');await page.waitForFunction(()=>window.shell.engine.player.y>=7);
    await held('ArrowDown','touchEnd');assert.equal(await page.evaluate(()=>window.shell.engine.inputDirection),0);
    await page.waitForTimeout(250);const stopped=await page.evaluate(()=>window.shell.engine.player.y);
    await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.shell.engine.player.y),stopped);
    await page.evaluate(()=>{void window.shell.engine.showMessage([{speaker:'За',text:'Перша репліка.'},{speaker:'Лупа',text:'Друга репліка.'}]);});
    await page.locator('[data-key="Enter"]').tap();assert.equal(await page.evaluate(()=>window.shell.engine.dialog.index),1);
    await page.locator('[data-key="Enter"]').tap();assert.equal(await page.evaluate(()=>window.shell.engine.dialog),null);
    await page.evaluate(()=>{window.choiceResult=null;window.shell.engine.showChoices(['Так','Ні'],-1).then(value=>window.choiceResult=value);});
    await page.locator('[data-key="ArrowDown"]').tap();await page.locator('[data-key="Enter"]').tap();
    await page.waitForFunction(()=>window.choiceResult===1);
    await page.locator('[data-key="Escape"]').tap();assert.equal(await page.evaluate(()=>window.shell.engine.menu.scene),'main');
    await page.locator('[data-key="Enter"]').tap();assert.equal(await page.evaluate(()=>window.shell.engine.menu.scene),'items');
    await page.locator('[data-key="Escape"]').tap();await page.locator('[data-key="Escape"]').tap();assert.equal(await page.evaluate(()=>window.shell.engine.menu),null);
    await held('ArrowDown','touchStart');await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await page.evaluate(()=>window.shell.engine.inputDirection),0);
    await page.locator('#game-language').selectOption('en');assert.equal(await page.locator('[data-key="Enter"]').innerText(),'Act / Next');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(root,'tests/artifacts/mobile-portrait.png'),fullPage:true});
    await page.setViewportSize({width:844,height:390});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const canvas=await page.locator('#game').boundingBox(),controls=await page.locator('#mobile-controls').boundingBox();
    assert(canvas.x+canvas.width<=controls.x);assert(controls.y+controls.height<=390);
    await page.screenshot({path:path.join(root,'tests/artifacts/mobile-landscape.png'),fullPage:true});
    await page.evaluate(()=>window.shell.showTitle());assert(!await page.locator('#mobile-controls').isVisible());
    const desktop=await browser.newPage({viewport:{width:1000,height:900}});await desktop.goto(url);
    assert(!await desktop.locator('html').evaluate(el=>el.classList.contains('touch-game')));
    assert(!await desktop.locator('#mobile-controls').isVisible());
    assert.deepEqual(errors,[]);
    console.log('Mobile detection, held movement/release/cancel, dialogue, choices, menu/back, localization, portrait/landscape and desktop controls passed.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
