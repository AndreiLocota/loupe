import { describe, it, expect } from 'vitest';
import { CancellationTokenSource } from '../src/cancellation/CancellationToken.js';

describe('CancellationTokenSource', () => {
  it('exposes an abort error without throwing (DOMException.name is read-only)', () => {
    const src = new CancellationTokenSource();
    // Regression: the getter previously Object.assign-ed `name` onto a
    // DOMException, throwing "setting getter-only property name".
    let err: Error | undefined;
    expect(() => { err = src.token.abortError; }).not.toThrow();
    expect(err?.name).toBe('AbortError');
  });

  it('throwIfAborted throws an AbortError only after cancel()', () => {
    const src = new CancellationTokenSource();
    const token = src.token;
    expect(() => token.throwIfAborted()).not.toThrow();

    src.cancel();
    expect(token.aborted).toBe(true);
    expect(src.token.signal.aborted).toBe(true);
    expect(() => token.throwIfAborted()).toThrow();
    try {
      token.throwIfAborted();
    } catch (e) {
      expect((e as Error).name).toBe('AbortError');
    }
  });
});
