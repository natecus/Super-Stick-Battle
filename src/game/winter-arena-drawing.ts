import type { ArenaDefinition } from './arenas';
import type { Platform } from './types';
import { drawPresent } from './winter-drawing';

const FONT = '"Comic Sans MS", "Segoe Print", cursive';
const TAU = Math.PI * 2;
const winter = (arena: ArenaDefinition) => ['snow-fort','living-room','santas-workshop'].includes(arena.id);
function line(ctx: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2); ctx.stroke();
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle=color; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
}
export function drawWinterBackground(ctx: CanvasRenderingContext2D, arena: ArenaDefinition): boolean {
  if (!winter(arena)) return false;
  ctx.save(); ctx.fillStyle=arena.id==='snow-fort'?'#edf4f5':arena.id==='living-room'?'#f5ebdd':'#edf0e4'; ctx.fillRect(0,0,1280,640);
  ctx.strokeStyle='#829ca11c'; ctx.lineWidth=1;
  for(let y=14;y<640;y+=29) line(ctx,0,y,1280,y);
  ctx.strokeStyle='#c18b8b44'; line(ctx,91,0,91,640);
  ctx.fillStyle='#c9c9bb'; for(const y of [140,330,530]) {ctx.beginPath();ctx.arc(30,y,9,0,TAU);ctx.fill();}
  if(arena.id==='snow-fort') {
    ctx.strokeStyle='#adc6cd'; ctx.lineWidth=2;
    for(const [x,y,w,h] of [[145,280,150,250],[990,280,150,250],[490,390,300,150]]) {
      box(ctx,x,y,w,h,'#dcebef');
      for(let yy=y+30;yy<y+h;yy+=30) {line(ctx,x,yy,x+w,yy);for(let xx=x+((yy/30)%2)*35;xx<x+w;xx+=70)line(ctx,xx,yy,xx,yy-30);}
      for(let xx=x;xx<x+w;xx+=50) box(ctx,xx,y-28,30,28,'#edf7fa');
    }
    ctx.strokeStyle='#bdd5dc';
    for(let i=0;i<55;i++) { const x=120+(i*137)%1080,y=120+(i*73)%400; line(ctx,x-2,y,x+2,y);line(ctx,x,y-2,x,y+2); }
    ctx.fillStyle='#8eafbb'; ctx.font=`15px ${FONT}`; ctx.fillText('brake early!',1050,365);
    ctx.strokeStyle='#6f9aab'; line(ctx,640,235,640,165); ctx.fillStyle='#a7cbd7'; ctx.beginPath();ctx.moveTo(640,165);ctx.lineTo(680,178);ctx.lineTo(640,190);ctx.fill();
  } else if(arena.id==='living-room') {
    ctx.strokeStyle='#9a7d65';ctx.lineWidth=4; ctx.strokeRect(150,110,980,414);
    ctx.strokeStyle='#dfcbb4';ctx.lineWidth=1;for(let x=165;x<1130;x+=32)line(ctx,x,115,x,520);
    ctx.strokeStyle='#96725b';ctx.lineWidth=2;
    box(ctx,540,410,200,114,'#c59c83');box(ctx,565,442,150,82,'#4c4642');box(ctx,525,401,230,12,'#99785f');
    for(let y=422;y<514;y+=22) {line(ctx,541,y,564,y);line(ctx,716,y,739,y);}
    for(const x of [330,840]) {box(ctx,x,170,100,75,'#d2b185');box(ctx,x+8,178,84,59,'#e9f0e7');ctx.strokeStyle='#9eaf9c';line(ctx,x+12,230,x+50,192);line(ctx,x+50,192,x+88,230);ctx.strokeStyle='#96725b';}
    for(const x of [580,625,670]) {ctx.fillStyle='#b45e53';ctx.fillRect(x,415,17,25);ctx.fillRect(x-7,433,24,10);ctx.fillStyle='#fff4df';ctx.fillRect(x-1,414,19,5);}
    ctx.font=`15px ${FONT}`;ctx.fillStyle='#a55b43';ctx.textAlign='center';ctx.fillText('200% = a life lost',640,575);
  } else {
    ctx.strokeStyle='#a7ad96';ctx.lineWidth=2;
    for(const x of [250,976]) {box(ctx,x-5,110,64,54,'#d0d6c3');box(ctx,x+7,164,40,26,'#a5b69d');ctx.fillStyle='#4e6550';ctx.font=`13px ${FONT}`;ctx.fillText('GIFTS',x+7,143);}
    for(const x of [140,1080]) {box(ctx,x,235,66,200,'#cfb190');for(let y=267;y<430;y+=55) {line(ctx,x,y,x+66,y);drawPresent(ctx,x+32,y-16,23,y%2?'#668c69':'#bd574d');}}
    ctx.strokeStyle='#769071';line(ctx,250,202,1030,202);
    for(let i=0;i<13;i++){ctx.fillStyle=i%2?'#be6655':'#d7b15d';ctx.beginPath();ctx.arc(270+i*61,208+(i%3)*4,4,0,TAU);ctx.fill();}
    ctx.fillStyle='#6f8566';ctx.font=`16px ${FONT}`;ctx.textAlign='center';ctx.fillText('SPECIAL DELIVERY',640,155);
  }
  ctx.fillStyle=arena.accent;ctx.font=`17px ${FONT}`;ctx.textAlign='center';ctx.fillText(arena.name,640,605);
  ctx.restore();return true;
}

