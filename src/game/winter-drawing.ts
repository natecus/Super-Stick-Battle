import type { CharacterDefinition, Projectile } from './types';
import type { DrawingPose } from './drawing';

const INK = '#34352f';
const TAU = Math.PI * 2;
function path(ctx: CanvasRenderingContext2D, points: number[][], fill = false) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (fill) { ctx.closePath(); ctx.fill(); } ctx.stroke();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  path(ctx, Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2, d = i % 2 ? r * .45 : r;
    return [x + Math.cos(a) * d, y + Math.sin(a) * d];
  }), true);
}
export function drawPresent(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color = '#bd574d') {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  ctx.fillStyle = color; ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = '#efd281'; ctx.fillRect(-size * .09, -size / 2, size * .18, size); ctx.fillRect(-size / 2, -size * .09, size, size * .18);
  ctx.strokeStyle = '#927d3f';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * size * .16, -size * .6, size * .2, size * .1, side * .6, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

export function drawWinterCharacter(ctx: CanvasRenderingContext2D, c: CharacterDefinition, x: number, y: number, scale: number, a: DrawingPose): boolean {
  const face = c.appearance.face;
  if (!['snowman', 'tree', 'santa'].includes(face)) return false;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale * (a.facing ?? 1), scale);
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  const attack = a.pose === 'attack' || a.pose === 'ultra';
  const bob = Math.sin(a.time * (a.pose === 'run' ? 6 : 2.6)) * (a.pose === 'run' ? 2.5 : 1);
  const reach = attack ? Math.sin((a.progress ?? 0) * Math.PI) * 20 : 0;
  ctx.translate(a.pose === 'hurt' ? -5 : 0, bob);
  if (face === 'tree') {
    ctx.fillStyle = '#9d7955'; ctx.fillRect(-7, -18, 14, 17); ctx.strokeRect(-7, -18, 14, 17);
    ctx.fillStyle = '#80aa79';
    path(ctx, [[0,-106],[-23,-75],[-13,-75],[-32,-48],[-19,-48],[-40,-19],[40,-19],[19,-48],[32,-48],[13,-75],[23,-75]], true);
    ctx.strokeStyle = '#e4d191'; ctx.lineWidth = 2;
    path(ctx, [[-14,-77],[16,-69],[-23,-48],[30,-29]]);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    for (const [dx,dy,color] of [[-16,-61,'#bd574d'],[18,-40,'#dcb45b'],[-23,-31,'#6e8fb3']] as const) {
      ctx.fillStyle = color; circle(ctx, dx, dy, 5);
    }
    ctx.fillStyle = '#efd281'; star(ctx, 0, -108, 10);
    if (attack) {
      if (a.pose === 'ultra') { ctx.fillStyle = '#bd574d'; circle(ctx, 44 + reach, -60, 8); }
      else { ctx.strokeStyle = '#365b35'; for (let i = -1; i <= 1; i++) path(ctx, [[32,-56],[49+reach,-56+i*6]]); }
    }
  } else if (face === 'snowman') {
    ctx.fillStyle = '#f4faf9'; circle(ctx, 0, -24, 24); circle(ctx, 0, -56, 19); circle(ctx, 0, -83, 15);
    ctx.strokeStyle = '#735539'; ctx.lineWidth = 2.4;
    path(ctx, [[-15,-57],[-35,-67],[-41,-78]]); path(ctx, [[-35,-67],[-45,-65]]);
    path(ctx, [[16,-57],[35+reach,-65],[42+reach,-76]]); path(ctx, [[35+reach,-65],[46+reach,-64]]);
    ctx.strokeStyle = INK; ctx.fillStyle = '#3e4447'; ctx.fillRect(-11,-115,22,20); ctx.fillRect(-19,-98,38,5);
    ctx.fillStyle = '#b9534c'; ctx.fillRect(-11,-103,22,5); ctx.fillRect(-16,-72,32,7); ctx.fillRect(7,-69,7,17);
    ctx.fillStyle = '#cf8a45'; path(ctx, [[2,-85],[23,-81],[3,-78]], true);
    ctx.fillStyle = INK; for (const by of [-54,-43,-24]) circle(ctx, 0, by, 2);
    if (attack) { ctx.fillStyle = '#f4faf9'; circle(ctx, 42+reach, -72, 8); }
    if (a.pose === 'ultra') {
      ctx.strokeStyle = '#8ab7c9'; ctx.lineWidth = 1;
      for (let i=0;i<6;i++) { const angle=a.time*3+i*TAU/6; const px=Math.cos(angle)*48, py=-58+Math.sin(angle)*36; path(ctx,[[px-4,py],[px+4,py]]); path(ctx,[[px,py-4],[px,py+4]]); }
    }
  } else {
    const stride = a.pose === 'run' ? Math.sin(a.time) * 17 : 0;
    path(ctx, [[0,-29],[-9,-14],[-16-stride,0]]); path(ctx, [[0,-29],[10,-15],[16+stride,0]]);
    ctx.fillStyle = '#be5b50'; path(ctx, [[-12,-65],[12,-65],[17,-29],[-17,-29]], true);
    ctx.fillStyle = '#f9f4df'; ctx.fillRect(-3,-63,6,33); ctx.fillRect(-16,-34,32,5);
    ctx.fillStyle = INK; ctx.fillRect(-15,-42,30,5); ctx.fillStyle = '#e9c96a'; ctx.fillRect(-3,-43,7,7);
    ctx.fillStyle = '#faf7ed'; circle(ctx,0,-84,17);
    path(ctx,[[-12,-61],[-27,-48],[-33,-57]]); path(ctx,[[12,-61],[28+reach,-51],[36+reach,-62]]);
    ctx.fillStyle = '#faf7ed'; path(ctx,[[-16,-79],[-13,-67],[0,-59],[14,-69],[16,-79],[0,-73]],true);
    ctx.fillStyle = '#be5b50'; path(ctx,[[-18,-98],[-9,-122],[16,-111],[23,-99]],true);
    ctx.fillStyle = '#faf7ed'; ctx.fillRect(-18,-100,35,6); ctx.strokeRect(-18,-100,35,6); circle(ctx,23,-100,5);
    drawPresent(ctx,39+reach,-65,20);
    if (a.pose === 'ultra') { ctx.fillStyle='#efd281'; star(ctx,-33,-82,8); star(ctx,41,-97,7); }
  }
  // Shared expressive eyes and smile retain the original notebook character style.
  const eyeY = face === 'tree' ? -65 : -87;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  for (const dx of [-6,6]) {
    path(ctx,[[dx,eyeY],[dx,eyeY+4]]);
    if (a.pose === 'hurt') path(ctx,[[dx-2,eyeY+1],[dx+2,eyeY+3]]);
  }
  if (face !== 'santa') { ctx.beginPath(); ctx.arc(0,eyeY+7,7,0.2,Math.PI-.2); ctx.stroke(); }
  if (a.color) { ctx.strokeStyle=a.color; ctx.lineWidth=3; path(ctx,[[-7,-18],[7,-18]]); }
  ctx.restore(); return true;
}

