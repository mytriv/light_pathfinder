const LABEL=/^([\p{L}\p{M}\d][\p{L}\p{M}\d '’(),-]{0,48}):[ \t]*([\s\S]*)$/u;

// A speaker is metadata, never one of the rows that can scroll out of the window.
export function dialogueEntries(lines,defaultSpeaker='Система') {
  const entries=[];let speaker=defaultSpeaker,continuation=null;
  for(const line of lines) {
    if(line&&typeof line==='object') {
      speaker=line.speaker||defaultSpeaker;
      entries.push({speaker,text:String(line.text??'')});continuation=null;continue;
    }
    const text=String(line??''),match=text.match(LABEL);
    if(match) {
      speaker=match[1].trim();continuation=null;
      if(match[2])entries.push({speaker,text:match[2]});
      else {continuation={speaker,text:''};entries.push(continuation);}
    } else if(continuation) continuation.text+=(continuation.text?'\n':'')+text;
    else entries.push({speaker:defaultSpeaker,text});
  }
  return entries.length?entries:[{speaker,text:''}];
}

export function dialoguePages(lines,wrap,defaultSpeaker='Система',rowCount=3) {
  return dialogueEntries(lines,defaultSpeaker).flatMap(({speaker,text})=>{
    const rows=wrap(text),pages=[];
    for(let i=0;i<rows.length;i+=rowCount)pages.push({speaker,text:rows.slice(i,i+rowCount).join('\n')});
    return pages.length?pages:[{speaker,text:''}];
  });
}

export function originalEventSpeaker(mapId,event,page) {
  const id=event.id,name=page.graphic?.character_name||'';
  if(name==='018-Thief03')return 'За';
  if(mapId===2&&id===3)return 'Батя';
  if(mapId===6&&id===1)return 'Трактирщик';
  if(mapId===7&&id>=5&&id<=10||name.startsWith('049-Soldier'))return 'Стражник';
  if(name.startsWith('071-Bird'))return 'Півень';
  if(name.startsWith('125-Baby'))return 'Дитина';
  if(name==='026-Cleric02')return 'Священик';
  if(name==='129-Noble04')return 'Торговець';
  if(name==='149-Captain01')return 'Капітан';
  if(name==='150-Sailor01')return 'Моряк';
  if(name==='134-Butler01')return 'Дворецький';
  if(mapId===7&&id===4)return 'Табличка';
  if(/^1(?:0\d|1\d|2\d)-|034-Mage|170-Door/.test(name))return 'Місцевий';
  if(mapId===1&&(id===5||id===6)||mapId===6&&id===3||mapId===9)return 'Лупа';
  return 'Система';
}
