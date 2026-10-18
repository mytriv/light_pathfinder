const DIRS={2:[0,1],4:[-1,0],6:[1,0],8:[0,-1]},OPPOSITE={2:8,4:6,6:4,8:2};
// XP's original Game_Character runs at 40 updates/second with these page settings.
export class NpcMotion {
  constructor(engine,random=Math.random) {this.e=engine;this.random=random;this.states=new Map();}
  reset() {this.states.clear();}
  state(event,page,now) {
    let s=this.states.get(event.id);
    if(!s||s.page!==page) {
      s={page,direction:page.graphic?.direction||2,pattern:page.graphic?.pattern??0,moving:null,routeIndex:0,routeDone:false,stopFrames:0,animeCount:0,lastTime:now,waitUntil:0};
      this.states.set(event.id,s);
    }
    return s;
  }
  occupies(event,x,y) {
    const motion=this.states.get(event.id)?.moving;
    return event.x===x&&event.y===y||Boolean(motion&&motion.from.x===x&&motion.from.y===y);
  }
  canMove(event,page,x,y,direction) {
    const e=this.e,[dx,dy]=DIRS[direction],nx=x+dx,ny=y+dy;
    if(nx<0||ny<0||nx>=e.map.width||ny>=e.map.height)return false;
    if(page.through)return true;
    if(!e.isPassable(x,y,direction)||!e.isPassable(nx,ny,OPPOSITE[direction]))return false;
    const p=e.player;
    if(p.x===nx&&p.y===ny||p.moving?.from.x===nx&&p.moving?.from.y===ny)return false;
    return !Object.values(e.map.events).some(other=>{
      if(other===event)return false;
      const p=e.activePage(other),g=p?.graphic;
      return p&&!p.through&&(g?.character_name||g?.tile_id)&&this.occupies(other,nx,ny);
    });
  }
  move(event,page,s,direction,now,turn=true) {
    if(turn&&!page.direction_fix)s.direction=direction;
    if(!this.canMove(event,page,event.x,event.y,direction))return false;
    const [dx,dy]=DIRS[direction],from={x:event.x,y:event.y},to={x:event.x+dx,y:event.y+dy};
    s.moving={from,to,start:now,duration:Math.pow(2,7-(page.move_speed??3))*25};
    event.x=to.x;event.y=to.y;s.stopFrames=0;return true;
  }
  randomDirection() {return [2,4,6,8][Math.floor(this.random()*4)];}
  toward(event,page,s,now,away=false) {
    const dx=this.e.player.x-event.x,dy=this.e.player.y-event.y;
    const horizontal=dx>0?6:4,vertical=dy>0?2:8;
    const directions=Math.abs(dx)>Math.abs(dy)?[...(dx?[horizontal]:[]),...(dy?[vertical]:[])]:[...(dy?[vertical]:[]),...(dx?[horizontal]:[])];
    return directions.some(d=>this.move(event,page,s,away?OPPOSITE[d]:d,now));
  }
  route(event,page,s,now) {
    const route=page.move_route,list=route?.list||[];
    if(s.routeDone||!list.length)return;
    const command=list[s.routeIndex]||{code:0},code=command.code;
    if(code===0) {if(route.repeat)s.routeIndex=0;else s.routeDone=true;s.stopFrames=0;return;}
    let moved=true;
    if(code>=1&&code<=4)moved=this.move(event,page,s,[2,4,6,8][code-1],now);
    else if(code===9)moved=this.move(event,page,s,this.randomDirection(),now);
    else if(code===10||code===11)moved=this.toward(event,page,s,now,code===11);
    else if(code===12||code===13)moved=this.move(event,page,s,code===12?s.direction:OPPOSITE[s.direction],now,code===12);
    else if(code===15)s.waitUntil=now+Number(command.parameters?.[0]||0)*50;
    else if(code>=16&&code<=19&&!page.direction_fix)s.direction=[2,4,6,8][code-16];
    if(moved||route.skippable)s.routeIndex++;
    if(!s.moving)s.stopFrames=0;
  }
  update(now) {
    const e=this.e;
    if(e.mapLoading||e.menu||e.battle||e.gameOver||e.gameEnded) {
      for(const s of this.states.values()){if(s.moving)s.moving.start+=Math.max(0,now-s.lastTime);s.lastTime=now;}
      return;
    }
    for(const event of Object.values(e.map.events||{})) {
      const page=e.activePage(event);if(!page)continue;
      const s=this.state(event,page,now),frames=Math.min(10,Math.max(0,now-s.lastTime)/25),wasMoving=Boolean(s.moving);
      s.lastTime=now;
      if(wasMoving&&now-s.moving.start>=s.moving.duration)s.moving=null;
      const originalPattern=page.graphic?.pattern??0;
      if(wasMoving&&page.walk_anime||page.step_anime)s.animeCount+=frames*(wasMoving&&page.walk_anime?1.5:1);
      else if(s.pattern!==originalPattern)s.animeCount+=frames*1.5;
      if(s.animeCount>18-(page.move_speed??3)*2) {
        s.pattern=!page.step_anime&&!s.moving?originalPattern:(s.pattern+1)%4;s.animeCount=0;
      }
      if(s.moving||e.currentEvent===event||now<s.waitUntil)continue;
      const type=page.move_type||0;if(!type)continue;
      s.stopFrames+=frames;
      const frequency=page.move_frequency??3;
      if(s.stopFrames<=(40-frequency*2)*(6-frequency))continue;
      if(type===3){this.route(event,page,s,now);continue;}
      const roll=Math.floor(this.random()*6);
      if(type===1) {
        if(roll===5)s.stopFrames=0;
        else this.move(event,page,s,roll===4?s.direction:this.randomDirection(),now);
      } else if(type===2) {
        if(roll<4)this.toward(event,page,s,now);
        else this.move(event,page,s,roll===4?this.randomDirection():s.direction,now);
      }
    }
  }
  sprite(event,page,now) {
    const s=this.state(event,page,now),m=s.moving,t=m?Math.max(0,Math.min(1,(now-m.start)/m.duration)):1;
    return {x:m?m.from.x+(m.to.x-m.from.x)*t:event.x,y:m?m.from.y+(m.to.y-m.from.y)*t:event.y,direction:s.direction,pattern:s.pattern};
  }
}
