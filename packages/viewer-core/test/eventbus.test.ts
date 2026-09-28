import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../src/events/EventBus.js';

describe('EventBus', () => {
  let bus: EventBus<string>;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('delivers events to subscribers', () => {
    const received: string[] = [];
    bus.subscribe((e) => received.push(e));
    bus.emit('hello');
    expect(received).toEqual(['hello']);
  });

  it('returns unsubscribe function', () => {
    const received: string[] = [];
    const unsub = bus.subscribe((e) => received.push(e));
    unsub();
    bus.emit('hello');
    expect(received).toHaveLength(0);
  });

  it('supports multiple subscribers', () => {
    const a: string[] = [];
    const b: string[] = [];
    bus.subscribe((e) => a.push(e));
    bus.subscribe((e) => b.push(e));
    bus.emit('x');
    expect(a).toEqual(['x']);
    expect(b).toEqual(['x']);
  });

  it('isolates listener errors', () => {
    bus.subscribe(() => {
      throw new Error('bad listener');
    });
    const received: string[] = [];
    bus.subscribe((e) => received.push(e));
    expect(() => bus.emit('test')).not.toThrow();
    expect(received).toEqual(['test']);
  });

  it('clear removes all listeners', () => {
    bus.subscribe(() => {});
    bus.clear();
    expect(bus.listenerCount).toBe(0);
  });
});
