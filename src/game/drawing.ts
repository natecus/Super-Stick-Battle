import { drawWinterCharacter, drawWinterProjectile } from './winter-drawing';
import { HEIGHT, PLATFORMS, PLAYER_COLORS, WIDTH } from './simulation';
import type { CharacterDefinition, Fighter, Platform, Projectile } from './types';

const INK = '#34352f';
const PAPER = '#faf7ed';
type Point = [number, number];
export type Pose = 'idle' | 'run' | 'jump' | 'attack' | 'ultra' | 'hurt' | 'victory';
export interface DrawingPose { pose: Pose; time: number; progress?: number; facing?: number; color?: string }

// Shared vector rig: the same drawing powers roster portraits and in-game animation.
// All coordinates are relative to the feet; art never determines the collision box.
export function drawCharacter(ctx: CanvasRenderingContext2D, character: CharacterDefinition, x: number, y: number, scale: number, animation: DrawingPose) {
  if (drawWinterCharacter(ctx, character, x, y, scale, animation)) return;
  const { pose, time, progress = 0, facing = 1, color } = animation;
  const { appearance } = character;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing * appearance.height, scale * appearance.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = appearance.lineWidth;
  const running = pose === 'run';
  const airborne = pose === 'jump';
  const hurt = pose === 'hurt';
  const attacking = pose === 'attack' || pose === 'ultra';
  const spin = pose === 'ultra' && character.ultra.kind === 'spin';
  const bob = running ? Math.abs(Math.sin(time * 2)) * 3 : Math.sin(time * 2.6) * 1.2;
  const lean = hurt ? -13 : running ? 7 : attacking ? 4 : 0;
  const hip: Point = [lean * 0.3, -29 + bob];
  const shoulder: Point = [lean, -60 + bob];
  const head: Point = [lean + (hurt ? -4 : 0), -82 + bob];

  // A second, faint offset stroke keeps the contours feeling like pencil marks.
  const stroke = (points: Point[], width = appearance.lineWidth, ink = INK) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    line(ctx, points);
    ctx.globalAlpha *= 0.16;
    ctx.lineWidth = 0.8;
    line(ctx, points.map(([px, py], i) => [px + Math.sin(i * 3 + 0.8) * 1.2, py + 1]));
    ctx.globalAlpha /= 0.16;
  };

  const stride = running ? Math.sin(time) * 22 : 0;
  if (airborne) {
    stroke([hip, [-15, -17], [-22, -21]]);
    stroke([hip, [17, -19], [22, -4]]);
  } else if (hurt) {
    stroke([hip, [-17, -10], [-26, -3]]);
    stroke([hip, [13, -21], [25, -16]]);
  } else {
    stroke([hip, [-9 - stride * 0.4, -14 - Math.max(0, stride) * 0.3], [-15 - stride, -1 - Math.max(0, stride) * 0.2]]);
    stroke([hip, [9 + stride * 0.4, -14 + Math.min(0, stride) * 0.3], [16 + stride, -1 + Math.min(0, stride) * 0.2]]);
  }
  stroke([hip, [lean * 0.65, -45 + bob], shoulder, [head[0], head[1] + 15]]);
  if (color) stroke([[-3 + lean * 0.7, -43 + bob], [6 + lean * 0.7, -42 + bob]], 3, color);

  if (appearance.weapon === 'gloves') {
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillRect(lean - 14, -60 + bob, 28, 32); ctx.strokeRect(lean - 14, -60 + bob, 28, 32);
  }
  if (appearance.weapon === 'club' || appearance.weapon === 'gloves') {
    ctx.strokeStyle = '#787361'; ctx.lineWidth = 1.4;
    for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(lean * 0.7 + side * 4, -52 + row * 7 + bob, 4, 3, side * 0.3, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (appearance.face === 'slime') {
    ctx.fillStyle = '#849b4e'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(lean - 10, -60 + bob); ctx.lineTo(lean + 11, -60 + bob); ctx.lineTo(lean * 0.3 + 9, -31 + bob); ctx.lineTo(lean * 0.3 - 9, -31 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    line(ctx, [[lean - 7, -53 + bob], [lean + 7, -37 + bob]], 1.5);
    line(ctx, [[lean + 7, -53 + bob], [lean - 7, -37 + bob]], 1.5);
  }
  if (appearance.face === 'robot') {
    ctx.fillStyle = '#c5cece'; ctx.strokeStyle = INK; ctx.lineWidth = 1.7;
    ctx.fillRect(lean - 10, -58 + bob, 20, 25); ctx.strokeRect(lean - 10, -58 + bob, 20, 25);
    ctx.fillStyle = appearance.accent; ctx.fillRect(lean - 5, -53 + bob, 10, 5);
    for (const dx of [-15 - stride, 16 + stride]) {
      ctx.fillStyle = '#9caeaf'; ctx.fillRect(dx - 6, -5, 12, 7); ctx.strokeRect(dx - 6, -5, 12, 7);
    }
  }

  ctx.fillStyle = appearance.face === 'slime' ? '#b2d66b' : appearance.face === 'cheese' ? '#f2ce64' : appearance.face === 'robot' ? '#d1dbd9' : PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = appearance.lineWidth - 0.3;
  ctx.beginPath();
  if (appearance.face === 'cheese') {
    const r = appearance.headRadius;
    ctx.moveTo(head[0] - r, head[1] + r * 0.8); ctx.lineTo(head[0] - r, head[1] - r * 0.55);
    ctx.lineTo(head[0] + r * 0.4, head[1] - r); ctx.lineTo(head[0] + r, head[1] - r * 0.45);
    ctx.lineTo(head[0] + r, head[1] + r * 0.8); ctx.closePath();
  } else ctx.ellipse(head[0], head[1], appearance.headRadius * 0.93, appearance.headRadius, -0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.2;
  ctx.beginPath();
  ctx.ellipse(head[0] + 0.8, head[1] - 0.4, appearance.headRadius * 0.97, appearance.headRadius + 0.5, 0.1, 0, Math.PI * 2);
  if (appearance.face !== 'cheese') ctx.stroke();
  ctx.globalAlpha /= 0.2;

  ctx.lineWidth = 1.8;
  if (hurt) {
    for (const dx of [-6, 6]) {
      line(ctx, [[head[0] + dx - 2, head[1] - 6], [head[0] + dx + 2, head[1] - 1]]);
      line(ctx, [[head[0] + dx + 2, head[1] - 6], [head[0] + dx - 2, head[1] - 1]]);
    }
  } else if (appearance.face === 'grin' || appearance.face === 'slime') {
    for (const dx of [-7, 7]) {
      ctx.beginPath(); ctx.ellipse(head[0] + dx, head[1] - 4, 5, 6, 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(head[0] + dx + 1, head[1] - 3, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    line(ctx, [[head[0] - 6, head[1] - 7], [head[0] - 6, head[1] - 1]]);
    line(ctx, [[head[0] + 6, head[1] - 7], [head[0] + 6, head[1] - 1]]);
  }
  if (appearance.face === 'angry') {
    line(ctx, [[head[0] - 12, head[1] - 12], [head[0] - 3, head[1] - 8]], 2);
    line(ctx, [[head[0] + 12, head[1] - 12], [head[0] + 3, head[1] - 8]], 2);
  }
  if (appearance.face === 'slime') {
    ctx.fillStyle = '#edc359'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(head[0] - 13, head[1] - 15); ctx.lineTo(head[0] - 16, head[1] - 29); ctx.lineTo(head[0] - 6, head[1] - 23); ctx.lineTo(head[0], head[1] - 35); ctx.lineTo(head[0] + 6, head[1] - 23); ctx.lineTo(head[0] + 16, head[1] - 29); ctx.lineTo(head[0] + 13, head[1] - 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7b5aaa'; ctx.beginPath(); ctx.arc(head[0], head[1] - 22, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(head[0] - 8, head[1] + 4);
  ctx.quadraticCurveTo(head[0], head[1] + (hurt || appearance.face === 'angry' ? -3 : 17), head[0] + 9, head[1] + 3);
  if ((appearance.face === 'grin' || appearance.face === 'slime') && !hurt) {
    ctx.lineTo(head[0] - 8, head[1] + 4); ctx.stroke();
    for (const dx of [-4, 0, 4]) line(ctx, [[head[0] + dx, head[1] + 4], [head[0] + dx + 0.5, head[1] + 10]]);
  } else ctx.stroke();

  if (appearance.face === 'cheese') {
    ctx.fillStyle = '#c39432'; ctx.strokeStyle = '#a77f2e'; ctx.lineWidth = 1;
    for (const [dx, dy, r] of [[-14, -9, 3], [13, -11, 4], [-13, 8, 2.5], [13, 11, 3]]) {
      ctx.beginPath(); ctx.arc(head[0] + dx, head[1] + dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    line(ctx, [[head[0] - 19, head[1] - 10], [head[0] + 19, head[1] - 9]], 1);
  } else if (appearance.face === 'robot') {
    ctx.strokeStyle = INK; ctx.fillStyle = '#70c5d2'; ctx.lineWidth = 1.5;
    for (const dx of [-9, 5]) { ctx.fillRect(head[0] + dx, head[1] - 9, 5, 9); ctx.strokeRect(head[0] + dx, head[1] - 9, 5, 9); }
    for (const dx of [-15, 15]) { ctx.beginPath(); ctx.arc(head[0] + dx, head[1] + 1, 2, 0, Math.PI * 2); ctx.stroke(); }
    line(ctx, [[head[0], head[1] - 19], [head[0] + 3, head[1] - 27]], 1.5);
    ctx.beginPath(); ctx.arc(head[0] + 3, head[1] - 29, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (appearance.face === 'ninja') {
    ctx.fillStyle = '#4a4659'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(head[0], head[1], appearance.headRadius * 0.96, appearance.headRadius, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAPER; ctx.fillRect(head[0] - 12, head[1] - 7, 25, 8);
    line(ctx, [[head[0] - 9, head[1] - 5], [head[0] - 3, head[1] - 2]], 2);
    line(ctx, [[head[0] + 10, head[1] - 5], [head[0] + 4, head[1] - 2]], 2);
    ctx.strokeStyle = appearance.accent;
    line(ctx, [[head[0] - 15, head[1]], [head[0] - 28, head[1] + 3 + Math.sin(time * 5) * 3], [head[0] - 36, head[1] - 3]], 4);
    line(ctx, [[head[0] - 15, head[1] + 2], [head[0] - 23, head[1] + 14]], 3);
  }

  let hand: Point = [32 + lean, -53 + bob];
  let backHand: Point = [-24 + lean, -47 + bob];
  if (running) backHand = [-20 + lean, -48 + bob - Math.sin(time) * 10];
  if (airborne) backHand = [-26, -66];
  if (pose === 'victory') { hand = [27, -90]; backHand = [-26, -89]; }
  if (hurt) { hand = [23, -69]; backHand = [-32, -64]; }
  if (attacking && appearance.weapon === 'bow') {
    hand = [37, -57 + bob]; backHand = [-13 + progress * 20, -57];
  }
  if (attacking && appearance.weapon === 'sword') {
    const angle = spin ? progress * Math.PI * 8 : -1.3 + Math.min(1, progress * 1.8) * 2.6;
    hand = [lean + Math.cos(angle) * 34, -54 + Math.sin(angle) * 26];
  }
  if (attacking && appearance.weapon === 'club') {
    const swing = Math.max(0, (progress - 0.35) / 0.65);
    hand = [14 + Math.sin(swing * Math.PI / 2) * 28, -84 + swing * 58];
  }
  if (attacking && appearance.weapon === 'boomerang') hand = [15 + Math.sin(progress * Math.PI) * 33, -60 - Math.cos(progress * Math.PI) * 12];
  if (attacking && appearance.face === 'cheese') hand = pose === 'ultra' ? [14, -76] : [20 + Math.sin(progress * Math.PI) * 30, -58];
  if (appearance.weapon === 'blaster') hand = [34 + lean, -58 + bob];
  if (appearance.weapon === 'gloves') {
    hand = [27 + lean + (attacking ? Math.sin(progress * Math.PI) * 43 : 0), -61 + bob];
    backHand = [-25 + lean, -63 + bob];
    if (pose === 'victory') { hand = [28, -103]; backHand = [-28, -103]; }
  }
  if (attacking && appearance.weapon === 'claws') {
    hand = pose === 'ultra' ? [28, -86] : [24 + Math.sin(progress * Math.PI) * 27, -60];
    backHand = pose === 'ultra' ? [-28, -86] : [-28, -58];
  }
  stroke([shoulder, [(shoulder[0] + backHand[0]) * 0.5, backHand[1] + 7], backHand]);
  stroke([shoulder, [hand[0] * 0.5 + lean * 0.5, -49 + bob], hand]);
  if (appearance.weapon === 'gloves') {
    drawGlove(ctx, hand[0], hand[1], 1, appearance.accent);
    drawGlove(ctx, backHand[0], backHand[1], 0.9, appearance.accent);
  }

  if (appearance.weapon === 'boomerang') drawBoomerang(ctx, backHand[0], backHand[1] - 5, -0.8, 0.5, appearance.accent);
  if (appearance.weapon === 'claws') {
    ctx.strokeStyle = '#775898'; ctx.lineWidth = 2;
    for (const palm of [hand, backHand]) for (let finger = 0; finger < 3; finger++) {
      ctx.beginPath(); ctx.moveTo(palm[0] - 2 + finger * 4, palm[1]);
      ctx.quadraticCurveTo(palm[0] + 14 + finger * 3, palm[1] - 12, palm[0] + 8 + finger * 4, palm[1] - 19); ctx.stroke();
    }
    if (pose === 'ultra' && progress < 0.6) {
      ctx.fillStyle = '#92b650'; ctx.strokeStyle = '#4c6428';
      ctx.beginPath(); ctx.arc(0, -107, 7 + progress * 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(...hand);
  if (appearance.face === 'cheese') {
    ctx.fillStyle = '#e9be4c'; ctx.strokeStyle = '#917334'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(8, -10); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(5, -2, 1.7, 0, Math.PI * 2); ctx.stroke();
  } else if (appearance.weapon === 'blaster') {
    ctx.fillStyle = '#84999c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillRect(-9, -7, 29, 14); ctx.strokeRect(-9, -7, 29, 14);
    ctx.fillStyle = '#73cad7'; ctx.fillRect(20, -4, 8, 8); ctx.strokeRect(20, -4, 8, 8);
    if (attacking) { ctx.strokeStyle = appearance.accent; line(ctx, [[32, -4], [43, -7]], 2); line(ctx, [[32, 4], [43, 7]], 2); }
  } else if (appearance.weapon === 'sword') {
    const angle = spin ? progress * Math.PI * 8 : attacking ? -0.6 + Math.min(1, progress * 1.8) * 2.3 : running ? 0.3 : 0.13;
    ctx.rotate(angle);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.fillStyle = '#e9e7dc';
    ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-4, -42); ctx.lineTo(0, -51); ctx.lineTo(4, -42); ctx.lineTo(4, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    line(ctx, [[0, -12], [0, -40]], 1);
    ctx.fillStyle = appearance.accent;
    ctx.fillRect(-2, -8, 4, 14);
    ctx.strokeRect(-7, -10, 14, 4);
    line(ctx, [[0, -5], [0, 6]], 3);
  } else if (appearance.weapon === 'club') {
    ctx.rotate(attacking ? -0.7 + Math.max(0, progress - 0.35) * 3.8 : 0.18);
    ctx.fillStyle = '#b79a70'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-5, -14); ctx.bezierCurveTo(-19, -25, -14, -52, 0, -53); ctx.bezierCurveTo(17, -53, 18, -25, 5, -13); ctx.lineTo(3, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7b6347'; line(ctx, [[-5, -24], [-7, -39]], 1.2); line(ctx, [[4, -18], [6, -44]], 1);
  } else if (appearance.weapon === 'boomerang') {
    drawBoomerang(ctx, 2, -5, attacking ? progress * 4 : -0.6, 0.65, appearance.accent);
  } else if (appearance.weapon === 'bow') {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.7;
    ctx.beginPath(); ctx.moveTo(0, -25); ctx.quadraticCurveTo(30, 0, 0, 26); ctx.stroke();
    ctx.strokeStyle = appearance.accent; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, -21); ctx.quadraticCurveTo(24, 0, 2, 22); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
    const pull = attacking ? -14 * Math.sin(progress * Math.PI) : -3;
    line(ctx, [[0, -25], [pull, 0], [0, 26]]);
    drawArrow(ctx, -8, 0, 0, 0.8);
  } else if (appearance.weapon === 'staff') {
    ctx.rotate(attacking ? 0.4 : -0.08);
    ctx.strokeStyle = INK;
    line(ctx, [[0, 46], [1, -28]], 4);
    line(ctx, [[-4, 45], [0, 35], [5, 48]], 1.7);
    ctx.beginPath(); ctx.moveTo(-9, -48); ctx.bezierCurveTo(-24, -25, 21, -18, 12, -48); ctx.bezierCurveTo(8, -36, -5, -34, -9, -48); ctx.stroke();
    ctx.fillStyle = appearance.accent; ctx.beginPath(); ctx.arc(2, -34, attacking ? 5 + Math.sin(time * 8) * 1.5 : 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (spin || (pose === 'attack' && appearance.weapon === 'sword' && progress > 0.2)) {
    ctx.strokeStyle = appearance.accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha *= 0.55;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(0, -48, 62 + i * 6, spin ? 27 + i * 4 : 42, spin ? -0.1 : -0.5, -1.8 + progress * 4, 0.1 + progress * 4); ctx.stroke();
    }
  }
  ctx.restore();
}

export function fighterPose(f: Fighter, time: number, victory = false): DrawingPose {
  let pose: Pose = 'idle';
  if (victory) pose = 'victory';
  else if (f.stun > 0) pose = 'hurt';
  else if (f.attack) pose = f.attack.ultra ? 'ultra' : 'attack';
  else if (!f.grounded) pose = 'jump';
  else if (Math.abs(f.vx) > 35) pose = 'run';
  return { pose, time: pose === 'run' ? f.walkTime : time, progress: f.attack ? f.attack.elapsed / f.attack.duration : 0, facing: f.facing, color: PLAYER_COLORS[f.player] };
}

export function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  line(ctx, [[-22, 0], [22, 0]]);
  line(ctx, [[13, -6], [22, 0], [13, 6]]);
  line(ctx, [[-15, 0], [-23, -5]]);
  line(ctx, [[-15, 0], [-23, 5]]);
  ctx.restore();
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number) {
  if (drawWinterProjectile(ctx, p, time)) return;
  if (p.kind === 'glove') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.sign(p.vx) || 1, 1);
    ctx.strokeStyle = '#c8544788';
    for (let i = -1; i <= 1; i++) line(ctx, [[-28, i * 10], [-50 - Math.abs(i) * 7, i * 10]], 2);
    drawGlove(ctx, 0, 0, p.radius / 14, '#c85447'); ctx.restore(); return;
  }
  if (p.kind === 'arrow') return drawArrow(ctx, p.x, p.y, Math.atan2(p.vy, p.vx));
  if (p.kind === 'laser') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.lineCap = 'round';
    ctx.strokeStyle = '#438e9f'; line(ctx, [[-22, 0], [12, 0]], p.radius * 1.5);
    ctx.strokeStyle = '#c1f6f1'; line(ctx, [[-18, 0], [10, 0]], 3); ctx.restore(); return;
  }
  if (p.kind === 'boomerang') {
    drawBoomerang(ctx, p.x, p.y, time * 18 * Math.sign(p.vx), p.ultra ? 1.2 : 0.8, p.ultra ? '#df843e' : '#ba9251');
    if (p.ultra) { ctx.save(); ctx.strokeStyle = '#d87035'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, 31, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    return;
  }
  ctx.save(); ctx.translate(p.x, p.y);
  const fire = p.kind === 'fireball';
  const direction = Math.sign(p.vx);
  ctx.fillStyle = p.kind === 'cheese' ? '#edc24e' : p.kind === 'slime' ? '#a2c85b' : fire ? '#f4c64e' : '#c5a9e3';
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  const r = p.radius;
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const angle = i / 28 * Math.PI * 2;
    const radius = r + Math.sin(angle * 7 + time * 15) * (fire ? 5 : 2.5);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = p.kind === 'cheese' ? '#a77a29' : p.kind === 'slime' ? '#4e7029' : fire ? '#d8733d' : '#8560ae'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.6, time * 8, time * 8 + 4.8); ctx.stroke();
  for (let i = 0; i < 3; i++) line(ctx, [[-direction * (r + 5), (i - 1) * r * 0.6], [-direction * (r + 20 + i * 8), (i - 1) * r * 0.7]], 1.5);
  ctx.restore();
}

export function drawGlove(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-10, 7); ctx.lineTo(-12, -5); ctx.bezierCurveTo(-12, -20, 15, -19, 16, -5);
  ctx.quadraticCurveTo(18, 9, 8, 12); ctx.lineTo(-7, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-10, 2, 5, 8, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4e8d1'; ctx.fillRect(-8, 9, 17, 7); ctx.strokeRect(-8, 9, 17, 7);
  ctx.strokeStyle = '#fff9e6'; line(ctx, [[-2, -10], [7, -10]], 1.5); ctx.restore();
}

export function drawBoomerang(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-25, 17); ctx.quadraticCurveTo(-13, -5, 0, -18); ctx.quadraticCurveTo(15, -6, 26, 17); ctx.lineTo(17, 21); ctx.quadraticCurveTo(7, 7, 0, 0); ctx.quadraticCurveTo(-9, 7, -17, 21); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ead4a4'; line(ctx, [[-15, 3], [-8, 9]], 2); line(ctx, [[12, 3], [6, 9]], 2);
  ctx.restore();
}

export function drawStage(ctx: CanvasRenderingContext2D, platforms: Platform[] = PLATFORMS) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#b9d1dc66';
  for (let y = 14; y < HEIGHT; y += 29) line(ctx, [[0, y], [WIDTH, y]]);
  ctx.strokeStyle = '#da9c9866';
  line(ctx, [[91, 0], [91, HEIGHT]]);
  line(ctx, [[95, 0], [95, HEIGHT]]);
  for (const y of [140, 330, 530]) {
    ctx.fillStyle = '#dad6ca'; ctx.beginPath(); ctx.arc(30, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eeeadf'; ctx.beginPath(); ctx.arc(31, y + 1, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9c5b955'; ctx.lineWidth = 1; ctx.stroke();
  }
  // Sparse deterministic paper flecks: no external image or font requests.
  ctx.fillStyle = '#695f5010';
  for (let i = 0; i < 2600; i++) {
    const x = ((i * 7919) % 1280);
    const y = ((i * 2357) % 640);
    ctx.fillRect(x, y, 1, (i % 3) * 0.5 + 0.5);
  }
  ctx.font = '17px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillStyle = '#7e8276';
  ctx.save(); ctx.translate(1118, 250); ctx.rotate(0.09);
  ctx.fillText('double jump!', -40, 0);
  ctx.strokeStyle = '#7e8276'; ctx.lineWidth = 1.5;
  line(ctx, [[0, 12], [-9, 34], [-2, 30]]);
  ctx.restore();
  ctx.save(); ctx.translate(140, 572); ctx.rotate(-0.12);
  ctx.font = '15px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillText('mind the gap…', -20, 0); ctx.restore();
  drawStar(ctx, 1162, 393, 17, '#b9ac78');
  drawStar(ctx, 174, 229, 11, '#aaa899');
  ctx.save(); ctx.translate(1096, 562); ctx.rotate(0.09);
  ctx.fillStyle = '#e8e1bb77'; ctx.fillRect(-13, -19, 145, 55);
  ctx.fillStyle = '#8f8769'; ctx.font = '12px "Courier New", monospace';
  ctx.fillText('NO ERASERS.', 0, 2); ctx.fillText('NO EXCUSES.', 0, 20); ctx.restore();

  for (const p of platforms) {
    ctx.save();
    const depth = p.main ? 23 : 13;
    ctx.fillStyle = '#e1ddcf';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.width, p.y); ctx.lineTo(p.x + p.width - 8, p.y + depth); ctx.lineTo(p.x + 6, p.y + depth + 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#44473e'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    line(ctx, [[p.x - 3, p.y + 1], [p.x + p.width * 0.3, p.y - 1], [p.x + p.width * 0.7, p.y + 1], [p.x + p.width + 3, p.y - 1]]);
    ctx.lineWidth = 1.5;
    line(ctx, [[p.x, p.y], [p.x + 5, p.y + depth], [p.x + p.width - 9, p.y + depth - 1], [p.x + p.width, p.y]]);
    ctx.strokeStyle = '#77766688'; ctx.lineWidth = 1;
    for (let x = p.x + 8; x < p.x + p.width - 6; x += 8) line(ctx, [[x, p.y + 4], [Math.max(p.x + 5, x - 10), p.y + depth - 2]]);
    ctx.strokeStyle = '#45463733';
    line(ctx, [[p.x + 2, p.y + depth + 3], [p.x + p.width - 9, p.y + depth + 3]]);
    ctx.restore();
  }
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.6;
  const points: Point[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  line(ctx, points); ctx.restore();
}

export function line(ctx: CanvasRenderingContext2D, points: Point[], width?: number) {
  if (width !== undefined) ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.stroke();
}
