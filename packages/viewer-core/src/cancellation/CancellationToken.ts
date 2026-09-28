export interface CancellationToken {
  readonly aborted: boolean;
  readonly signal: AbortSignal;
  readonly abortError: Error;

  throwIfAborted(): void;
}

export class CancellationTokenSource {
  private controller = new AbortController();
  private _aborted = false;

  get token(): CancellationToken {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const src = this;
    return {
      get aborted(): boolean {
        return src._aborted;
      },
      get signal(): AbortSignal {
        return src.controller.signal;
      },
      get abortError(): Error {
        // The DOMException constructor's 2nd argument already sets `name` to
        // 'AbortError'. Do NOT Object.assign a `name` afterwards: DOMException.name
        // is getter-only, so assigning it throws ("setting getter-only property
        // name"), which would surface in place of the intended abort error.
        return new DOMException('Operation cancelled', 'AbortError');
      },
      throwIfAborted(): void {
        if (src._aborted) throw src.token.abortError;
      },
    };
  }

  cancel(): void {
    if (this._aborted) return;
    this._aborted = true;
    this.controller.abort();
  }

  get aborted(): boolean {
    return this._aborted;
  }
}
