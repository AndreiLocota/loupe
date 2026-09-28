// pdf.js 5 calls Map/WeakMap#getOrInsertComputed, which many current browsers lack.
// Exported as an explicit function (not a side-effect import) so bundlers
// honouring package.json "sideEffects": false cannot tree-shake it away.

type AnyMap = {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): unknown;
};

function patch(proto: object) {
  if (typeof (proto as Record<string, unknown>)["getOrInsertComputed"] !== "function") {
    Object.defineProperty(proto, "getOrInsertComputed", {
      configurable: true,
      writable: true,
      value: function (this: AnyMap, key: unknown, callback: (key: unknown) => unknown) {
        // `has` so stored undefined values count as present; callback runs lazily.
        if (this.has(key)) return this.get(key);
        const value = callback(key);
        this.set(key, value);
        return value;
      },
    });
  }
  if (typeof (proto as Record<string, unknown>)["getOrInsert"] !== "function") {
    Object.defineProperty(proto, "getOrInsert", {
      configurable: true,
      writable: true,
      value: function (this: AnyMap, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      },
    });
  }
}

export function installMapPolyfills(): void {
  patch(Map.prototype);
  patch(WeakMap.prototype);
}
