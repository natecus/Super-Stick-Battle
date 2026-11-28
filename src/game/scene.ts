import { POWER_UP_LABELS, GOOD_POWER_UPS } from './powerups';
import Phaser from 'phaser';
import { drawCharacter, drawProjectile, drawStar, fighterPose, line } from './drawing';
import { drawArenaBackground, drawArenaPlatforms } from './arena-drawing';
import { HEIGHT, Match, PLAYER_COLORS, STEP, WIDTH } from './simulation';
import type { GameEvent } from './types';
import type { KeyboardInput } from './input';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; total: number; color: string; size: number; star: boolean }
interface Caption { x: number; y: number; text: string; life: number; color: string }

export class NotebookScene extends Phaser.Scene {
  private surface!: Phaser.Textures.CanvasTexture;
  private paper!: Phaser.Textures.CanvasTexture;
  private lastArena = '';
  private accumulator = 0;
  private clock = 0;
  private uiClock = 0;
  private particles: Particle[] = [];
  private captions: Caption[] = [];
  private lastPhase = '';
  private shake = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private match: Match, private keyboard: KeyboardInput, private refresh: () => void, private onEvent: (event: GameEvent) => void) {
    super('Notebook');
  }

  create() {
    this.paper = this.textures.createCanvas('paper', WIDTH, HEIGHT)!;
    this.add.image(0, 0, 'paper').setOrigin(0);
    this.surface = this.textures.createCanvas('ink', WIDTH, HEIGHT)!;
    this.add.image(0, 0, 'ink').setOrigin(0);
    this.game.canvas.setAttribute('aria-label', 'Notebook arena. Player one uses W A S D, F and G. Player two uses arrow keys, K and L.');
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.style.display = 'block';
    this.refresh();
  }

  update(_time: number, delta: number) {
    if (!this.surface) return;
    const dt = Math.min(delta / 1000, 0.1);
    const paused = this.match.phase === 'paused';
    if (!paused) this.clock += dt;
    this.accumulator += dt;
    while (this.accumulator >= STEP) {
      this.match.step(STEP, this.keyboard.consume());
      this.accumulator -= STEP;
    }
    for (const event of this.match.drainEvents()) {
      this.effects(event);
      this.onEvent(event);
    }
    if (!paused) {
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 230 * dt; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const c of this.captions) { c.y -= 25 * dt; c.life -= dt; }
      this.captions = this.captions.filter(c => c.life > 0);
      this.shake = Math.max(0, this.shake - dt);
    }
    if (this.lastPhase !== this.match.phase) {
      if (this.match.phase === 'lobby' || this.match.phase === 'countdown') { this.particles = []; this.captions = []; }
      this.lastPhase = this.match.phase;
      this.refresh();
    }
    this.uiClock += dt;
    if (this.uiClock >= 0.08) { this.uiClock = 0; this.refresh(); }
    this.renderInk();
  }

  private renderInk() {
    if (this.lastArena !== this.match.arena.id) {
      drawArenaBackground(this.paper.context, this.match.arena); this.paper.refresh();
      this.lastArena = this.match.arena.id;
      this.game.canvas.setAttribute('aria-label', `${this.match.arena.name} arena. ${this.match.arena.description} Player one uses W A S D, F and G. Player two uses arrow keys, K and L.`);
    }
    const ctx = this.surface.context;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    if (this.shake > 0 && !this.reducedMotion) ctx.translate(Math.sin(this.clock * 150) * this.shake * 20, Math.cos(this.clock * 180) * this.shake * 10);
    drawArenaPlatforms(ctx, this.match.arena, this.match.platforms, this.match.elapsed);

    for (const item of this.match.pickups) {
      const platform = this.match.platforms[item.platform], x = platform.x + item.offset, y = platform.y - 24;
      ctx.save(); ctx.globalAlpha = Math.min(1, item.life); ctx.fillStyle = '#f1d98a'; ctx.strokeStyle = '#796237'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#665334'; ctx.textAlign = 'center'; ctx.font = 'bold 23px "Courier New", monospace'; ctx.fillText('?', x, y + 8); ctx.restore();
    }
    for (const hazard of this.match.hazards) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, hazard.life * 2);
      if (hazard.kind === 'slime') {
        ctx.fillStyle = '#9fbe5c88'; ctx.strokeStyle = '#658b35'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(hazard.x, hazard.y - 3, hazard.radius, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(hazard.x + i * hazard.radius * 0.32, hazard.y - 7, 2.5 + Math.sin(this.clock * 3 + i), 0, Math.PI * 2); ctx.stroke(); }
      } else if (hazard.kind === 'quake') {
        ctx.strokeStyle = '#a0743f'; ctx.lineWidth = 3;
        const points: [number, number][] = [];
        for (let x = hazard.x - hazard.radius; x <= hazard.x + hazard.radius; x += 12) points.push([x, hazard.y - 7 + Math.sin(x * 0.2 + this.clock * 30) * 6]);
        line(ctx, points);
      } else {
        const size = hazard.radius * (1 - hazard.life / hazard.total);
        ctx.strokeStyle = PLAYER_COLORS[hazard.owner]; ctx.fillStyle = hazard.owner === 2 ? '#a1c95835' : '#f4bc5635'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(hazard.x, hazard.y, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    for (const f of this.match.fighters) {
      if (f.attack?.ultra && (f.character.ultra.kind === 'rain' || f.character.ultra.kind === 'blizzard')) {
        ctx.save(); ctx.globalAlpha = 0.13; ctx.fillStyle = f.character.ultra.kind === 'blizzard' ? '#539ab8' : PLAYER_COLORS[f.player];
        ctx.fillRect(f.attack.targetX - f.character.ultra.range / 2, 100, f.character.ultra.range, 430);
        ctx.restore();
      }
      if (f.lives === 0 || f.respawn > 0) continue;
      ctx.save();
      if (f.attack && (f.player === 2 || f.attack.ultra && f.character.ultra.kind === 'slime-bomb')) {
        const warning = f.attack.ultra ? f.attack.elapsed < 0.62 : f.attack.elapsed < f.character.attack.windup;
        if (warning) {
          ctx.save(); ctx.strokeStyle = '#8a453a'; ctx.fillStyle = '#be66441c'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 5]);
          if (!f.attack.ultra) {
            const x = f.facing > 0 ? f.x : f.x - f.character.attack.range;
            ctx.fillRect(x, f.y - 130, f.character.attack.range, 120); ctx.strokeRect(x, f.y - 130, f.character.attack.range, 120);
          } else if (f.character.ultra.kind === 'slime-bomb') {
            for (const target of this.match.fighters.filter(target => target.team !== f.team && target.lives > 0 && target.respawn === 0 && !target.shadowForm)) {
              ctx.beginPath(); ctx.ellipse(target.x, target.y, f.character.ultra.range, 14, 0, 0, Math.PI * 2); ctx.stroke();
            }
          } else if (f.character.ultra.kind === 'spin') {
            ctx.beginPath(); ctx.ellipse(f.x, f.y - 45, f.character.ultra.range, 70, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
      }
      if (f.invulnerable > 0 && Math.floor(this.clock * 12) % 2 === 0) ctx.globalAlpha = 0.4;
      // Ground shadow and a handwritten player label remain distinct in mirror matches.
      if (f.grounded) {
        ctx.fillStyle = '#4a47351b'; ctx.beginPath(); ctx.ellipse(f.x, f.y - 1, 26, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      const celebrating = this.match.phase === 'finished' && (this.match.winner === f.player || this.match.winner === 'team' && f.player !== 2 || this.match.winner === 'boss' && f.player === 2);
      ctx.save();
      if (f.shadowForm) ctx.globalAlpha *= 0.35;
      drawCharacter(ctx, f.character, f.x, f.y, f.size, fighterPose(f, this.clock + f.player, celebrating));
      ctx.restore();
      if (f.hovering > 0) {
        ctx.strokeStyle = '#4fa6b7'; ctx.lineWidth = 2;
        for (const dx of [-15, 16]) for (let i = 0; i < 3; i++) line(ctx, [[f.x + dx * f.size + (i - 1) * 4, f.y + 4], [f.x + dx * f.size + (i - 1) * 6, f.y + 12 + Math.sin(this.clock * 20 + i) * 4]]);
      }
      ctx.fillStyle = PLAYER_COLORS[f.player]; ctx.font = 'bold 13px "Courier New", monospace'; ctx.textAlign = 'center';
      const markerY = Math.max(126, f.y - 123 * f.size);
      const marker = f.player === 2 ? f.character.name.toUpperCase() : `P${f.player + 1}`;
      if (f.y > 105) {
        ctx.fillText(marker, f.x, markerY);
        ctx.beginPath(); ctx.moveTo(f.x - 4, markerY + 5); ctx.lineTo(f.x + 4, markerY + 5); ctx.lineTo(f.x, markerY + 10); ctx.fill();
      } else {
        ctx.fillText(`↑ ${marker}`, Math.max(70, Math.min(WIDTH - 50, f.x)), 126);
      }
      if (f.slowed > 0 || f.hovering > 0 || f.shadowForm) {
        ctx.fillStyle = f.shadowForm ? '#71618f' : f.slowed > 0 ? '#658331' : '#458b9c'; ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText(f.shadowForm ? 'UNTOUCHABLE' : f.slowed > 0 ? 'SLOWED!' : `FLIGHT ${Math.ceil(f.hovering)}s`, f.x, markerY - 16);
      }
      const powerUp = f.powerUps[f.powerUps.length - 1];
      if (powerUp) {
        ctx.fillStyle = GOOD_POWER_UPS.includes(powerUp.kind) ? '#397754' : '#a34b40';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText(`${POWER_UP_LABELS[powerUp.kind]}${powerUp.kind === 'heal' || powerUp.kind === 'damage' ? '' : ` ${Math.ceil(powerUp.remaining)}s`}`, f.x, markerY - 31);
      }
      if (f.charge >= 100) {
        ctx.strokeStyle = '#d2a225'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 42, 36 + Math.sin(this.clock * 5) * 2, 58, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    for (const p of this.match.projectiles) drawProjectile(ctx, p, this.clock);
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.total;
      if (p.star) drawStar(ctx, p.x, p.y, p.size, p.color);
      else { ctx.strokeStyle = p.color; ctx.lineWidth = 2; line(ctx, [[p.x, p.y], [p.x - p.vx * 0.025, p.y - p.vy * 0.025]]); }
    }
    ctx.globalAlpha = 1;
    for (const c of this.captions) {
      ctx.globalAlpha = Math.min(1, c.life * 2);
      ctx.font = 'bold 25px "Comic Sans MS", "Segoe Print", cursive'; ctx.textAlign = 'center';
      ctx.fillStyle = c.color; ctx.fillText(c.text, c.x, c.y);
    }
    ctx.restore();
    this.surface.refresh();
  }

  private effects(event: GameEvent) {
    if (event.type === 'win') return;
    const color = PLAYER_COLORS[event.player];
      const count = event.type === 'hit' ? 12 : event.type === 'ko' || event.type === 'explosion' ? 30 : event.type === 'ultra' || event.type === 'enrage' ? 18 : 5;
    const x = Math.max(80, Math.min(WIDTH - 80, event.x));
    const y = Math.max(140, Math.min(HEIGHT - 30, event.y));
    for (let i = 0; i < (this.reducedMotion ? Math.min(count, 5) : count); i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = (event.type === 'hit' || event.type === 'ko' ? 140 : 60) + (i % 4) * 20;
      const life = event.type === 'ko' ? 0.8 : 0.45;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, life, total: life, color, size: i % 3 + 3, star: i % 4 === 0 });
    }
    if (event.type === 'hit') {
      this.shake = Math.min(0.16, event.intensity * 0.04);
      this.captions.push({ x, y: y - 24, text: event.intensity > 2 ? 'WHAM!' : 'POW!', life: 0.5, color });
    } else if (event.type === 'ko') {
      this.shake = 0.2;
      this.captions.push({ x, y: Math.min(y, 470), text: 'OFF THE PAGE!', life: 0.9, color });
    } else if (event.type === 'ultra') {
      this.captions.push({ x, y: y - 80, text: this.match.fighters[event.player].character.ultra.name.toUpperCase(), life: 1, color });
    } else if (event.type === 'enrage') {
      this.captions.push({ x, y: y - 150, text: `${this.match.fighters[event.player].character.name.toUpperCase()} IS NOT AMUSED.`, life: 1.6, color });
    } else if (event.type === 'explosion') {
      this.shake = 0.12;
      this.captions.push({ x, y: y - 25, text: event.player === 2 ? 'SPLAT!' : 'KA-BOOM!', life: 0.6, color });
    }
  }
}
