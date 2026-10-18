const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.ogg':'audio/ogg'};
const server = http.createServer((request,response)=>{
  let requested;
  try { requested=decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if(requested==='/') requested='/index.html';
  const file=path.resolve(root,'.'+requested);
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end('Forbidden');return;}
  fs.readFile(file,(error,buffer)=>{
    if(error){response.writeHead(error.code==='ENOENT'?404:500).end(error.code==='ENOENT'?'Not found':'Read error');return;}
    response.writeHead(requested==='/500.html'?500:200,{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'}).end(buffer);
  });
});
let port=8011;
server.on('error',error=>{
  if(error.code==='EADDRINUSE'&&port!==0) {
    port=port<8030?port+1:0;
    server.listen(port,'127.0.0.1');
  } else { process.stderr.write(`Could not start local server: ${error.message}\n`);process.exitCode=1; }
});
server.on('listening',()=>{
  const actualPort=server.address().port;
  if(actualPort!==8011) process.stdout.write(`Port 8011 is busy; using port ${actualPort} instead.\n`);
  process.stdout.write(`Light Pathfinder JS slice: http://127.0.0.1:${actualPort}/\n`);
});
server.listen(port,'127.0.0.1');
