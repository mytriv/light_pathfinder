// Tile IDs reference the unmodified original 012-PortTown02.png XP tileset.
export function buildStoryRoom(id) {
  const names={10:'Кабінет дирекції',11:'Фінал I · Біла кімната',12:'Фінал II · Король Шлюхвілля',13:'Фінал III · За межами скрипту',14:'Винний погріб'};
  if(!names[id]) return null;
  const width=20,height=15,data=Array(width*height*3).fill(0),blocked=[];
  const tile=(x,y,z,value)=>{data[z*width*height+y*width+x]=value;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    tile(x,y,0,id===11?394:389);
    if(y<3)tile(x,y,0,y===2?409:401);
    if(x===0)tile(x,y,0,408);
    if(x===19)tile(x,y,0,410);
    if(y===14)tile(x,y,0,409);
  }
  tile(9,14,0,389);tile(10,14,0,389);
  const prop=(x,y,rows,solid=true)=>{
    rows.forEach((row,dy)=>row.forEach((value,dx)=>{
      if(!value)return;tile(x+dx,y+dy,1,value);
      if(solid)blocked.push([x+dx,y+dy]);
    }));
  };
  const shelf=(x,y)=>prop(x,y,[[448,449],[456,457],[464,465]]);
  const cupboard=(x,y)=>prop(x,y,[[450,451],[458,459],[466,467]]);
  const plant=(x,y)=>prop(x,y,[[446],[454]]);
  const window=(x)=>prop(x,1,[[422],[430]],false);
  if(id===10) {
    shelf(2,3);shelf(4,3);cupboard(16,8);window(8);window(11);
    prop(8,5,[[440,441]]);prop(10,5,[[443]]);prop(9,4,[[438]]);
    prop(15,4,[[462],[470]]);plant(2,10);plant(17,3);
    prop(5,9,[[513,514,515],[521,522,523]]);
    prop(16,6,[[539],[547]]); // Original dress mannequin by the mirror.
  }
  if(id===11) {
    prop(9,4,[[447],[455],[463],[471]]);window(7);window(12);
    prop(14,4,[[452,453],[460,461],[468,469]]);prop(14,3,[[443]]);
  }
  if(id===12) {
    prop(9,3,[[407],[415]]);window(3);window(16);
    for(const [x,y]of [[5,6],[6,7],[8,5],[11,5],[12,6],[14,9]])prop(x,y,[[478,479],[486,487]]);
    prop(3,10,[[472,473]]);prop(15,4,[[476],[484]]);
    prop(3,4,[[535]]);prop(4,4,[[534]]);
  }
  if(id===14) {
    for(const x of [2,5,14,17]) {cupboard(x,3);prop(x,3,[[535,535]]);}
    for(const [x,y]of [[2,8],[5,9],[15,8]])prop(x,y,[[476,477],[484,485]]);
    prop(9,12,[[499,500,501],[507,508,509]],false);
  }
  if(id===13) {
    for(let n=0;n<25;n++)tile(1+(n*7)%18,3+(n*5)%11,0,[389,394,386,397][n%4]);
    prop(4,5,[[478,479],[486,487]]);prop(15,8,[[462],[470]]);
  }
  return {width,height,tileset_id:12,expansionName:names[id],blocked,data:{_class:'Table',dim:3,xsize:width,ysize:height,zsize:3,data}};
}
