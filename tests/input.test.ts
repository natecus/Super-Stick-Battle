import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardInput } from '../src/game/input';

let keyboard: KeyboardInput | undefined;
const makeKeyboard = () => {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  keyboard = new KeyboardInput();
  keyboard.enabled = true;
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, repeat, ctrlKey: false, metaKey: false, altKey: false });
    target.dispatchEvent(event);
    return event;
  };
  return { keyboard, target, key };
};
afterEach(() => { keyboard?.destroy(); vi.unstubAllGlobals(); });

describe('shared keyboard', () => {
  it('holds movement for both players while consuming jump/attack presses just once', () => {
    const { keyboard, key } = makeKeyboard();
    key('keydown', 'KeyD'); key('keydown', 'ArrowLeft');
    key('keydown', 'KeyW'); key('keydown', 'KeyK');
    const first = keyboard.consume();
    expect(first[0].right).toBe(true); expect(first[0].jump).toBe(true);
    expect(first[1].left).toBe(true); expect(first[1].attack).toBe(true);
    const next = keyboard.consume();
    expect(next[0].right).toBe(true); expect(next[1].left).toBe(true);
    expect(next[0].jump).toBe(false); expect(next[1].attack).toBe(false);
  });

  it('ignores key autorepeat, but a release and second press permits a double jump', () => {
    const { keyboard, key } = makeKeyboard();
    key('keydown', 'KeyW'); keyboard.consume();
    key('keydown', 'KeyW', true); expect(keyboard.consume()[0].jump).toBe(false);
    key('keyup', 'KeyW'); key('keydown', 'KeyW'); expect(keyboard.consume()[0].jump).toBe(true);
  });

  it('prevents arrow scrolling only during gameplay and clears keys on blur', () => {
    const { keyboard, key, target } = makeKeyboard();
    expect(key('keydown', 'ArrowRight').defaultPrevented).toBe(true);
    target.dispatchEvent(new Event('blur'));
    expect(keyboard.consume()[1].right).toBe(false);
    keyboard.enabled = false;
    expect(key('keydown', 'ArrowRight').defaultPrevented).toBe(false);
    expect(keyboard.consume()[1].right).toBe(false);
  });
});
