import {PathfinderEngine} from './engine.js';
import {tr,getLanguage,setLanguage,applyTranslations} from './i18n.js';
import {MobileControls} from './mobile-controls.js';

export class GameShell {
  constructor() {
    this.screen=document.querySelector('#front-screen');this.canvas=document.querySelector('#game');
    this.tools=document.querySelector('#play-tools');this.engine=null;this.busy=false;
    this.mobile=new MobileControls(this);
    const language=document.querySelector('#game-language');language.value=getLanguage();
    language.addEventListener('change',()=>setLanguage(language.value));
    window.addEventListener('pathfinder-languagechange',()=>{
      language.value=getLanguage();applyTranslations();
      if(this.engine?.player&&this.engine?.expansion)this.engine.refreshLanguage();
      if(this.screen.dataset.mode==='title'&&!this.screen.hidden)document.querySelector('#map-name').textContent=tr('Головне меню');
    });
    applyTranslations();
    window.addEventListener('keydown',event=>{
      if(event.target?.closest?.('.language-control'))return;
      if(this.screen.hidden||this.busy)return;
      if(!['ArrowUp','ArrowDown','Enter','Space','Escape'].includes(event.code))return;
      event.preventDefault();event.stopImmediatePropagation();
      const buttons=[...this.screen.querySelectorAll('button:not(:disabled)')];
      if(!buttons.length)return;
      const index=Math.max(0,buttons.indexOf(document.activeElement));
      if(event.code==='ArrowUp'||event.code==='ArrowDown')buttons[(index+(event.code==='ArrowUp'?-1:1)+buttons.length)%buttons.length].focus();
      else if(event.code==='Escape')this.showTitle();
      else if(!event.repeat)buttons[index].click();
    });
    this.showTitle();
  }
  readSave() {
    try {const s=JSON.parse(localStorage.getItem('light-pathfinder-save-v1')||'null');return s&&Number.isInteger(s.mapId)&&s.player?s:null;}
    catch{return null;}
  }
  panel(mode,heading,subtitle='') {
    this.mobile.releaseAll();
    this.screen.replaceChildren();this.screen.hidden=false;this.screen.dataset.mode=mode;this.tools.hidden=true;
    const title=document.createElement('h1');title.dataset.i18n=heading;title.textContent=tr(heading);this.screen.append(title);
    const sub=document.createElement('p');sub.className='screen-subtitle';sub.dataset.i18n=subtitle;sub.textContent=tr(subtitle);this.screen.append(sub);
    const panel=document.createElement('div');panel.className='xp-command-window';this.screen.append(panel);
    return panel;
  }
  button(panel,id,text,action,disabled=false) {
    const button=document.createElement('button');button.type='button';button.dataset.action=id;button.dataset.i18n=text;button.textContent=tr(text);button.disabled=disabled;
    button.addEventListener('click',action);panel.append(button);return button;
  }
  showTitle() {
    if(this.busy)return;
    this.engine?.dispose();this.engine=null;
    document.querySelector('#map-name').textContent=tr('Головне меню');
    document.querySelector('#journal').hidden=true;
    document.querySelector('#journal-toggle').setAttribute('aria-expanded','false');
    const saved=this.readSave(),panel=this.panel('title','LIGHT PATHFINDER','За дзеркалом');
    const fresh=this.button(panel,'new','Нова гра',()=>this.launch(false));
    const load=this.button(panel,'load','Завантажити гру',()=>this.showLoad(),!saved);
    this.button(panel,'exit','Вихід',()=>this.showResult({message:'Можна закрити вкладку. Шлюхвілль якось переживе.'}));
    (saved?load:fresh).focus();
  }
  showLoad() {
    const saved=this.readSave(),panel=this.panel('load','Завантажити гру','');
    const summary=saved?`Файл 1 · Лупа · рівень ${saved.party?.level||1}\nМапа ${saved.mapId} · ${saved.party?.gold||0} філок`:'Збережень немає';
    const load=this.button(panel,'load-slot',summary,()=>this.launch(true),!saved);
    const back=this.button(panel,'back','Назад',()=>this.showTitle());(saved?load:back).focus();
  }
  async launch(loadSaved) {
    if(this.busy)return;this.busy=true;
    for(const button of this.screen.querySelectorAll('button'))button.disabled=true;
    try {
      this.engine?.dispose();
      const engine=new PathfinderEngine(this.canvas);this.engine=engine;
      engine.onFinish=state=>this.showResult(state);
      engine.onTitle=()=>this.showTitle();
      await engine.start({loadSaved});
      if(!engine.gameEnded) {this.screen.hidden=true;this.tools.hidden=false;this.canvas.focus();}
    } catch(error) {
      this.engine?.dispose();this.engine=null;
      const panel=this.panel('error','Не вдалося завантажити гру',error.message);
      this.button(panel,'back','Головне меню',()=>this.showTitle());
      console.error(error);
    } finally {this.busy=false;}
  }
  showResult({crash=false,ending=0,message=''}={}) {
    if(crash) {window.location.assign('500.html');return;}
    const names={1:'Біла кімната',2:'Король Шлюхвілля'};
    const panel=this.panel('ended','Гра завершена',message||names[ending]||'');
    const title=this.button(panel,'title','Головне меню',()=>this.showTitle());
    this.button(panel,'load','Завантажити гру',()=>this.showLoad(),!this.readSave());title.focus();
  }
}
