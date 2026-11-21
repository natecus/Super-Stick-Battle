import Phaser from 'phaser';
import './style.css';
import { bosses, characters } from './characters';
import { drawCharacter } from './game/drawing';
import { arenas, arenaForBoss, platformsAt } from './game/arenas';
import { drawArenaBackground, drawArenaPlatforms } from './game/arena-drawing';
import { KeyboardInput } from './game/input';
import { SketchAudio } from './game/audio';
import { NotebookScene } from './game/scene';
import { HEIGHT, Match, WIDTH } from './game/simulation';
import { browserProgressStorage, Progression } from './game/progression';
import type { GameMode, MatchPhase, PlayerId } from './game/types';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const app = document.querySelector<HTMLDivElement>('#app')!;
const pencilIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 24 2-8L23 3l6 6-14 14-8 2Zm2-8 6 7M20 6l6 6M7 24l-2 3"/></svg>';
const soundIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8"/></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const progression = new Progression(characters, browserProgressStorage(), bosses);
const playableCharacters = characters.filter(c => progression.canSelect(c));
const initialBoss = progression.nextBoss() ?? bosses.find(boss => progression.canChallenge(boss));

app.innerHTML = `
  <main class="notebook">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Super Stick Battle home">
        <span class="brand-mark">${pencilIcon}</span>
        <span><span class="brand-title">SUPER STICK BATTLE<span class="title-star">✳</span></span><span class="brand-subtitle">A LITTLE DOODLE. A LOT OF TROUBLE.</span></span>
      </a>
      <nav class="header-actions" aria-label="Game options">
        <span class="local-badge"><span></span> LOCAL 2-PLAYER</span>
        <button class="quiet-button" id="sound" aria-pressed="false" title="Toggle game sound">${soundIcon}<span>Sound off</span></button>
        <button class="quiet-button help-button" id="help"><span class="help-icon">?</span> How to play</button>
      </nav>
    </header>
    <p class="creator-credit">Developed by an 11-year-old.</p>

    <div class="page-rule"><span>VOL. 01 / THE NOTEBOOK</span><span>ORIGINAL DOODLES. FRIENDLY RIVALRIES.</span></div>

    <div class="mode-picker" role="group" aria-label="Game mode">
      <button class="mode-choice" data-mode="duel" aria-pressed="true"><span class="mode-symbol">VS</span><span><strong>Versus</strong><small>Player 1 vs. Player 2</small></span></button>
      <button class="mode-choice boss-mode-choice" data-mode="boss" aria-pressed="false"><span class="mode-symbol">2v1</span><span><strong>Boss Battle</strong><small>Four bosses. One team.</small></span><span class="new-label">NEW</span></button>
      <p class="mode-explainer" id="mode-explainer">A friendly rivalry.<br>Three lives. Last doodle standing.</p>
    </div>

    <section class="boss-ladder" id="boss-ladder" aria-labelledby="boss-ladder-title" hidden>
      <div class="ladder-heading"><strong id="boss-ladder-title">THE BOSS LADDER</strong><span id="ladder-progress"></span></div>
      <div class="boss-choices" role="group" aria-label="Choose a boss">${bosses.map((boss, index) => `<button class="boss-choice" data-boss="${escape(boss.id)}" aria-pressed="false" style="--accent:${boss.appearance.accent}"><span class="boss-number">0${index + 1}</span><strong>${escape(boss.name)}</strong><small data-boss-status></small></button>`).join('')}</div>
      <p>Win to recruit that fighter, unlock their arena, and open the next challenge.</p>
    </section>
    <section class="arena-picker" aria-labelledby="arena-picker-title">
      <div class="ladder-heading"><strong id="arena-picker-title">CHOOSE YOUR ARENA</strong><span id="arena-progress"></span></div>
      <div class="arena-choices" role="group" aria-label="Choose an arena">${arenas.map(arena => `<button class="arena-choice" data-arena="${arena.id}" aria-pressed="false" style="--accent:${arena.accent}"><canvas width="256" height="128" data-arena-preview="${arena.id}" aria-hidden="true"></canvas><strong>${arena.name}</strong><small data-arena-status></small></button>`).join('')}</div>
      <p id="arena-description"></p>
    </section>
    <section class="battle-section" aria-label="Battle arena">
      <div class="arena-topline"><span><i class="scribble-dot"></i> <span id="arena-title">DESK DUEL</span> <span class="arena-index">/ ARENA 01</span></span><span class="arena-rules" id="arena-rules">3 LIVES <b>·</b> DOUBLE JUMP <b>·</b> ULTRA MOVES</span></div>
      <div class="boss-hud" id="boss-hud" hidden><div class="boss-heading"><strong id="boss-name"></strong><span id="boss-status"></span></div><div class="boss-health" id="boss-health" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="500" aria-valuenow="500"><span></span></div><p id="boss-tip"></p></div>
      <div class="arena" id="arena">
        <div id="game"></div>
        <div class="hud" id="hud">
          ${[0, 1].map(p => `<div class="player-hud player-${p + 1}"><div class="hud-top"><span class="player-label">PLAYER ${p + 1}</span><span class="lives" id="lives-${p}" aria-label="3 lives">● ● ●</span></div><div class="hud-middle"><strong id="name-${p}"></strong><span class="damage" id="damage-${p}">0<span>%</span></span></div><div class="ultra-line"><span id="ultra-label-${p}">ULTRA</span><kbd>${p === 0 ? 'G' : 'L'}</kbd></div><div class="ultra-track" role="progressbar" aria-label="Player ${p + 1} ultra charge" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="charge-${p}"><span></span></div></div>`).join('')}
        </div>
        <div class="match-top"><span id="match-time">FRIENDLY MATCH</span><button id="pause" class="pause-button" aria-label="Pause match" title="Pause (Esc)" disabled>${pauseIcon}</button></div>
        <div class="overlay lobby-overlay" id="lobby-overlay">
          <span class="eyebrow" id="lobby-eyebrow">FROM THE MARGINS TO THE MAIN EVENT</span>
          <h1 id="lobby-title">Settle it<br><em>on paper.</em><svg viewBox="0 0 300 18" aria-hidden="true"><path d="M4 10Q115 0 292 6M15 16q140-8 262-4"/></svg></h1>
          <p id="lobby-subtitle">Your doodles. Their problem.</p>
          <button class="primary-button" id="start">LET’S BATTLE <span>↗</span></button>
          <span class="start-note">Pick your fighters below · or press Enter</span>
        </div>
        <div class="overlay countdown-overlay" id="countdown-overlay" hidden><span>GET YOUR PENCILS READY</span><strong id="countdown-number">3</strong></div>
        <div class="overlay panel-overlay" id="pause-overlay" hidden><div class="paper-panel"><span class="eyebrow">PENCILS DOWN</span><h2>A quick breather.</h2><p>Your doodles aren’t going anywhere.</p><button class="primary-button" id="resume">BACK TO BATTLE <span>↗</span></button><div class="panel-links"><button id="restart">Restart match</button><button id="choose">Change fighters</button></div></div></div>
        <div class="overlay panel-overlay" id="result-overlay" hidden><div class="paper-panel result-panel"><span class="eyebrow" id="winner-label">THE NOTEBOOK HAS A CHAMPION</span><h2 id="winner-title"></h2><p id="winner-detail"></p><div class="unlock-reward" id="unlock-reward" hidden></div><button class="primary-button" id="next-boss" hidden></button><button class="primary-button" id="rematch">ONE MORE ROUND <span>↗</span></button><button class="text-button" id="result-choose">Back to fighter select</button></div></div>
        <div class="arena-bottom-note">SKETCHBOOK SERIES <span>001</span></div>
      </div>
      <div class="controls-strip">
        <div class="control-group"><span class="control-player p1">P1</span><span><kbd>A</kbd><kbd>D</kbd> move</span><span><kbd>W</kbd> jump</span><span><kbd>F</kbd> attack</span><span><kbd>G</kbd> ultra</span></div>
        <span class="controls-divider" id="controls-divider">VS.</span>
        <div class="control-group"><span class="control-player p2">P2</span><span><kbd>←</kbd><kbd>→</kbd> move</span><span><kbd>↑</kbd> jump</span><span><kbd>K</kbd> attack</span><span><kbd>L</kbd> ultra</span></div>
      </div>
    </section>

    <section class="roster-section" aria-labelledby="roster-title">
      <div class="roster-heading"><div><span class="section-index">01 — THE USUAL SUSPECTS</span><h2 id="roster-title">Choose your fighter<span class="hand-arrow">↴</span></h2></div><p id="roster-hint">Different doodles. Different trouble.<br><span>Choose a character for each player.</span></p></div>
      <div class="roster" id="roster">${characters.map(c => `
        <article class="fighter-card ${c.unlock ? 'unlock-card' : ''}" data-character="${escape(c.id)}" style="--accent:${c.appearance.accent}">
          <div class="portrait-wrap"><canvas width="220" height="260" data-portrait="${escape(c.id)}" role="img" aria-label="Animated ${escape(c.name)} drawing"></canvas><span class="portrait-ground"></span></div>
          <div class="fighter-info"><span class="fighter-role">${escape(c.role)}</span><h3>${escape(c.name)}</h3><p class="tagline">${escape(c.tagline)}</p>
            <div class="move-list"><span>${escape(c.attack.name)}</span><span><i>✦</i> ${escape(c.ultra.name)}</span></div>
            ${c.unlock ? `<p class="unlock-note" id="unlock-${escape(c.id)}" data-unlock-status="${escape(c.id)}"></p>` : ''}
            <div class="pick-buttons">${[0, 1].map(p => `<button data-pick="${escape(c.id)}" data-player="${p}" class="pick p${p + 1}" aria-label="Choose ${escape(c.name)} for Player ${p + 1}" ${c.unlock ? `aria-describedby="unlock-${escape(c.id)}"` : ''} aria-pressed="false"><span>P${p + 1}</span><span class="pick-state">SELECT</span></button>`).join('')}</div>
            ${c.unlock ? `<button class="pick boss-challenge" data-challenge="${escape(c.unlock.boss)}"></button>` : ''}
          </div>
        </article>`).join('')}</div>
    </section>
    <footer><span>MADE OF LINES. BUILT FOR RIVALRIES.</span><span>A shared keyboard. A worthy opponent. <span class="footer-star">✳</span></span><iframe class="footer-support" src="./support-button.html" title="Buy me a pizza on Buy Me a Coffee" width="280" height="76" loading="lazy" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe></footer>
    <div class="sr-only" id="announcer" role="status" aria-live="polite"></div>
  </main>
  <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-top"><span class="section-index">A NOTE FROM THE MARGINS</span><button id="close-help" class="close-button" aria-label="Close instructions">×</button></div><h2 id="help-title">A crash course<br>in doodle combat.</h2><p class="help-intro">Two players. One keyboard. Last doodle standing wins.</p><div class="help-rule"><b>01</b><p><strong>Knock them off the page.</strong> Hits build damage. Higher damage means bigger knockback. Leave the arena and lose a life. You each get three.</p></div><div class="help-rule"><b>02</b><p><strong>Find your footing.</strong> Tap jump twice to double jump. Press down (<kbd>S</kbd> / <kbd>↓</kbd>) on a floating platform to drop through, or in the air to fall faster.</p></div><div class="help-rule"><b>03</b><p><strong>Make a little mayhem.</strong> Tap attack for your normal move. Dealing and taking damage fills your ultra meter. When it turns gold, press <kbd>G</kbd> / <kbd>L</kbd> to let it rip.</p></div><div class="help-keys"><div><span class="p1">PLAYER 1</span><p><kbd>A</kbd><kbd>D</kbd> move · <kbd>W</kbd> jump<br><kbd>F</kbd> attack · <kbd>G</kbd> ultra</p></div><div><span class="p2">PLAYER 2</span><p><kbd>←</kbd><kbd>→</kbd> move · <kbd>↑</kbd> jump<br><kbd>K</kbd> attack · <kbd>L</kbd> ultra</p></div></div><p class="help-footnote"><kbd>Esc</kbd> pauses. Switching away pauses automatically. Some keyboards limit simultaneous keys; if an input is missed, release extra keys or try a keyboard with better key rollover.</p><button class="primary-button" id="got-it">GOT IT. PENCILS UP. <span>↗</span></button></dialog>
`;

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const match = new Match(playableCharacters[0], playableCharacters[1] ?? playableCharacters[0], initialBoss,
  character => progression.canSelect(character), boss => progression.canChallenge(boss), arena => progression.canSelectArena(arena));
