import {EN_ORIGINAL} from './en-original.js';
import {EN_STORY} from './en-story.js';
import {EN_UI,UK_UI} from './en-ui.js';

export const LANGUAGE_KEY='light-pathfinder-language';
export const messageKey=text=>String(text??'').replace(/\s+/g,' ').trim();
const normalized=dictionary=>Object.fromEntries(Object.entries(dictionary).map(([key,value])=>[messageKey(key),value]));
export const EN=normalized({...EN_ORIGINAL,...EN_STORY,...EN_UI});
const UK=normalized(UK_UI);
let language='uk';try {if(localStorage.getItem(LANGUAGE_KEY)==='en')language='en';}catch{}
export const getLanguage=()=>language;
export function setLanguage(next) {
  if(!['uk','en'].includes(next))return;
  const changed=language!==next;language=next;
  try{localStorage.setItem(LANGUAGE_KEY,next);}catch{}
  if(changed&&typeof window!=='undefined')window.dispatchEvent(new Event('pathfinder-languagechange'));
}
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const numeric=new Set(['number','current','max','level','map','gold','count','cost','sanity','endings','id']);
function patterns(dictionary) {
  return Object.entries(dictionary).filter(([key])=>key.includes('{')).map(([key,value])=>{
    const names=[];let last=0,pattern='';
    for(const match of key.matchAll(/\{(\w+)\}/g)){pattern+=escape(key.slice(last,match.index));names.push(match[1]);pattern+=numeric.has(match[1])?'([+-]?\\d+(?:[.,]\\d+)?)':'(.+?)';last=match.index+match[0].length;}
    return {regex:new RegExp('^'+pattern+escape(key.slice(last))+'$'),names,value,weight:key.replace(/\{\w+\}/g,'').length};
  }).sort((a,b)=>b.weight-a.weight);
}
const formats={en:patterns(EN),uk:patterns(UK)};
function interpolate(text,params) {return text.replace(/\{(\w+)\}/g,(match,key)=>key in params?tr(String(params[key])):match);}
export function tr(source,params) {
  const raw=String(source??''),key=messageKey(raw),dictionary=language==='en'?EN:UK;
  const exact=dictionary[key];
  if(params)return interpolate(exact??raw,params);
  if(exact!==undefined)return exact;
  for(const format of formats[language]) {
    const match=key.match(format.regex);if(!match)continue;
    return interpolate(format.value,Object.fromEntries(format.names.map((name,i)=>[name,match[i+1]])));
  }
  return raw;
}
export function applyTranslations(root=document) {
  root.documentElement?.setAttribute('lang',language);
  for(const element of root.querySelectorAll('[data-i18n]'))element.textContent=tr(element.dataset.i18n);
  for(const element of root.querySelectorAll('[data-i18n-aria]'))element.setAttribute('aria-label',tr(element.dataset.i18nAria));
  if(root.title!==undefined)root.title=tr('Light Pathfinder — За дзеркалом');
}
export function mapLabel(id,native) {
  const names={1:"Batya's Yard",2:"Batya's House",3:"Batya's Yard — Aftermath",4:'Orgy House',5:'Kidhaus',6:'Tavern',7:'Slutville',8:'Brothel',9:'Warehouse'};
  return language==='en'?(names[id]||tr(native)):native;
}
const ORIGINAL_FILL=Symbol('originalFillText');
export function localizeCanvas(ctx) {
  const original=ctx[ORIGINAL_FILL]||ctx.fillText.bind(ctx);ctx[ORIGINAL_FILL]=original;
  ctx.fillText=(text,...args)=>original(tr(text),...args);return ctx;
}
