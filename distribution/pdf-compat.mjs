// PDF.js uses these recent Map methods; keep the default factory usable in
// browsers which already support the viewer's other modern browser APIs.
export function installMapPolyfills() {
  for (const C of [Map, WeakMap]) {
    if (typeof C.prototype.getOrInsertComputed !== 'function') {
      Object.defineProperty(C.prototype, 'getOrInsertComputed', {
        configurable: true, writable: true,
        value(key, callback) {
          if (this.has(key)) return this.get(key);
          const value = callback(key);
          this.set(key, value);
          return value;
        },
      });
    }
    if (typeof C.prototype.getOrInsert !== 'function') {
      Object.defineProperty(C.prototype, 'getOrInsert', {
        configurable: true, writable: true,
        value(key, value) {
          if (!this.has(key)) this.set(key, value);
          return this.get(key);
        },
      });
    }
  }
}