const keyboard = new KeyboardInput();
const sound = new SketchAudio();
const dialog = get<HTMLDialogElement>('help-dialog');
dialog.querySelector('.help-keys')!.insertAdjacentHTML('beforebegin', '<div class="help-rule boss-instructions"><b>04</b><p><strong>Climb the boss ladder together.</strong> Defeat ' + bosses.map(boss => escape(boss.name)).join(' &rarr; ') + ' in order. Each win unlocks that fighter and their home arena, and opens the next boss. Choose unlocked arenas in Versus. Boss fights are locked to each boss’s home arena. You each have three lives and no friendly fire. Drain the boss’s health to win; one surviving teammate can finish. Bosses warn before attacks, have attack armor, and speed up when enraged. Replay any available boss from the ladder.</p></div><p class="help-footnote">Jump clear of Dave’s slime. Cheese throws slowing blobs and heals with Cheese snack. Robot’s Flight boots grant real flight: hold W / up arrow to rise, S / down arrow to descend, and release to hover. Ninja’s Shadow form makes him translucent and invulnerable until his next attack, even if it misses. There is no time limit, and his ultra charges at half the usual rate. Boxer punches and throws a giant glove with his ultra. Clubber’s Earthquake hits grounded enemies sharing a platform; Boomeranger’s throw hits going out and back.</p>');
const announcer = get('announcer');
dialog.querySelector('.help-keys')!.insertAdjacentHTML('beforebegin', '<div class="help-rule"><b>05</b><p><strong>Learn each arena.</strong> Slime Caves slows anyone standing in green slime. Ride the cheese clock; its sides knock you away. In The Lab, lifts carry you, flashing strips warn of spikes, and the striped wall pushes you toward them. Jump over it or ride its top. Moonlit Dojo has a gently swaying bridge. Arena hazards affect both teams.</p></div>');
dialog.querySelector('.boss-instructions p')!.append(' Unlocks are saved in this browser at this game address.');
let previousPhase: MatchPhase | '' = '';
let previousMode: GameMode | '' = '';
let previousBoss = '';
let previousArena = '';
let previousCountdown = -1;
let pauseBeforeHelp = false;
let soundBusy = false;