export function drawWinterPlatforms(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, platforms: Platform[], time: number): boolean {
  if(!winter(arena))return false;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=2;ctx.strokeStyle='#596052';
  for(const p of platforms) {
    if(p.solid==='gift') {drawPresent(ctx,p.x+p.width/2,p.y+(p.height??54)/2,p.width,p.x<640?'#bc6454':'#6d9775');continue;}
    if(arena.id==='snow-fort') {
      box(ctx,p.x,p.y,p.width,p.main?38:23,p.ice?'#b9dce6':'#eef5f3');
      ctx.strokeStyle='#779fad';ctx.lineWidth=1;
      for(let x=p.x+20;x<p.x+p.width-10;x+=40)line(ctx,x,p.y+16,x+12,p.y+6);
      ctx.strokeStyle='#f9ffff';ctx.lineWidth=4;line(ctx,p.x+2,p.y+1,p.x+p.width-2,p.y+1);
      ctx.strokeStyle='#596052';ctx.lineWidth=2;
    } else if(arena.id==='living-room') {
      if(p.bounce) {
        box(ctx,p.x,p.y,p.width,89,'#b5a48a');box(ctx,p.x+10,p.y+5,p.width-20,25,'#cbbda5');
        for(const x of [p.x,p.x+p.width-23])box(ctx,x,p.y-10,23,65,'#a5967e');
        ctx.fillStyle='#6b6b59';ctx.font=`13px ${FONT}`;ctx.textAlign='center';ctx.fillText('BOUNCE!',p.x+p.width/2,p.y+57);
      } else {box(ctx,p.x,p.y,p.width,p.main?25:12,'#bd9d78');if(!p.main)for(const x of [p.x+18,p.x+p.width-18])line(ctx,x,p.y+12,x,p.y+25);}
    } else {
      box(ctx,p.x,p.y,p.width,p.conveyor?28:18,p.conveyor?'#91a28b':'#cbb893');
      if(p.conveyor) {
        ctx.fillStyle='#e4e7d3';for(let x=p.x+14;x<p.x+p.width-8;x+=26){ctx.beginPath();ctx.arc(x,p.y+15,7,0,TAU);ctx.fill();ctx.stroke();}
        ctx.strokeStyle='#53684f';const offset=(time*Math.abs(p.conveyor))%28;
        for(let x=p.x+15;x<p.x+p.width-30;x+=28) {const xx=x+(p.conveyor>0?offset:28-offset);line(ctx,xx,p.y+4,xx+Math.sign(p.conveyor)*7,p.y+4);}
      }
    }
  }
  if(arena.fire) {
    const f=arena.fire;
    for(let i=0;i<7;i++) {
      const x=f.x+8+i*20, height=42+Math.sin(time*9+i*2)*12+(i%3)*7;
      ctx.fillStyle=i%2?'#e9ad50':'#cf7045';ctx.strokeStyle='#a55439';
      ctx.beginPath();ctx.moveTo(x-8,f.y);ctx.quadraticCurveTo(x-20,f.y-height/2,x+4,f.y-height);ctx.quadraticCurveTo(x+2,f.y-20,x+12,f.y);ctx.closePath();ctx.fill();ctx.stroke();
    }
  }
  ctx.restore();return true;
}
