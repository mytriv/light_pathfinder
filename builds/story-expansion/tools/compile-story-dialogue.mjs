import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const target=new URL('../data/story-expansion-source.txt',import.meta.url);
if(process.argv[2]) writeFileSync(target,readFileSync(process.argv[2]));
const source=readFileSync(target,'utf8'),lines=source.split(/\r?\n/);
// Source line indices are recorded so wording, punctuation and Unicode can be audited.
const scenes={priest:[10,12,14],za:[23,25],guards:[28,31],lobby:[34,36],father:[39,42,44,46],clothes:[51,53],smoke:[55,58],mirrorBefore:[62,64,66,68],mirrorAfter:[71,73,75,77,79,81],ending1:[97,99,101,103,105],ending2:[113,115,117,119,122],ending3:[126,129,131,133]};
const speakers={10:'Священик',12:'Лу́па',14:'Священик',23:'За',25:'Лу́па',28:'Стражник 1',31:'Стражник 1',34:'Лу́па',36:'За',39:'Лу́па',42:'Батя',44:'Лу́па',46:'Батя',51:'Лу́па',53:'Батя',55:'Лу́па',58:'Батя',62:'За',64:'Лу́па',66:'За',68:'За',71:'За',73:'Лу́па',75:'За',77:'Лу́па',79:'За',81:'За',97:'Санітар',99:'Лу́па',101:'Санітар',103:'За',105:'Система',113:'Лу́па',115:'За',117:'Трактирщик',119:'Лу́па',126:'Лу́па',129:'Стражник',131:'Система',133:'Лу́па'};
const script={sourceSha256:createHash('sha256').update(source).digest('hex'),scenes:Object.fromEntries(Object.entries(scenes).map(([key,indices])=>[key,indices.map(line=>({line,speaker:speakers[line]||'',text:lines[line]}))])),choices:{priest:[16,17,18],father:[47,48,49],ending:[91,92,93],save:[107,108,109]}};
for(const key of Object.keys(script.choices))script.choices[key]=script.choices[key].map(line=>({line,text:lines[line].replace(/^(?:\d+\. |- )/,'').replace(/ \((?:Потребує|Активується|Set |Game Over|Гра повертається).*$/,'').replace(/^\[(.*)\]$/,'$1')}));
writeFileSync(new URL('../src/story-dialogue.js',import.meta.url),`// Generated from data/story-expansion-source.txt; do not rewrite dialogue here.\nexport const STORY_DIALOGUE = ${JSON.stringify(script,null,2)};\n`);
console.log(`Compiled ${Object.values(scenes).flat().length} verbatim dialogue lines.`);