function updateSelection() {
  const bossMode = match.mode === 'boss';
  get('arena-picker-title').textContent = bossMode ? 'BOSS HOME ARENA' : 'CHOOSE YOUR ARENA';
  get('arena-progress').textContent = `${arenas.filter(a => progression.canSelectArena(a)).length} / ${arenas.length} unlocked`;
  get('arena-description').textContent = (bossMode ? `${match.selectedBoss!.name} always fights in ${match.arena.name}. ` : '') + match.arena.description;
  document.querySelectorAll<HTMLButtonElement>('[data-arena]').forEach(button => {
    const arena = arenas.find(a => a.id === button.dataset.arena)!;
    const unlocked = progression.canSelectArena(arena);
    const available = match.arenaAvailable(arena);
    const selected = match.arena.id === arena.id;
    const boss = bosses.find(b => b.id === arena.boss);
    button.disabled = bossMode || match.phase !== 'lobby' || !available;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('arena-locked', !available);
    const status = bossMode && selected ? 'BOSS ARENA · FIXED' : unlocked ? bossMode ? 'VERSUS ONLY' : selected ? 'SELECTED' : 'READY TO PLAY' : `Beat ${boss?.name} to unlock`;
    button.querySelector('[data-arena-status]')!.textContent = status;
    button.setAttribute('aria-label', `${arena.name}. ${status}. ${arena.description}`);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(button => {
    const player = Number(button.dataset.player) as PlayerId;
    const character = characters.find(c => c.id === button.dataset.pick)!;
    const available = progression.canSelect(character);
    const selected = match.fighters[player].character.id === button.dataset.pick;
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.pick-state')!.textContent = !available ? 'LOCKED' : selected ? 'READY ✓' : 'SELECT';
    button.disabled = match.phase !== 'lobby' || !available;
  });
  document.querySelectorAll<HTMLElement>('.fighter-card').forEach(card => {
    const character = characters.find(c => c.id === card.dataset.character)!;
    const available = progression.canSelect(character);
    card.classList.toggle('fighter-locked', !available);
    if (character.unlock) {
      card.querySelector('.fighter-role')!.textContent = available ? character.role : 'LOCKED FIGHTER';
      const bossName = bosses.find(boss => boss.id === character.unlock!.boss)?.name ?? character.unlock.boss;
      card.querySelector('[data-unlock-status]')!.textContent = available
        ? progression.saved ? 'UNLOCKED ✓ · Both players can choose me.' : 'UNLOCKED ✓ · This session only; browser saving is unavailable.'
        : `Beat boss ${bossName} to unlock. Shared by both players.`;
    }
    card.classList.toggle('selected-p1', card.dataset.character === match.fighters[0].character.id);
    card.classList.toggle('selected-p2', card.dataset.character === match.fighters[1].character.id);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
    button.disabled = match.phase !== 'lobby' || button.dataset.mode === 'boss' && !initialBoss;
    button.setAttribute('aria-pressed', String(button.dataset.mode === match.mode));
  });
  get('boss-ladder').hidden = match.mode !== 'boss';
  get('ladder-progress').textContent = `${bosses.filter(boss => progression.hasDefeated(boss.id)).length} / ${bosses.length} defeated`;
  document.querySelectorAll<HTMLButtonElement>('[data-boss], [data-challenge]').forEach(button => {
    const boss = bosses.find(b => b.id === (button.dataset.boss ?? button.dataset.challenge))!;
    const available = progression.canChallenge(boss);
    const selected = match.mode === 'boss' && match.selectedBoss?.id === boss.id;
    const requiredName = bosses.find(b => b.id === boss.boss?.requires)?.name;
    button.disabled = match.phase !== 'lobby' || !available;
    button.setAttribute('aria-pressed', String(selected));
    const status = !available ? `Beat ${requiredName} first` : progression.hasDefeated(boss.id) ? 'DEFEATED ✓ · Replay' : `${boss.boss!.health} HP · Ready`;
    if (button.dataset.boss) button.querySelector('[data-boss-status]')!.textContent = status;
    else button.textContent = !available ? `LOCKED · ${status}` : selected ? `${boss.name.toUpperCase()} SELECTED ✓` : `CHALLENGE ${boss.name.toUpperCase()} ↗`;
  });
}

function refresh() {
  keyboard.enabled = match.phase === 'playing' && !dialog.open;
  match.fighters.slice(0, 2).forEach((f, p) => {
    get(`name-${p}`).textContent = f.character.name;
    get(`damage-${p}`).innerHTML = `${Math.floor(f.damage)}<span>%</span>`;
    get(`damage-${p}`).classList.toggle('high-damage', f.damage >= 100);
    get(`lives-${p}`).innerHTML = [0, 1, 2].map(i => `<span class="${i < f.lives ? '' : 'lost'}">●</span>`).join(' ');
    get(`lives-${p}`).setAttribute('aria-label', `${f.lives} lives remaining`);
    const charge = get(`charge-${p}`);
    charge.setAttribute('aria-valuenow', String(Math.floor(f.charge)));
    (charge.firstElementChild as HTMLElement).style.width = `${f.charge}%`;
    charge.classList.toggle('ready', f.charge >= 100);
    get(`ultra-label-${p}`).textContent = f.shadowForm ? 'UNTOUCHABLE · UNTIL NEXT ATTACK' : f.hovering > 0 ? `FLIGHT ${Math.ceil(f.hovering)}s` : f.charge >= 100 ? 'ULTRA READY!' : f.character.ultra.name.toUpperCase();
    get(`name-${p}`).closest('.player-hud')!.classList.toggle('player-eliminated', f.lives === 0);
  });
  const boss = match.boss;
  get('boss-hud').hidden = !boss;
  if (boss) {
    get('boss-name').innerHTML = `${escape(boss.character.name.toUpperCase())} <span>${escape(boss.character.role)}</span>`;
    const health = get('boss-health');
    health.setAttribute('aria-label', `${boss.character.name} health`);
    health.setAttribute('aria-valuemax', String(boss.maxHealth));
    health.setAttribute('aria-valuenow', String(Math.ceil(boss.health)));
    (health.firstElementChild as HTMLElement).style.width = `${boss.health / boss.maxHealth * 100}%`;
    get('boss-hud').classList.toggle('enraged', match.bossEnraged && boss.health > 0);
    get('boss-status').textContent = `${match.bossEnraged && boss.health > 0 ? 'ENRAGED · ' : ''}${Math.ceil(boss.health)} / ${boss.maxHealth} HP`;
    const ultraTip = boss.character.ultra.kind === 'heal' ? 'Healing windup! Keep the pressure on.'
      : boss.character.ultra.kind === 'hover' ? 'Flight boots! Robot can fly and fire lasers.'
      : boss.character.ultra.kind === 'invisibility' ? 'Ninja is entering Shadow Form. His next attack will reveal him!' : 'Move away from the marked area.';
    get('boss-tip').textContent = boss.health === 0 ? `${boss.character.name} is defeated!` : boss.respawn > 0 ? `${boss.character.name} fell! −70 HP. Coming back…`
      : boss.shadowForm ? 'Ninja is translucent and cannot be hit until he starts his next attack!'
      : boss.attack?.ultra ? `${boss.character.ultra.name.toUpperCase()}! ${ultraTip}`
      : boss.attack ? `${boss.character.attack.name.toUpperCase()}! ${boss.character.attack.kind === 'projectile' ? 'Jump out of the firing line.' : 'Jump or back away.'}`
      : match.fighters.some(f => f.player !== 2 && f.slowed > 0) ? 'Slowed! Dodge blobs and jump clear of slime puddles.'
      : `Drain ${boss.character.name}’s health. Three lives each. Friendly fire is off.`;
  }
  get('match-time').textContent = match.phase === 'lobby' ? match.mode === 'boss' ? 'CO-OP · 2 VS 1' : 'FRIENDLY MATCH' : `${Math.floor(match.elapsed / 60).toString().padStart(2, '0')}:${Math.floor(match.elapsed % 60).toString().padStart(2, '0')}`;
  get<HTMLButtonElement>('pause').disabled = !['playing', 'countdown', 'paused'].includes(match.phase);
  const count = Math.ceil(match.countdown);
  if (match.phase === 'countdown' && count !== previousCountdown) {
    get('countdown-number').textContent = String(count);
    announcer.textContent = `Battle begins in ${count}.`;
    previousCountdown = count;
  }
  if (match.phase !== previousPhase || match.mode !== previousMode || match.selectedBoss?.id !== previousBoss || match.arena.id !== previousArena) {
    const rewards = progression.recordResult(match, match.boss?.character.id);
    const rewardNames = rewards.map(c => c.name).join(' & ');
    const next = match.mode === 'boss' && match.winner === 'team' ? progression.nextBoss() : undefined;
    const nextButton = get<HTMLButtonElement>('next-boss');
    nextButton.hidden = !next;
    nextButton.dataset.next = next?.id ?? '';
    nextButton.textContent = next ? `NEXT BOSS: ${next.name.toUpperCase()} ↗` : '';
    get('rematch').classList.toggle('secondary-rematch', Boolean(next));
    get('unlock-reward').hidden = rewards.length === 0;
    get('unlock-reward').innerHTML = rewards.length ? `<strong>✦ ${escape(rewardNames.toUpperCase())} UNLOCKED!</strong><span>Both players can now choose ${escape(rewardNames)}. ${escape(arenaForBoss(match.boss!.character.id).name)} is also unlocked for Versus!</span><small>${progression.saved ? 'Saved in this browser. Available in both modes.' : 'Available this session. Browser saving is unavailable.'}</small>` : '';
    get('result-choose').textContent = rewards.length ? `Choose ${rewardNames} — back to fighter select` : 'Back to fighter select';
    previousPhase = match.phase;
    previousMode = match.mode;
    previousBoss = match.selectedBoss?.id ?? '';
    previousArena = match.arena.id;
    for (const [id, phase] of [['lobby-overlay', 'lobby'], ['countdown-overlay', 'countdown'], ['pause-overlay', 'paused'], ['result-overlay', 'finished']]) get(id).hidden = match.phase !== phase;
    get('arena').dataset.phase = match.phase;
    get('arena').dataset.mode = match.mode;
    const bossMode = match.mode === 'boss';
    const bossName = match.selectedBoss?.name ?? 'Boss';
    get('roster-hint').innerHTML = match.phase === 'lobby' ? bossMode ? `Pick your team. Take down ${escape(bossName)}.<br><span>Both players can choose any unlocked fighter.</span>` : 'Different doodles. Different trouble.<br><span>Choose a character for each player.</span>' : 'Your fighters are locked in.<br><span>Pause to change characters or mode.</span>';
    get('arena-title').textContent = match.arena.name.toUpperCase();
    document.querySelector('.arena-index')!.textContent = `/ ARENA 0${arenas.indexOf(match.arena) + 1}`;
    get('arena-rules').innerHTML = bossMode ? 'TEAM UP <b>·</b> NO FRIENDLY FIRE <b>·</b> 3 LIVES EACH' : '3 LIVES <b>·</b> DOUBLE JUMP <b>·</b> ULTRA MOVES';
    get('controls-divider').textContent = bossMode ? '+' : 'VS.';
    get('mode-explainer').innerHTML = bossMode ? `Same keyboard. Same team.<br>Beat ${escape(bossName)} before both players lose all lives.` : 'A friendly rivalry.<br>Three lives. Last doodle standing.';
    get('lobby-eyebrow').textContent = bossMode ? 'TWO DOODLES. ONE BIG CHALLENGE.' : 'FROM THE MARGINS TO THE MAIN EVENT';
    get('lobby-title').innerHTML = `${bossMode ? `Everyone<br><em>vs. ${escape(bossName)}.</em>` : 'Settle it<br><em>on paper.</em>'}<svg viewBox="0 0 300 18" aria-hidden="true"><path d="M4 10Q115 0 292 6M15 16q140-8 262-4"/></svg>`;
    get('lobby-subtitle').textContent = bossMode ? 'Pick a teammate. Bring a plan.' : 'Your doodles. Their problem.';
    get('start').innerHTML = `${bossMode ? `TAKE ON ${escape(bossName.toUpperCase())}` : 'LET’S BATTLE'} <span>↗</span>`;
    keyboard.clear();
    updateSelection();
    if (match.phase === 'playing') announcer.textContent = 'Battle!';
    if (match.phase === 'paused') { announcer.textContent = 'Match paused.'; if (!dialog.open) get('resume').focus({ preventScroll: true }); }
    if (match.phase === 'finished') {
      if (bossMode) {
        const won = match.winner === 'team';
        const draw = match.winner === null;
        get('winner-title').textContent = won ? `You defeated ${bossName}!` : draw ? 'Everybody went down.' : `${bossName} wins this one.`;
        get('winner-label').textContent = won ? next ? 'TEAMWORK TAKES THE PAGE' : 'BOSS LADDER COMPLETE' : draw ? 'A VERY MESSY DRAW' : 'THE BOSS STILL REIGNS';
        get('winner-detail').textContent = won ? next ? `${next.name} is ready to challenge. Pick your team for the next fight!` : 'All four bosses defeated. Every fighter and arena is yours!' : draw ? `${bossName} is down, but so is the team. Rematch?` : `${Math.ceil(match.boss!.health)} HP left. Watch the attack warnings and try again.`;
        get('rematch').innerHTML = `${won ? `FACE ${escape(bossName.toUpperCase())} AGAIN` : 'TRY AGAIN TOGETHER'} <span>↗</span>`;
        announcer.textContent = get('winner-title').textContent;
      } else {
        const f = typeof match.winner === 'number' ? match.fighters[match.winner] : null;
        get('winner-title').textContent = f ? `${f.character.name} wins!` : 'A perfect draw.';
        get('winner-label').textContent = f ? `PLAYER ${f.player + 1} TAKES THE PAGE` : 'BOTH DOODLES WENT DOWN';
        get('winner-detail').textContent = f ? `${f.lives} ${f.lives === 1 ? 'life' : 'lives'} left. Bragging rights earned.` : 'Some rivalries need another round.';
        get('rematch').innerHTML = 'ONE MORE ROUND <span>↗</span>';
        announcer.textContent = f ? `Player ${f.player + 1}, ${f.character.name}, wins!` : 'The match is a draw.';
      }
      get(next ? 'next-boss' : 'rematch').focus({ preventScroll: true });
      if (rewards.length) announcer.textContent += ` ${rewardNames} unlocked for both players.`;
    }
  }
}

function start() {
  match.start(); previousCountdown = -1; refresh();
  (document.activeElement as HTMLElement | null)?.blur();
  get('arena').scrollIntoView({ block: 'nearest', behavior: 'auto' });
}
function choose() { match.lobby(); refresh(); get('start').focus({ preventScroll: true }); }
function resume() { match.resume(); refresh(); (document.activeElement as HTMLElement | null)?.blur(); }
function togglePause() { if (match.phase === 'paused') resume(); else { match.pause(); refresh(); } }

get('start').addEventListener('click', start);
get('rematch').addEventListener('click', start);
get('restart').addEventListener('click', start);
get('pause').addEventListener('click', togglePause);
get('resume').addEventListener('click', resume);
get('choose').addEventListener('click', choose);
get('result-choose').addEventListener('click', choose);
function chooseMode(mode: GameMode) {
  if (match.setMode(mode)) { refresh(); announcer.textContent = mode === 'boss' ? `Boss Battle. Players one and two are teammates against ${match.selectedBoss!.name}.` : 'Versus. Player one against player two.'; }
}
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => chooseMode(button.dataset.mode as GameMode)));
document.querySelectorAll<HTMLButtonElement>('[data-arena]').forEach(button => button.addEventListener('click', () => {
  if (match.selectArena(button.dataset.arena!)) { refresh(); announcer.textContent = `${match.arena.name} selected. ${match.arena.description}`; }
}));
function chooseBoss(id: string) {
  const boss = bosses.find(b => b.id === id);
  if (!boss || !match.selectBoss(boss)) return;
  chooseMode('boss');
  get('boss-ladder').scrollIntoView({ block: 'nearest', behavior: 'auto' });
}
document.querySelectorAll<HTMLButtonElement>('[data-boss], [data-challenge]').forEach(button => button.addEventListener('click', () => chooseBoss((button.dataset.boss ?? button.dataset.challenge)!)));
get('next-boss').addEventListener('click', () => {
  const next = get('next-boss').dataset.next;
  if (match.phase !== 'finished' || match.winner !== 'team' || !next) return;
  match.lobby(); chooseBoss(next); get('start').focus({ preventScroll: true });
});
get('roster').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pick]');
  if (!button || match.phase !== 'lobby') return;
  const character = characters.find(c => c.id === button.dataset.pick)!;
  if (!progression.canSelect(character)) return;
  const player = Number(button.dataset.player) as PlayerId;
  match.select(player, character); updateSelection(); refresh();
  announcer.textContent = `Player ${player + 1} selected ${character.name}.`;
});
get('sound').addEventListener('click', async () => {
  if (soundBusy) return;
  soundBusy = true;
  try {
    const enabled = await sound.toggle();
    get('sound').setAttribute('aria-pressed', String(enabled));
    get('sound').querySelector('span')!.textContent = enabled ? 'Sound on' : 'Sound off';
  } catch { announcer.textContent = 'Sound is unavailable in this browser.'; }
  finally { soundBusy = false; }
});
get('help').addEventListener('click', () => {
  pauseBeforeHelp = match.phase === 'playing' || match.phase === 'countdown';
  match.pause(); dialog.showModal(); refresh(); keyboard.clear();
});
const closeHelp = () => dialog.close();
get('close-help').addEventListener('click', closeHelp);
get('got-it').addEventListener('click', closeHelp);
dialog.addEventListener('close', () => { if (pauseBeforeHelp) resume(); else refresh(); pauseBeforeHelp = false; });
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeHelp(); } });
window.addEventListener('keydown', event => {
  if (dialog.open || event.repeat) return;
  if (event.code === 'Escape') { event.preventDefault(); togglePause(); }
  if (event.code === 'Enter' && (match.phase === 'lobby' || match.phase === 'finished') && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)) { event.preventDefault(); start(); }
});
const pauseForFocus = () => { keyboard.clear(); match.pause(); refresh(); };
window.addEventListener('blur', pauseForFocus);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForFocus(); });

