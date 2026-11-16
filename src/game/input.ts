import { emptyInput, type InputFrame } from './types';

const BINDINGS = [
  { left: 'KeyA', right: 'KeyD', down: 'KeyS', jump: 'KeyW', attack: 'KeyF', ultra: 'KeyG' },
  { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', jump: 'ArrowUp', attack: 'KeyK', ultra: 'KeyL' },
] as const;
const GAME_KEYS = new Set<string>(BINDINGS.flatMap(binding => Object.values(binding)));

export class KeyboardInput {
  private held = new Set<string>();
  private pressed = new Set<string>();
  enabled = false;

  private keyDown = (event: KeyboardEvent) => {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (GAME_KEYS.has(event.code)) {
      event.preventDefault();
      if (!this.held.has(event.code) && !event.repeat) this.pressed.add(event.code);
      this.held.add(event.code);
    }
  };
  private keyUp = (event: KeyboardEvent) => { this.held.delete(event.code); };
  private blur = () => this.clear();

  constructor() {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
  }

  consume(): [InputFrame, InputFrame] {
    if (!this.enabled) { this.clear(); return [emptyInput(), emptyInput()]; }
    const frames = BINDINGS.map(b => ({
      left: this.held.has(b.left), right: this.held.has(b.right), down: this.held.has(b.down),
      jump: this.pressed.has(b.jump), attack: this.pressed.has(b.attack), ultra: this.pressed.has(b.ultra),
    })) as [InputFrame, InputFrame];
    this.pressed.clear();
    return frames;
  }

  clear() { this.held.clear(); this.pressed.clear(); }

  destroy() {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
  }
}
