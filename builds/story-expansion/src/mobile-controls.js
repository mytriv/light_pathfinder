// Reuse the keyboard input path so touch follows the same dialogue/menu rules.
export class MobileControls {
  constructor(shell) {
    this.shell=shell;this.root=document.querySelector('#mobile-controls');this.pointers=new Map();
    this.media=matchMedia('(any-pointer: coarse)');
    const detect=()=>{
      const mobile=this.media.matches||navigator.userAgentData?.mobile||(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))||(navigator.maxTouchPoints>1&&/Macintosh/i.test(navigator.userAgent));
      document.documentElement.classList.toggle('touch-game',Boolean(mobile));
      if(!mobile)this.releaseAll();
    };
    detect();this.media.addEventListener('change',detect);
    this.root.addEventListener('contextmenu',event=>event.preventDefault());
    this.root.addEventListener('pointerdown',event=>{
      const button=event.target.closest('[data-key]');
      if(!button||this.shell.busy||!this.shell.screen.hidden||!this.shell.engine||event.button!==0)return;
      event.preventDefault();button.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId,{button,code:button.dataset.key});button.classList.add('pressed');
      this.emit('keydown',button.dataset.key);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.root.addEventListener(type,event=>this.release(event.pointerId));
    window.addEventListener('blur',()=>this.releaseAll());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.releaseAll();});
  }
  emit(type,code) {window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true,cancelable:true}));}
  release(id) {
    const held=this.pointers.get(id);if(!held)return;this.pointers.delete(id);
    if(![...this.pointers.values()].some(value=>value.code===held.code)){
      held.button.classList.remove('pressed');this.emit('keyup',held.code);
    }
  }
  releaseAll() {for(const id of [...this.pointers.keys()])this.release(id);}
}