refresh();
document.querySelectorAll<HTMLCanvasElement>('[data-arena-preview]').forEach(canvas => {
  const arena = arenas.find(a => a.id === canvas.dataset.arenaPreview)!;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
  drawArenaBackground(ctx, arena); drawArenaPlatforms(ctx, arena, platformsAt(arena, 0), 0);
});
const scene = new NotebookScene(match, keyboard, refresh, event => sound.play(event));
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#faf7ed',
  transparent: false,
  banner: false,
  audio: { noAudio: true },
  render: { antialias: true, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
});

// Portraits reuse the gameplay rig, so a new character automatically has a portrait.
const portraits = [...document.querySelectorAll<HTMLCanvasElement>('[data-portrait]')].map(canvas => ({
  canvas, ctx: canvas.getContext('2d')!, character: characters.find(c => c.id === canvas.dataset.portrait)!,
}));
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let lastPortrait = 0;
let portraitFrame = 0;
function drawPortraits(time: number) {
  if (time - lastPortrait > 65 && !document.hidden) {
    lastPortrait = time;
    for (const { canvas, ctx, character } of portraits) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCharacter(ctx, character, 92, 236, 1.85, { pose: 'idle', time: motion.matches ? 0 : time / 1000, facing: 1 });
    }
  }
  portraitFrame = requestAnimationFrame(drawPortraits);
}
drawPortraits(100);

if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(portraitFrame); keyboard.destroy(); game.destroy(true); });
