const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

async function occupy(port) {
  const server=http.createServer((req,res)=>res.end('occupied'));
  return new Promise((resolve,reject)=>{
    server.once('error',err=>err.code==='EADDRINUSE'?resolve(null):reject(err));
    server.listen(port,'127.0.0.1',()=>resolve(server));
  });
}
function get(url) {
  return new Promise((resolve,reject)=>{
    http.get(url,res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],body}));}).on('error',reject);
  });
}
for(const variant of ['node','powershell']) {
  test(`${variant} launcher skips occupied ports and serves game and original graphics`,{skip:variant==='powershell'&&process.platform!=='win32',timeout:20000},async()=>{
    const blockers=[];let child;
    try {
      for(const port of [8011,8012]) {const blocker=await occupy(port);if(blocker)blockers.push(blocker);}
      child=spawn(variant==='node'?process.execPath:'powershell.exe',variant==='node'?['start-local.js']:['-NoProfile','-ExecutionPolicy','Bypass','-File','start-local.ps1','-NoBrowser'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
      const url=await new Promise((resolve,reject)=>{
        let output='';const timeout=setTimeout(()=>reject(Error('Launcher produced no URL: '+output)),12000);
        child.once('error',e=>{clearTimeout(timeout);reject(e);});
        child.once('exit',code=>{clearTimeout(timeout);reject(Error(`Launcher exited ${code}: ${output}`));});
        child.stderr.on('data',chunk=>output+=chunk);
        child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);if(match){clearTimeout(timeout);resolve(match[0]);}});
      });
      assert(!url.includes(':8011/'));assert(!url.includes(':8012/'));
      const page=await get(url);assert.equal(page.status,200);assert(page.body.includes('journal-toggle'));
      const image=await get(url+'assets/Graphics/Tilesets/012-PortTown02.png');assert.equal(image.status,200);assert.equal(image.type,'image/png');
      const crash=await get(url+'500.html');assert.equal(crash.status,500);assert(crash.body.includes('href="./"'));
    } finally {
      if(child&&!child.killed){child.kill();await new Promise(resolve=>child.once('close',resolve));}
      await Promise.all(blockers.map(server=>new Promise(resolve=>server.close(resolve))));
    }
  });
}
