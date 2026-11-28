import { drawWinterBackground, drawWinterPlatforms } from './winter-arena-drawing';
import { type ArenaDefinition, spikeState } from './arenas';
import { drawStage, line } from './drawing';
import type { Platform } from './types';

const TAU = Math.PI * 2;
const INK = '#45463c';
const FONT = '"Comic Sans MS", "Segoe Print", cursive';

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
}

function holes(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, width - 6, height - 6); ctx.clip();
  ctx.fillStyle = '#d0a13d'; ctx.strokeStyle = '#bd8f30'; ctx.lineWidth = 1.2;
  for (let row = 0; row < Math.ceil(height / 28); row++) for (let col = 0; col < Math.ceil(width / 41); col++) {
    const px = x + 17 + col * 41 + (row % 2) * 19;
    const py = y + 17 + row * 28;
    oval(ctx, px, py, 5 + (col + row) % 3 * 2, 4 + col % 3);
    ctx.strokeStyle = '#fce9a4'; ctx.beginPath(); ctx.ellipse(px + 1, py + 2, 6, 4, 0, 0.2, 2.7); ctx.stroke(); ctx.strokeStyle = '#bd8f30';
  }
  ctx.restore();
}

function roof(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.fillStyle = '#9a90ad'; ctx.strokeStyle = '#5b536b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y); ctx.quadraticCurveTo(x + width - 3, y + 11, x + width + 10, y + 16);
  ctx.quadraticCurveTo(x + width / 2, y + 32, x - 10, y + 16); ctx.quadraticCurveTo(x + 3, y + 11, x, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d1c9db';
  for (let dx = 14; dx < width - 5; dx += 20) line(ctx, [[x + dx, y + 3], [x + dx - 6, y + 18]], 1);
}

// Backgrounds are cached by the scene; only moving/collidable scenery is drawn each frame.
export function drawArenaBackground(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  if (drawWinterBackground(ctx, arena)) return;
  drawStage(ctx, arena.id === 'notebook' ? arena.platforms : []);
  if (arena.id === 'notebook') return;
  ctx.save();
  ctx.fillStyle = arena.id === 'moonlit-dojo' ? '#e9e5f1' : arena.id === 'cheese-land' ? '#fbefcc' : arena.id === 'slime-caves' ? '#e5ebd9' : '#e7efed';
  ctx.fillRect(0, 0, 1280, 640);
  ctx.strokeStyle = '#9daaa326'; ctx.lineWidth = 1;
  for (let y = 14; y < 640; y += 29) line(ctx, [[0, y], [1280, y]]);
  ctx.strokeStyle = '#c18b8b44'; line(ctx, [[91, 0], [91, 640]]);
  ctx.fillStyle = '#c3c4b8';
  for (const y of [140, 330, 530]) { ctx.beginPath(); ctx.arc(30, y, 9, 0, TAU); ctx.fill(); }
  if (arena.id === 'slime-caves') {
    ctx.fillStyle = '#aab593'; ctx.strokeStyle = '#7d8c6b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(104, 0);
    for (let x = 104; x < 1280; x += 64) { ctx.lineTo(x, 58 + (x % 3) * 15); ctx.lineTo(x + 25, 80 + (x % 5) * 16); ctx.lineTo(x + 42, 48); }
    ctx.lineTo(1280, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const x of [125, 1150, 1200]) {
      ctx.fillStyle = '#ccd4bb'; ctx.strokeStyle = '#9daa88';
      ctx.beginPath(); ctx.moveTo(x - 25, 560); ctx.lineTo(x - 19, 280); ctx.lineTo(x + 9, 220); ctx.lineTo(x + 30, 330); ctx.lineTo(x + 42, 560); ctx.closePath(); ctx.fill(); ctx.stroke();
      line(ctx, [[x - 10, 340], [x + 12, 382], [x + 3, 410]], 1);
    }
    ctx.fillStyle = '#93b350'; ctx.strokeStyle = '#769443';
    for (const x of [177, 1100, 1180]) { oval(ctx, x, 585, 35, 8); oval(ctx, x - 9, 578, 12, 11); }
  } else if (arena.id === 'cheese-land') {
    ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#ecc367'; ctx.strokeStyle = '#d5ae4e';
    for (const [x, y, r] of [[160, 183, 45], [1125, 215, 67], [1170, 450, 40], [173, 470, 24], [620, 95, 40]]) oval(ctx, x, y, r, r * 0.8);
    ctx.restore();
    // The drawing's rail is deliberately thin and dashed: it has no collision surface.
    ctx.strokeStyle = '#a38c5566'; ctx.setLineDash([5, 6]); line(ctx, [[230, 344], [1045, 344]], 2); ctx.setLineDash([]);
    ctx.fillStyle = '#998347'; ctx.font = `13px ${FONT}`; ctx.fillText('clock track', 1080, 340);
    ctx.fillText('ride the top!', 1080, 360);
  } else if (arena.id === 'the-lab') {
    ctx.strokeStyle = '#95b4b633';
    for (let x = 120; x < 1280; x += 58) line(ctx, [[x, 0], [x, 640]], 1);
    for (const p of arena.platforms.filter(p => p.motion?.axis === 'y')) {
      ctx.strokeStyle = '#95aeb066'; ctx.setLineDash([5, 9]);
      for (const dx of [12, p.width - 12]) line(ctx, [[p.x + dx, p.y - p.motion!.amplitude - 15], [p.x + dx, p.y + p.motion!.amplitude + 30]], 2);
      ctx.setLineDash([]);
    }
    for (const x of [145, 1130]) {
      ctx.fillStyle = '#c5d6d4'; ctx.strokeStyle = '#839d9e'; ctx.lineWidth = 2;
      ctx.fillRect(x, 270, 60, 170); ctx.strokeRect(x, 270, 60, 170);
      ctx.fillStyle = '#8bbbc0'; ctx.fillRect(x + 10, 285, 40, 51); ctx.strokeRect(x + 10, 285, 40, 51);
      ctx.strokeStyle = '#ddf7d4'; line(ctx, [[x + 13, 310], [x + 20, 310], [x + 26, 298], [x + 32, 320], [x + 40, 305], [x + 47, 305]], 2);
      ctx.strokeStyle = '#839d9e'; for (let y = 355; y < 420; y += 13) line(ctx, [[x + 12, y], [x + 48, y]], 2);
    }
    ctx.strokeStyle = '#9cb5b5'; line(ctx, [[140, 210], [140, 165], [1135, 165], [1135, 225]], 8);
    ctx.strokeStyle = '#d1ddda'; line(ctx, [[140, 210], [140, 165], [1135, 165], [1135, 225]], 3);
  } else {
    ctx.fillStyle = '#fbf8e4'; ctx.strokeStyle = '#c9bfd3'; ctx.lineWidth = 1.5; oval(ctx, 985, 165, 61, 61);
    ctx.fillStyle = '#d5ccdf'; ctx.strokeStyle = '#c5b9d1';
    for (const [x, y, w] of [[150, 330, 130], [1020, 380, 190], [450, 440, 130]]) {
      ctx.fillRect(x, y, w, 200); ctx.save(); ctx.globalAlpha = 0.36; roof(ctx, x - 15, y, w + 30); roof(ctx, x + 8, y - 42, w - 16); ctx.restore();
    }
    for (const x of [132, 166, 1120, 1162, 1205]) {
      ctx.strokeStyle = '#8c9b85'; line(ctx, [[x, 585], [x + 6, 240]], 5);
      for (let y = 300; y < 560; y += 48) {
        line(ctx, [[x - 5, y], [x + 8, y]], 2);
        ctx.fillStyle = '#9ba98d'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 50, y - 42, x + 37, y - 8); ctx.closePath(); ctx.fill();
      }
    }
    for (const x of [484, 796]) {
      ctx.strokeStyle = '#766881'; line(ctx, [[x, 145], [x, 180]], 1.5);
      ctx.fillStyle = '#daaaa0'; oval(ctx, x, 197, 15, 20); line(ctx, [[x - 9, 184], [x - 9, 209]], 1); line(ctx, [[x + 9, 184], [x + 9, 209]], 1);
      line(ctx, [[x, 217], [x, 229]], 2);
    }
  }
  ctx.fillStyle = arena.accent; ctx.font = `17px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(arena.name, 640, 594);
  ctx.restore();
}

export function drawArenaPlatforms(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, platforms: Platform[], time: number) {
  if (drawWinterPlatforms(ctx, arena, platforms, time)) return;
  if (arena.id === 'notebook') return;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  platforms.forEach((p, index) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    const depth = p.height ?? (p.main ? 42 : 22);
    if (arena.id === 'cheese-land') {
      ctx.fillStyle = '#f1ce68'; ctx.fillRect(p.x, p.y, p.width, depth); ctx.strokeRect(p.x, p.y, p.width, depth);
      holes(ctx, p.x, p.y, p.width, depth);
      if (p.solid === 'clock') {
        ctx.fillStyle = '#fff5c9'; ctx.strokeStyle = '#8b722e'; ctx.lineWidth = 2;
        const x = p.x + p.width / 2, y = p.y + 36;
        oval(ctx, x, y, 27, 27);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(ctx, [[x + Math.sin(a) * 21, y - Math.cos(a) * 21], [x + Math.sin(a) * 24, y - Math.cos(a) * 24]], 1.5); }
        line(ctx, [[x, y], [x + Math.sin(time * 1.5) * 18, y - Math.cos(time * 1.5) * 18]], 2);
        line(ctx, [[x, y], [x - 10, y - 5]], 2.5);
      }
    } else if (arena.id === 'the-lab') {
      ctx.fillStyle = p.solid ? '#ead38b' : '#b1c6c8'; ctx.fillRect(p.x, p.y, p.width, depth); ctx.strokeRect(p.x, p.y, p.width, depth);
      ctx.save(); ctx.beginPath(); ctx.rect(p.x + 2, p.y + 2, p.width - 4, depth - 4); ctx.clip();
      ctx.strokeStyle = p.solid ? '#4b5552' : '#789a9d';
      if (p.solid) for (let y = p.y - 30; y < p.y + depth; y += 24) line(ctx, [[p.x, y], [p.x + p.width, y + 26]], 10);
      else for (let x = p.x + 10; x < p.x + p.width; x += 30) line(ctx, [[x, p.y + 7], [x + 13, p.y + 7]], 2);
      ctx.restore();
      if (!p.main && !p.solid) { ctx.fillStyle = '#65a5a8'; ctx.fillRect(p.x + 5, p.y + depth - 5, p.width - 10, 3); }
    } else if (arena.id === 'moonlit-dojo') {
      if (index === 4) {
        ctx.strokeStyle = '#77664c';
        for (const y of [p.y - 18, p.y - 8]) { ctx.beginPath(); ctx.moveTo(p.x - 12, y - 12); ctx.quadraticCurveTo(p.x + p.width / 2, y + 6, p.x + p.width + 12, y - 12); ctx.stroke(); }
        ctx.fillStyle = '#bca684'; ctx.fillRect(p.x, p.y, p.width, 9); ctx.strokeRect(p.x, p.y, p.width, 9);
        for (let x = p.x + 6; x < p.x + p.width; x += 16) line(ctx, [[x, p.y + 1], [x, p.y + 8]], 1);
        for (const x of [p.x - 5, p.x + p.width + 5]) line(ctx, [[x, p.y - 35], [x, p.y + 15]], 3);
      } else {
        if (p.main) { ctx.fillStyle = '#c7b9c9'; ctx.fillRect(p.x + 15, p.y + 18, p.width - 30, 38); }
        roof(ctx, p.x, p.y, p.width);
      }
    } else {
      ctx.fillStyle = '#acb495';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.width, p.y); ctx.lineTo(p.x + p.width - 8, p.y + depth); ctx.lineTo(p.x + 12, p.y + depth + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7c8768';
      for (let x = p.x + 22; x < p.x + p.width - 15; x += 58) line(ctx, [[x, p.y + 9], [x + 14, p.y + 14], [x + 6, p.y + depth - 3]], 1);
    }
  });
  for (const patch of arena.slime ?? []) {
    const p = platforms[patch.platform];
    ctx.fillStyle = '#a0bc59'; ctx.strokeStyle = '#6f8c37'; ctx.lineWidth = 1.5;
    oval(ctx, p.x + patch.offset + patch.width / 2, p.y - 3, patch.width / 2, 7);
    for (let i = 1; i < 4; i++) oval(ctx, p.x + patch.offset + patch.width * i / 4, p.y - 6, 5 + i, 3 + i);
  }
  for (const strip of arena.spikes ?? []) {
    const state = spikeState(strip, time);
    ctx.fillStyle = '#545d59'; ctx.fillRect(strip.x, strip.y - 2, strip.width, 5);
    ctx.strokeStyle = '#625c4b'; ctx.lineWidth = 1.5;
    ctx.fillStyle = state.warning ? (Math.floor(time * 8) % 2 ? '#edb34d' : '#fff0ac') : state.height > 8 ? '#b55e4e' : '#829797';
    for (let x = strip.x + 3; x < strip.x + strip.width - 8; x += 14) {
      ctx.fillRect(x, strip.y + 7, 8, 4);
      if (state.height > 0) { ctx.beginPath(); ctx.moveTo(x - 1, strip.y); ctx.lineTo(x + 5, strip.y - state.height); ctx.lineTo(x + 11, strip.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    if (state.warning) { ctx.font = `bold 17px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#9e5c32'; ctx.fillText('!', strip.x + strip.width / 2, strip.y - 18); }
  }
  ctx.restore();
}