export function drawWinterProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number): boolean {
  if (!['snowball','needle','ornament','present'].includes(p.kind)) return false;
  ctx.save(); ctx.translate(p.x,p.y); ctx.lineWidth=1.8; ctx.strokeStyle=INK;
  if (p.kind === 'present') { ctx.rotate(time*5); drawPresent(ctx,0,0,p.radius*1.6); }
  else if (p.kind === 'snowball') {
    ctx.fillStyle='#f5fcff'; ctx.strokeStyle='#648fa4'; circle(ctx,0,0,p.radius);
    ctx.strokeStyle='#bddee8'; path(ctx,[[-p.radius*.4,-3],[-2,-p.radius*.5],[4,-p.radius*.4]]);
    path(ctx,[[-Math.sign(p.vx)*20,0],[-Math.sign(p.vx)*34,2]]);
  } else if (p.kind === 'needle' && !p.variant) {
    ctx.rotate(Math.atan2(p.vy,p.vx)); ctx.strokeStyle='#366540';
    for (let i=-1;i<=1;i++) path(ctx,[[-16,i*4],[13,0]]);
  } else {
    ctx.rotate(time*6); ctx.fillStyle=p.variant===1?'#e8c56d':p.variant===2?'#9ea3ca':'#c56556';
    if (p.variant===1) star(ctx,0,0,p.radius);
    else if (p.variant===2) { ctx.beginPath(); ctx.arc(0,0,p.radius,.7,TAU-.7); ctx.quadraticCurveTo(-p.radius*.5,0,p.radius*Math.cos(.7),p.radius*Math.sin(.7)); ctx.fill(); ctx.stroke(); }
    else { circle(ctx,0,0,p.radius); ctx.fillStyle='#e8c56d'; ctx.fillRect(-3,-p.radius-4,6,4); }
  }
  ctx.restore(); return true;
}
